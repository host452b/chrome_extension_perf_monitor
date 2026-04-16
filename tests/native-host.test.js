const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

function encodeMessage(obj) {
  const json = JSON.stringify(obj);
  const buf = Buffer.alloc(4 + json.length);
  buf.writeUInt32LE(json.length, 0);
  buf.write(json, 4);
  return buf;
}

function decodeMessage(buf) {
  const len = buf.readUInt32LE(0);
  const json = buf.slice(4, 4 + len).toString('utf8');
  return JSON.parse(json);
}

describe('native host protocol', () => {
  const hostPath = path.join(__dirname, '..', 'native-host', 'perf_monitor_host.py');

  it('responds to hello with version and platform', () => {
    const input = encodeMessage({ type: 'hello' });
    const result = execFileSync('python3', [hostPath], { input, timeout: 5000 });
    const msg = decodeMessage(result);
    assert.equal(msg.type, 'hello');
    assert.ok(msg.version);
    assert.ok(msg.platform);
  });

  it('responds to sample with extensions array', () => {
    const input = encodeMessage({ type: 'sample' });
    const result = execFileSync('python3', [hostPath], { input, timeout: 5000 });
    const msg = decodeMessage(result);
    assert.equal(msg.type, 'sample');
    assert.ok(Array.isArray(msg.extensions));
    for (const ext of msg.extensions) {
      assert.equal(typeof ext.pid, 'number');
      assert.equal(typeof ext.cpu, 'number');
      assert.equal(typeof ext.rss, 'number');
    }
  });

  it('responds to unknown type with error', () => {
    const input = encodeMessage({ type: 'bogus' });
    const result = execFileSync('python3', [hostPath], { input, timeout: 5000 });
    const msg = decodeMessage(result);
    assert.equal(msg.type, 'error');
    assert.ok(msg.message);
  });
});
