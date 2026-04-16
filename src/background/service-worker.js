importScripts(
  '../shared/constants.js',
  '../shared/utils.js',
  '../shared/storage.js',
  './collector.js',
  './process-collector.js',
  './aggregator.js',
  './scorer.js'
);

const collector = new Collector(chrome.runtime.id);
const processCollector = new ProcessCollector(chrome.runtime.id);

// --- Network request listener ---
chrome.webRequest.onCompleted.addListener(
  (details) => collector.processRequest(details),
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// --- Periodic tasks ---
chrome.alarms.create('poll-processes', { periodInMinutes: 0.5 }); // every 30s
chrome.alarms.create('aggregate', { periodInMinutes: 15 });
chrome.alarms.create('mini-flush', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'poll-processes') {
    await pollProcesses();
  }
  if (alarm.name === 'aggregate' || alarm.name === 'mini-flush') {
    await flushAndPrune();
  }
});

async function pollProcesses() {
  const extensions = await getExtensions();
  processCollector.setExtensionMap(extensions);
  await processCollector.poll();
}

// Initial poll
pollProcesses().catch(e => console.error('[PerfMon] initial process poll failed:', e));

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
      icons: ext.icons || [],
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      contentScriptPatterns,
    };
  }

  await saveExtensions(extensions);
  processCollector.setExtensionMap(extensions);
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
        // Poll processes fresh for this request
        await pollProcesses();

        const netSnapshot = collector.getSnapshot();
        const processData = processCollector.getLatest();
        const processHistory = processCollector.getAllHistory();
        const stored = await getAllData();
        const now = Date.now();
        const activity = {};

        // Copy stored network buckets
        for (const [extId, data] of Object.entries(stored.activity)) {
          activity[extId] = { buckets: [...data.buckets], score: data.score || 0 };
        }

        // Merge live network snapshot
        if (Object.keys(netSnapshot).length > 0) {
          for (const [extId, entry] of Object.entries(netSnapshot)) {
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

        // Calculate scores for ALL extensions with CPU/memory data
        for (const [extId, meta] of Object.entries(stored.extensions)) {
          if (!activity[extId]) activity[extId] = { buckets: [], score: 0 };
          const totalRequests = activity[extId].buckets.reduce((s, b) => s + b.requests, 0);
          const totalBytes = activity[extId].buckets.reduce((s, b) => s + b.bytesTransferred, 0);
          const proc = processData[extId] || null;
          activity[extId].score = calculateScore(
            { permissions: meta.permissions || [], contentScriptPatterns: meta.contentScriptPatterns || [] },
            { totalRequests, totalBytes },
            proc
          );
          // Attach process data to activity for UI
          if (proc) {
            activity[extId].cpu = proc.cpu;
            activity[extId].memory = proc.memory;
            activity[extId].jsMemory = proc.jsMemory;
          }
        }

        sendResponse({
          activity,
          extensions: stored.extensions,
          settings: stored.settings,
          processAvailable: processCollector.isAvailable,
          processHistory,
        });
      } catch (e) {
        console.error('[PerfMon] GET_LIVE_SNAPSHOT failed:', e);
        sendResponse({ activity: {}, extensions: {}, settings: _DEFAULTS, processAvailable: false, processHistory: {} });
      }
    })();
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }
});
