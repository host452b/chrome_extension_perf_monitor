const _NATIVE_HOST = (typeof NATIVE_HOST_NAME !== 'undefined')
  ? NATIVE_HOST_NAME
  : 'com.perfmonitor.host';

class NativeBridge {
  constructor(hostName) {
    this._hostName = hostName || _NATIVE_HOST;
    this._port = null;
    this._connected = false;
    this._lastSample = {};
    this._lastSampleTime = 0;
    this._version = null;
    this._error = null;
  }

  connect() {
    if (this._port) return;
    try {
      this._port = chrome.runtime.connectNative(this._hostName);
      this._port.onMessage.addListener((msg) => this._processResponse(msg));
      this._port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError?.message || 'disconnected';
        console.warn('[PerfMon] Native host disconnected:', err);
        this._port = null;
        this._connected = false;
        this._error = err;
      });
      this._port.postMessage({ type: 'hello' });
    } catch (e) {
      console.warn('[PerfMon] Cannot connect to native host:', e.message);
      this._connected = false;
      this._error = e.message;
    }
  }

  requestSample() {
    if (!this._port) {
      this.connect();
      return;
    }
    try {
      this._port.postMessage({ type: 'sample' });
    } catch (e) {
      this._error = e.message;
    }
  }

  _processResponse(msg) {
    if (!msg) { this._connected = false; this._error = 'empty response'; return; }
    if (msg.type === 'hello') {
      this._connected = true;
      this._version = msg.version;
      this._error = null;
      console.log('[PerfMon] Native host connected: v' + msg.version + ' (' + msg.platform + ')');
      return;
    }
    if (msg.type === 'sample') {
      this._lastSample = {};
      for (const ext of msg.extensions || []) {
        if (ext.extId) {
          this._lastSample[ext.extId] = { cpu: ext.cpu || 0, rss: ext.rss || 0, pid: ext.pid || 0 };
        }
      }
      this._lastSampleTime = Date.now();
      return;
    }
    if (msg.type === 'error') {
      console.warn('[PerfMon] Native host error:', msg.message);
      this._error = msg.message;
    }
  }

  getLatest() { return { ...this._lastSample }; }
  isConnected() { return this._connected; }
}

function processHostResponse(response, state) {
  if (!response || response.type === 'error') {
    state.connected = false;
    state.error = response?.message || 'Unknown error';
    return state;
  }
  if (response.type === 'hello') {
    state.connected = true;
    state.version = response.version;
    state.platform = response.platform;
    return state;
  }
  if (response.type === 'sample') {
    state.lastSample = {};
    for (const ext of response.extensions || []) {
      if (ext.extId) {
        state.lastSample[ext.extId] = { cpu: ext.cpu, rss: ext.rss, pid: ext.pid };
      }
    }
    state.lastSampleTime = Date.now();
    return state;
  }
  return state;
}

if (typeof module !== 'undefined') {
  module.exports = { NativeBridge, processHostResponse };
}
