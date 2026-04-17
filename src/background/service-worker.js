importScripts(
  '../shared/constants.js',
  '../shared/utils.js',
  '../shared/storage.js',
  './scorer.js'
);

// --- Extension metadata sync ---
async function syncExtensionMetadata() {
  const allExtensions = await chrome.management.getAll();
  const extensions = {};
  const ownId = chrome.runtime.id;

  for (const ext of allExtensions) {
    if (ext.id === ownId) continue;
    if (ext.type !== 'extension') continue;

    const contentScriptPatterns = [];
    if (ext.contentScripts) {
      for (const cs of ext.contentScripts) {
        contentScriptPatterns.push(...(cs.matches || []));
      }
    }

    const allPerms = [...(ext.permissions || []), ...(ext.hostPermissions || [])];
    const sensitiveCount = allPerms.filter(p => SENSITIVE_PERMISSIONS.includes(p)).length;

    let scopeLabel = 'none';
    if (contentScriptPatterns.length > 0) {
      const hasBroad = contentScriptPatterns.some(p =>
        p === '<all_urls>' || p === '*://*/*' || p === 'http://*/*' || p === 'https://*/*'
      );
      scopeLabel = hasBroad ? 'all_sites' : `${contentScriptPatterns.length}_patterns`;
    }

    const score = calculateScore({
      permissions: allPerms,
      contentScriptPatterns,
    });

    extensions[ext.id] = {
      name: ext.name,
      version: ext.version,
      enabled: ext.enabled,
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      contentScriptPatterns,
      sensitiveCount,
      scopeLabel,
      score,
    };
  }

  await saveExtensions(extensions);
}

syncExtensionMetadata().catch(e => console.error('[PerfMon] sync failed:', e));

chrome.management.onInstalled.addListener(syncExtensionMetadata);
chrome.management.onUninstalled.addListener(syncExtensionMetadata);
chrome.management.onEnabled.addListener(syncExtensionMetadata);
chrome.management.onDisabled.addListener(syncExtensionMetadata);

// --- Tab resource probing ---
async function probeAllTabs() {
  const tabs = await chrome.tabs.query({});
  const results = [];

  for (const tab of tabs) {
    // Skip non-injectable tabs
    if (!tab.url || !tab.url.match(/^https?:\/\//)) {
      results.push({
        id: tab.id,
        title: tab.title || '(untitled)',
        url: tab.url || '',
        domain: '',
        jsHeapUsed: 0,
        jsHeapTotal: 0,
        domNodes: 0,
        resourceCount: 0,
        error: 'not injectable',
      });
      continue;
    }

    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            jsHeapUsed: performance.memory?.usedJSHeapSize || 0,
            jsHeapTotal: performance.memory?.totalJSHeapSize || 0,
            domNodes: document.querySelectorAll('*').length,
            resourceCount: performance.getEntriesByType('resource').length,
          };
        },
      });
      const domain = new URL(tab.url).hostname;
      results.push({
        id: tab.id,
        title: tab.title || '(untitled)',
        url: tab.url,
        domain,
        ...result,
        error: null,
      });
    } catch (e) {
      const domain = tab.url ? new URL(tab.url).hostname : '';
      results.push({
        id: tab.id,
        title: tab.title || '(untitled)',
        url: tab.url || '',
        domain,
        jsHeapUsed: 0,
        jsHeapTotal: 0,
        domNodes: 0,
        resourceCount: 0,
        error: e.message,
      });
    }
  }

  // Sort by JS heap descending
  results.sort((a, b) => b.jsHeapUsed - a.jsHeapUsed);
  return results;
}

// --- Message handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_DATA') {
    (async () => {
      try {
        const extensions = await getExtensions();
        const settings = await getSettings();
        sendResponse({ extensions, settings });
      } catch (e) {
        console.error('[PerfMon] GET_DATA failed:', e);
        sendResponse({ extensions: {}, settings: _DEFAULTS });
      }
    })();
    return true;
  }

  if (message.type === 'GET_TABS') {
    probeAllTabs().then(tabs => sendResponse({ tabs })).catch(e => {
      console.error('[PerfMon] GET_TABS failed:', e);
      sendResponse({ tabs: [] });
    });
    return true;
  }

  if (message.type === 'CLOSE_TAB') {
    chrome.tabs.remove(message.tabId).then(() => sendResponse({ ok: true })).catch(e => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }
});
