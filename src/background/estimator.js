/**
 * ResourceEstimator — infers per-extension CPU and memory from observable signals.
 *
 * Memory estimate (bytes):
 *   baselineMemory (has background worker? +15MB : +2MB)
 *   + matchingTabs × perTabOverhead (4MB per injected tab)
 *   + networkCacheEstimate (totalBytes × 0.3 — rough cache footprint)
 *
 * CPU estimate (0-100 abstract units, not real %):
 *   requestFrequency (req/min normalized)
 *   + pollingPenalty (periodic requests detected? +20)
 *   + tabCoverage (more injected tabs = more event listeners)
 *   + hasBackgroundWorker (+10 baseline)
 *
 * All values are ESTIMATES clearly labeled as such in the UI.
 */

// Per-tab content script memory overhead: ~4 MB average
const CONTENT_SCRIPT_PER_TAB_BYTES = 4 * 1024 * 1024;
// Background/service worker baseline memory
const BACKGROUND_WORKER_BYTES = 15 * 1024 * 1024;
// Minimal extension memory (just loaded, no content scripts)
const MINIMAL_EXT_BYTES = 2 * 1024 * 1024;
// Network cache estimate factor
const CACHE_FACTOR = 0.3;

class ResourceEstimator {
  constructor(ownExtensionId) {
    this._ownId = ownExtensionId;
    this._tabUrls = [];           // current tab URLs, refreshed on poll
    this._requestTimestamps = {}; // { extId: [ts, ts, ts...] } — last 5 min of request timestamps
    this._maxTimestampAge = 5 * 60 * 1000; // 5 min window for frequency calc
  }

  /** Record a request timestamp for frequency analysis */
  recordRequest(extId, timestamp) {
    if (!this._requestTimestamps[extId]) {
      this._requestTimestamps[extId] = [];
    }
    this._requestTimestamps[extId].push(timestamp);
  }

  /** Prune old timestamps */
  _pruneTimestamps() {
    const cutoff = Date.now() - this._maxTimestampAge;
    for (const extId of Object.keys(this._requestTimestamps)) {
      this._requestTimestamps[extId] = this._requestTimestamps[extId].filter(t => t >= cutoff);
      if (this._requestTimestamps[extId].length === 0) {
        delete this._requestTimestamps[extId];
      }
    }
  }

  /** Update tab URL list — call before estimate() */
  async refreshTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      this._tabUrls = tabs.map(t => t.url).filter(Boolean);
    } catch {
      this._tabUrls = [];
    }
  }

  /**
   * Count how many open tabs match an extension's content script patterns.
   * @param {string[]} patterns — e.g. ["<all_urls>", "https://example.com/*"]
   * @returns {number}
   */
  _countMatchingTabs(patterns) {
    if (!patterns || patterns.length === 0) return 0;

    const hasBroad = patterns.some(p =>
      p === '<all_urls>' || p === '*://*/*' || p === 'http://*/*' || p === 'https://*/*'
    );

    if (hasBroad) {
      // Matches almost all tabs (except chrome:// etc.)
      return this._tabUrls.filter(url =>
        url.startsWith('http://') || url.startsWith('https://')
      ).length;
    }

    // Convert match patterns to regexes (simplified)
    let count = 0;
    for (const url of this._tabUrls) {
      for (const pattern of patterns) {
        if (this._matchesPattern(url, pattern)) {
          count++;
          break;
        }
      }
    }
    return count;
  }

  /** Simplified URL pattern matcher */
  _matchesPattern(url, pattern) {
    try {
      // Convert Chrome match pattern to regex
      // e.g. "https://example.com/*" → /^https:\/\/example\.com\/.*$/
      // First replace * with a placeholder, then escape, then restore
      const placeholder = '__WILDCARD__';
      const withPlaceholders = pattern.replace(/\*/g, placeholder);
      const escaped = withPlaceholders.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      const regex = escaped.replace(new RegExp(placeholder, 'g'), '.*');
      return new RegExp('^' + regex + '$').test(url);
    } catch {
      return false;
    }
  }

  /**
   * Get request frequency (requests per minute) for an extension.
   */
  _getRequestFrequency(extId) {
    const timestamps = this._requestTimestamps[extId];
    if (!timestamps || timestamps.length < 2) return 0;
    const window = (timestamps[timestamps.length - 1] - timestamps[0]) / 60000; // minutes
    if (window < 0.1) return 0;
    return timestamps.length / window;
  }

  /**
   * Detect if extension has a periodic polling pattern.
   * Look for regular intervals between requests.
   */
  _isPolling(extId) {
    const timestamps = this._requestTimestamps[extId];
    if (!timestamps || timestamps.length < 4) return false;

    // Calculate intervals between consecutive requests
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Check if intervals are regular (low variance relative to mean)
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean < 1000) return false; // < 1s intervals = burst, not polling
    const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean; // coefficient of variation
    return cv < 0.5; // regular if CV < 50%
  }

  /**
   * Estimate resources for one extension.
   * @param {Object} extMeta — from chrome.management (permissions, contentScriptPatterns, enabled)
   * @param {Object} networkData — { totalRequests, totalBytes }
   * @returns {{ estMemory: number, estCpu: number, matchingTabs: number, reqPerMin: number, isPolling: boolean }}
   */
  estimate(extId, extMeta, networkData) {
    this._pruneTimestamps();

    if (!extMeta.enabled) {
      return { estMemory: 0, estCpu: 0, matchingTabs: 0, reqPerMin: 0, isPolling: false };
    }

    const matchingTabs = this._countMatchingTabs(extMeta.contentScriptPatterns);
    const hasBackground = true; // MV3 all have service workers; MV2 have background pages
    const reqPerMin = this._getRequestFrequency(extId);
    const isPolling = this._isPolling(extId);

    // --- Memory estimate ---
    let estMemory = hasBackground ? BACKGROUND_WORKER_BYTES : MINIMAL_EXT_BYTES;
    estMemory += matchingTabs * CONTENT_SCRIPT_PER_TAB_BYTES;
    estMemory += (networkData.totalBytes || 0) * CACHE_FACTOR;

    // --- CPU estimate (0-100 abstract units) ---
    let estCpu = hasBackground ? 5 : 0; // baseline
    estCpu += Math.min(reqPerMin * 2, 40); // request frequency (capped at 40)
    estCpu += isPolling ? 15 : 0; // polling penalty
    estCpu += Math.min(matchingTabs * 1.5, 30); // tab injection load
    estCpu = Math.min(Math.round(estCpu), 100);

    return { estMemory: Math.round(estMemory), estCpu, matchingTabs, reqPerMin: Math.round(reqPerMin * 10) / 10, isPolling };
  }
}

if (typeof module !== 'undefined') {
  module.exports = { ResourceEstimator, CONTENT_SCRIPT_PER_TAB_BYTES, BACKGROUND_WORKER_BYTES };
}
