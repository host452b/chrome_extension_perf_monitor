/**
 * ProcessCollector — uses chrome.debugger API to get per-extension memory/performance.
 *
 * Flow:
 * 1. chrome.debugger.getTargets() → find all extension service_worker / background_page targets
 * 2. For each target: attach → Runtime.getHeapUsage → Performance.getMetrics → detach
 * 3. Collect jsHeapUsed, jsHeapTotal, TaskDuration (proxy for CPU)
 *
 * The debugger banner appears while attached but we attach/detach quickly per poll.
 */
class ProcessCollector {
  constructor(ownExtensionId) {
    this._ownId = ownExtensionId;
    this._latest = {};       // { extId: { jsHeapUsed, jsHeapTotal, taskDuration, memory } }
    this._history = {};      // { extId: [ { ts, memory, cpu } ] }
    this._prevTaskDuration = {}; // for computing CPU delta
    this._maxHistory = 60;
    this._available = typeof chrome !== 'undefined' && !!chrome.debugger;
  }

  get isAvailable() {
    return this._available;
  }

  setExtensionMap() {
    // No-op: we discover extensions directly from debugger targets
  }

  async poll() {
    if (!this._available) return;

    try {
      const targets = await new Promise((resolve, reject) => {
        chrome.debugger.getTargets((t) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(t);
        });
      });

      const now = Date.now();
      const extTargets = targets.filter(t =>
        t.extensionId &&
        t.extensionId !== this._ownId &&
        (t.type === 'service_worker' || t.type === 'background_page' || t.type === 'worker')
      );

      // Deduplicate by extensionId (pick the first/main target)
      const byExtId = {};
      for (const t of extTargets) {
        if (!byExtId[t.extensionId]) byExtId[t.extensionId] = t;
      }

      for (const [extId, target] of Object.entries(byExtId)) {
        try {
          const data = await this._probeTarget(target, extId);
          if (data) {
            // Calculate CPU-like metric from TaskDuration delta
            const prevDuration = this._prevTaskDuration[extId] || 0;
            const cpuDelta = data.taskDuration > prevDuration
              ? (data.taskDuration - prevDuration) * 100 // rough: seconds → percentage-ish over poll interval
              : 0;
            this._prevTaskDuration[extId] = data.taskDuration;

            this._latest[extId] = {
              memory: data.jsHeapUsed,
              jsHeapUsed: data.jsHeapUsed,
              jsHeapTotal: data.jsHeapTotal,
              cpu: Math.min(cpuDelta, 100), // cap at 100
              taskDuration: data.taskDuration,
            };

            if (!this._history[extId]) this._history[extId] = [];
            this._history[extId].push({
              ts: now,
              memory: data.jsHeapUsed,
              cpu: Math.min(cpuDelta, 100),
            });
            if (this._history[extId].length > this._maxHistory) {
              this._history[extId] = this._history[extId].slice(-this._maxHistory);
            }
          }
        } catch (e) {
          // Skip this extension silently — might be suspended or restricted
        }
      }
    } catch (e) {
      console.warn('[PerfMon] Debugger poll failed:', e.message);
    }
  }

  async _probeTarget(target, extId) {
    const debuggee = target.tabId
      ? { tabId: target.tabId }
      : { targetId: target.id };

    // Attach
    await new Promise((resolve, reject) => {
      chrome.debugger.attach(debuggee, '1.3', () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });

    try {
      // Get heap usage
      const heap = await new Promise((resolve, reject) => {
        chrome.debugger.sendCommand(debuggee, 'Runtime.getHeapUsage', {}, (result) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(result);
        });
      });

      // Get performance metrics (TaskDuration = cumulative CPU seconds)
      let taskDuration = 0;
      try {
        const metrics = await new Promise((resolve, reject) => {
          chrome.debugger.sendCommand(debuggee, 'Performance.enable', {}, () => {
            chrome.debugger.sendCommand(debuggee, 'Performance.getMetrics', {}, (result) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve(result);
            });
          });
        });
        const td = metrics.metrics?.find(m => m.name === 'TaskDuration');
        if (td) taskDuration = td.value;
      } catch {
        // Performance.getMetrics not available for this target type
      }

      return {
        jsHeapUsed: heap.usedSize || 0,
        jsHeapTotal: heap.totalSize || 0,
        taskDuration,
      };
    } finally {
      // Always detach
      chrome.debugger.detach(debuggee, () => {
        // Ignore detach errors
        void chrome.runtime.lastError;
      });
    }
  }

  getLatest() {
    const result = {};
    for (const [extId, data] of Object.entries(this._latest)) {
      result[extId] = { ...data };
    }
    return result;
  }

  getHistory(extId) {
    return (this._history[extId] || []).slice();
  }

  getAllHistory() {
    const result = {};
    for (const [extId, arr] of Object.entries(this._history)) {
      result[extId] = arr.slice();
    }
    return result;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { ProcessCollector };
}
