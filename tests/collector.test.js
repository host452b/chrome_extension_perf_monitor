const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Collector } = require('../src/background/collector.js');

describe('Collector', () => {
  let collector;
  beforeEach(() => { collector = new Collector('own-extension-id'); });

  it('starts with empty data', () => assert.deepEqual(collector.getSnapshot(), {}));

  it('records a request from an extension', () => {
    collector.processRequest({
      initiator: 'chrome-extension://abc123',
      url: 'https://api.example.com/data',
      type: 'xmlhttprequest',
      responseHeaders: [{ name: 'content-length', value: '2048' }],
    });
    const snap = collector.getSnapshot();
    assert.equal(snap['abc123'].requests, 1);
    assert.equal(snap['abc123'].bytes, 2048);
    assert.equal(snap['abc123'].byType['xmlhttprequest'], 1);
    assert.equal(snap['abc123'].topDomains['api.example.com'], 1);
  });

  it('accumulates multiple requests from the same extension', () => {
    collector.processRequest({ initiator: 'chrome-extension://abc123', url: 'https://api.example.com/a', type: 'xmlhttprequest', responseHeaders: [{ name: 'content-length', value: '1000' }] });
    collector.processRequest({ initiator: 'chrome-extension://abc123', url: 'https://cdn.example.com/b', type: 'script', responseHeaders: [{ name: 'content-length', value: '500' }] });
    const snap = collector.getSnapshot();
    assert.equal(snap['abc123'].requests, 2);
    assert.equal(snap['abc123'].bytes, 1500);
  });

  it('ignores requests from own extension', () => {
    collector.processRequest({ initiator: 'chrome-extension://own-extension-id', url: 'https://api.example.com/data', type: 'xmlhttprequest', responseHeaders: [] });
    assert.deepEqual(collector.getSnapshot(), {});
  });

  it('ignores requests without extension initiator', () => {
    collector.processRequest({ initiator: 'https://example.com', url: 'https://api.example.com/data', type: 'xmlhttprequest', responseHeaders: [] });
    assert.deepEqual(collector.getSnapshot(), {});
  });

  it('ignores requests with no initiator', () => {
    collector.processRequest({ url: 'https://api.example.com/data', type: 'xmlhttprequest', responseHeaders: [] });
    assert.deepEqual(collector.getSnapshot(), {});
  });

  it('handles missing content-length header', () => {
    collector.processRequest({ initiator: 'chrome-extension://abc123', url: 'https://api.example.com/data', type: 'xmlhttprequest', responseHeaders: [] });
    assert.equal(collector.getSnapshot()['abc123'].bytes, 0);
  });

  it('reset clears all data', () => {
    collector.processRequest({ initiator: 'chrome-extension://abc123', url: 'https://api.example.com/data', type: 'xmlhttprequest', responseHeaders: [] });
    collector.reset();
    assert.deepEqual(collector.getSnapshot(), {});
  });

  it('tracks separate extensions independently', () => {
    collector.processRequest({ initiator: 'chrome-extension://ext1', url: 'https://a.com/x', type: 'xmlhttprequest', responseHeaders: [{ name: 'content-length', value: '100' }] });
    collector.processRequest({ initiator: 'chrome-extension://ext2', url: 'https://b.com/y', type: 'script', responseHeaders: [{ name: 'content-length', value: '200' }] });
    const snap = collector.getSnapshot();
    assert.equal(snap['ext1'].requests, 1);
    assert.equal(snap['ext1'].bytes, 100);
    assert.equal(snap['ext2'].requests, 1);
    assert.equal(snap['ext2'].bytes, 200);
  });
});
