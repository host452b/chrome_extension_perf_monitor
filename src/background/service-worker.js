importScripts(
  '../shared/constants.js',
  '../shared/utils.js',
  '../shared/storage.js',
  './collector.js',
  './estimator.js',
  './aggregator.js',
  './scorer.js',
  './native-bridge.js'
);

const collector = new Collector(chrome.runtime.id);
const estimator = new ResourceEstimator(chrome.runtime.id);
const nativeBridge = new NativeBridge();
nativeBridge.connect();

// --- Network request listener (also feeds estimator timestamps) ---
chrome.webRequest.onCompleted.addListener(
  (details) => {
    collector.processRequest(details);
    // Feed request timestamp to estimator for frequency analysis
    const extId = details.initiator && details.initiator.startsWith('chrome-extension://')
      ? details.initiator.slice('chrome-extension://'.length).split('/')[0]
      : null;
    if (extId && extId !== chrome.runtime.id) {
      estimator.recordRequest(extId, Date.now());
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// --- Periodic tasks ---
chrome.alarms.create('aggregate', { periodInMinutes: 15 });
chrome.alarms.create('mini-flush', { periodInMinutes: 2 });
chrome.alarms.create('sample-native', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sample-native') {
    nativeBridge.requestSample();
  }
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
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      contentScriptPatterns,
    };
  }

  await saveExtensions(extensions);
}

syncExtensionMetadata().catch(e => console.error('[PerfMon] syncExtensionMetadata failed:', e));

chrome.management.onInstalled.addListener(syncExtensionMetadata);
chrome.management.onUninstalled.addListener(syncExtensionMetadata);
chrome.management.onEnabled.addListener(syncExtensionMetadata);
chrome.management.onDisabled.addListener(syncExtensionMetadata);

// --- Message handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LIVE_SNAPSHOT') {
    (async () => {
      try {
        const snapshot = collector.getSnapshot();
        const stored = await getAllData();
        const now = Date.now();
        const activity = {};

        // Copy stored buckets
        for (const [extId, data] of Object.entries(stored.activity)) {
          activity[extId] = { buckets: [...data.buckets], score: data.score || 0 };
        }

        // Merge live network snapshot
        if (Object.keys(snapshot).length > 0) {
          for (const [extId, entry] of Object.entries(snapshot)) {
            if (!activity[extId]) activity[extId] = { buckets: [], score: 0 };
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

        // Refresh tab data for estimator
        await estimator.refreshTabs();

        // Native host data (may be empty)
        const nativeData = nativeBridge.getLatest();
        const nativeConnected = nativeBridge.isConnected();

        // Calculate scores and estimates for ALL extensions
        for (const [extId, meta] of Object.entries(stored.extensions)) {
          if (!activity[extId]) activity[extId] = { buckets: [], score: 0 };
          const totalRequests = activity[extId].buckets.reduce((s, b) => s + b.requests, 0);
          const totalBytes = activity[extId].buckets.reduce((s, b) => s + b.bytesTransferred, 0);

          // Use native data if available, otherwise estimate
          const proc = nativeData[extId] || null;
          const est = estimator.estimate(extId, meta, { totalRequests, totalBytes });

          activity[extId].score = calculateScore(
            { permissions: meta.permissions || [], contentScriptPatterns: meta.contentScriptPatterns || [] },
            { totalRequests, totalBytes },
            proc || { cpu: est.estCpu, rss: est.estMemory }
          );

          // Attach resource data for UI
          if (proc) {
            activity[extId].cpu = proc.cpu;
            activity[extId].rss = proc.rss;
            activity[extId].measured = true;
          } else {
            activity[extId].cpu = est.estCpu;
            activity[extId].rss = est.estMemory;
            activity[extId].measured = false;
          }
          activity[extId].matchingTabs = est.matchingTabs;
          activity[extId].reqPerMin = est.reqPerMin;
          activity[extId].isPolling = est.isPolling;
        }

        sendResponse({
          activity,
          extensions: stored.extensions,
          settings: stored.settings,
          nativeConnected,
        });
      } catch (e) {
        console.error('[PerfMon] GET_LIVE_SNAPSHOT failed:', e);
        sendResponse({ activity: {}, extensions: {}, settings: _DEFAULTS, nativeConnected: false });
      }
    })();
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }
});
