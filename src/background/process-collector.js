/**
 * ProcessCollector — polls chrome.processes API for per-extension CPU & memory.
 *
 * chrome.processes.getProcessInfo() returns per-process data:
 *   - cpu: CPU usage (percentage of one core, 0-100+)
 *   - privateMemory: private memory in bytes
 *   - jsMemoryAllocated / jsMemoryUsed: JS heap bytes
 *
 * Extension processes have type "extension" with title matching the extension name.
 * We match process titles to extension names from chrome.management.
 */
class ProcessCollector {
  constructor(ownExtensionId) {
    this._ownId = ownExtensionId;
    this._latest = {};       // { extId: { cpu, memory, jsMemory, pid } }
    this._history = {};      // { extId: [ { ts, cpu, memory } ] }  — rolling window
    this._nameToId = {};     // { "Extension Name": extId }
    this._maxHistory = 60;   // keep last 60 samples (~30 min at 30s interval)
    this._available = typeof chrome !== 'undefined' && !!chrome.processes;
  }

  get isAvailable() {
    return this._available;
  }

  /** Update the name→id map from management data */
  setExtensionMap(extensions) {
    this._nameToId = {};
    for (const [id, ext] of Object.entries(extensions)) {
      if (id === this._ownId) continue;
      this._nameToId[ext.name] = id;
    }
  }

  /** Poll chrome.processes and update latest + history */
  async poll() {
    if (!this._available) return;

    try {
      const processes = await chrome.processes.getProcessInfo([], true);
      const now = Date.now();
      const seen = new Set();

      for (const proc of Object.values(processes)) {
        if (proc.type !== 'extension') continue;

        // Match process title to extension name
        const extId = this._nameToId[proc.title];
        if (!extId) continue;

        seen.add(extId);
        this._latest[extId] = {
          cpu: proc.cpu || 0,
          memory: proc.privateMemory || 0,
          jsMemory: proc.jsMemoryUsed || 0,
          pid: proc.osProcessId || 0,
        };

        // Append to history
        if (!this._history[extId]) this._history[extId] = [];
        this._history[extId].push({
          ts: now,
          cpu: proc.cpu || 0,
          memory: proc.privateMemory || 0,
        });

        // Trim history
        if (this._history[extId].length > this._maxHistory) {
          this._history[extId] = this._history[extId].slice(-this._maxHistory);
        }
      }

      // Extensions not seen in processes get 0
      for (const extId of Object.keys(this._nameToId)) {
        if (!seen.has(this._nameToId[extId]) && this._latest[this._nameToId[extId]]) {
          // Keep last known value but mark cpu as 0
        }
      }
    } catch (e) {
      console.error('[PerfMon] Process poll failed:', e);
      this._available = false;
    }
  }

  /** Get latest snapshot: { extId: { cpu, memory, jsMemory, pid } } */
  getLatest() {
    const result = {};
    for (const [extId, data] of Object.entries(this._latest)) {
      result[extId] = { ...data };
    }
    return result;
  }

  /** Get history for a specific extension */
  getHistory(extId) {
    return (this._history[extId] || []).slice();
  }

  /** Get all history */
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
