importScripts(
  '../shared/constants.js',
  '../shared/utils.js',
  '../shared/storage.js',
  './collector.js',
  './aggregator.js',
  './scorer.js'
);

const collector = new Collector(chrome.runtime.id);

// --- Network request listener ---
chrome.webRequest.onCompleted.addListener(
  (details) => collector.processRequest(details),
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// --- Periodic aggregation via alarms (every 15 minutes) ---
chrome.alarms.create('aggregate', { periodInMinutes: 15 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'aggregate') {
    await flushAndPrune();
  }
});

async function flushAndPrune() {
  const snapshot = collector.getSnapshot();
  collector.reset();

  if (Object.keys(snapshot).length === 0) return;

  const now = Date.now();
  const settings = await getSettings();
  const retentionMs = settings.retentionHours * 60 * 60 * 1000;

  let activity = await getActivity();
  activity = mergeSnapshotIntoActivity(activity, snapshot, now);
  activity = pruneOldBuckets(activity, now, retentionMs);

  // Recalculate scores
  const extensions = await getExtensions();
  for (const extId of Object.keys(activity)) {
    const meta = extensions[extId];
    if (meta) {
      const totalRequests = activity[extId].buckets.reduce((s, b) => s + b.requests, 0);
      const totalBytes = activity[extId].buckets.reduce((s, b) => s + b.bytesTransferred, 0);
      activity[extId].score = calculateScore(
        { permissions: meta.permissions || [], contentScriptPatterns: meta.contentScriptPatterns || [] },
        { totalRequests, totalBytes }
      );
    }
  }

  await saveActivity(activity);
}

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

    extensions[ext.id] = {
      name: ext.name,
      version: ext.version,
      enabled: ext.enabled,
      icons: ext.icons || [],
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      contentScriptPatterns,
      hasBackgroundWorker: !!(ext.backgroundUrl || ext.offlineEnabled),
    };
  }

  await saveExtensions(extensions);
}

// Sync on startup
syncExtensionMetadata();

// Sync on extension changes
chrome.management.onInstalled.addListener(syncExtensionMetadata);
chrome.management.onUninstalled.addListener(syncExtensionMetadata);
chrome.management.onEnabled.addListener(syncExtensionMetadata);
chrome.management.onDisabled.addListener(syncExtensionMetadata);

// --- Message handler for popup/sidepanel ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LIVE_SNAPSHOT') {
    (async () => {
      const snapshot = collector.getSnapshot();
      const stored = await getAllData();
      const now = Date.now();
      let activity = { ...stored.activity };
      if (Object.keys(snapshot).length > 0) {
        activity = mergeSnapshotIntoActivity(activity, snapshot, now);
      }
      // Calculate scores for live data
      for (const extId of Object.keys(activity)) {
        const meta = stored.extensions[extId];
        if (meta) {
          const totalRequests = activity[extId].buckets.reduce((s, b) => s + b.requests, 0);
          const totalBytes = activity[extId].buckets.reduce((s, b) => s + b.bytesTransferred, 0);
          activity[extId].score = calculateScore(
            { permissions: meta.permissions || [], contentScriptPatterns: meta.contentScriptPatterns || [] },
            { totalRequests, totalBytes }
          );
        }
      }
      sendResponse({
        activity,
        extensions: stored.extensions,
        settings: stored.settings,
      });
    })();
    return true; // async sendResponse
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.sidePanel.open({ windowId: sender.tab?.windowId }).then(() => sendResponse({ ok: true }));
    return true;
  }
});
