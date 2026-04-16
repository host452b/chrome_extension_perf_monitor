class Collector {
  constructor(ownExtensionId) {
    this._ownId = ownExtensionId;
    this._data = new Map();
  }

  processRequest(details) {
    const extId = this._extractExtensionId(details.initiator);
    if (!extId || extId === this._ownId) return;

    if (!this._data.has(extId)) {
      this._data.set(extId, { requests: 0, bytes: 0, byType: {}, topDomains: {} });
    }

    const entry = this._data.get(extId);
    entry.requests += 1;
    entry.bytes += this._getContentLength(details.responseHeaders);

    const type = details.type || 'other';
    entry.byType[type] = (entry.byType[type] || 0) + 1;

    const domain = this._extractDomain(details.url);
    if (domain) {
      entry.topDomains[domain] = (entry.topDomains[domain] || 0) + 1;
    }
  }

  getSnapshot() {
    const result = {};
    for (const [id, data] of this._data) {
      result[id] = {
        requests: data.requests,
        bytes: data.bytes,
        byType: { ...data.byType },
        topDomains: { ...data.topDomains },
      };
    }
    return result;
  }

  reset() {
    this._data.clear();
  }

  _extractExtensionId(initiator) {
    if (!initiator) return null;
    const prefix = 'chrome-extension://';
    if (!initiator.startsWith(prefix)) return null;
    return initiator.slice(prefix.length).split('/')[0];
  }

  _getContentLength(headers) {
    if (!headers) return 0;
    for (const h of headers) {
      if (h.name.toLowerCase() === 'content-length') {
        return parseInt(h.value, 10) || 0;
      }
    }
    return 0;
  }

  _extractDomain(url) {
    try { return new URL(url).hostname; } catch { return null; }
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Collector };
}
