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

    // Count sensitive permissions
    const allPerms = [...(ext.permissions || []), ...(ext.hostPermissions || [])];
    const sensitiveCount = allPerms.filter(p => SENSITIVE_PERMISSIONS.includes(p)).length;

    // Determine scope label
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

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }
});
