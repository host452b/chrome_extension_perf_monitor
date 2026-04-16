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
chrome.alarms.create('mini-flush', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'aggregate' || alarm.name === 'mini-flush') {
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
      const activity = {};

      // Copy stored buckets
      for (const [extId, data] of Object.entries(stored.activity)) {
        activity[extId] = { buckets: [...data.buckets], score: data.score || 0 };
      }

      // Merge live snapshot as a single "current" bucket (replace if exists, don't duplicate)
      if (Object.keys(snapshot).length > 0) {
        for (const [extId, entry] of Object.entries(snapshot)) {
          if (!activity[extId]) {
            activity[extId] = { buckets: [], score: 0 };
          }
          // Remove any existing live bucket (timestamp === 0 marks it as live)
          activity[extId].buckets = activity[extId].buckets.filter(b => b._live !== true);
          activity[extId].buckets.push({
            timestamp: now,
            requests: entry.requests,
            bytesTransferred: entry.bytes,
            byType: { ...entry.byType },
            topDomains: { ...entry.topDomains },
            _live: true,
          });
        }
      }

      // Calculate scores
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
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.windows.getCurrent((win) => {
      chrome.sidePanel.open({ windowId: win.id }).then(() => sendResponse({ ok: true }));
    });
    return true;
  }
});
