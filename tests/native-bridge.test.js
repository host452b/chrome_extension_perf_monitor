const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { processHostResponse } = require('../src/background/native-bridge.js');

describe('native bridge message processing', () => {
  it('processes hello response', () => {
    const state = { connected: false };
    processHostResponse({ type: 'hello', version: '1.0.0', platform: 'Darwin' }, state);
    assert.equal(state.connected, true);
    assert.equal(state.version, '1.0.0');
  });

  it('processes sample response', () => {
    const state = {};
    processHostResponse({
      type: 'sample',
      extensions: [
        { extId: 'abc123', pid: 1234, cpu: 5.2, rss: 52428800 },
        { extId: 'def456', pid: 5678, cpu: 1.1, rss: 10485760 },
        { extId: null, pid: 9999, cpu: 0.5, rss: 8388608 },
      ],
    }, state);
    assert.equal(Object.keys(state.lastSample).length, 2);
    assert.equal(state.lastSample['abc123'].cpu, 5.2);
    assert.equal(state.lastSample['abc123'].rss, 52428800);
    assert.equal(state.lastSample['def456'].cpu, 1.1);
  });

  it('handles error response', () => {
    const state = { connected: true };
    processHostResponse({ type: 'error', message: 'something broke' }, state);
    assert.equal(state.connected, false);
    assert.equal(state.error, 'something broke');
  });

  it('handles null response', () => {
    const state = { connected: true };
    processHostResponse(null, state);
    assert.equal(state.connected, false);
  });
});
