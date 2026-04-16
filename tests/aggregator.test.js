const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createBucket, mergeSnapshotIntoActivity, pruneOldBuckets } = require('../src/background/aggregator.js');

describe('createBucket', () => {
  it('creates a bucket from collector snapshot entry', () => {
    const timestamp = Date.now();
    const entry = { requests: 42, bytes: 10240, byType: { xmlhttprequest: 30, script: 12 }, topDomains: { 'api.example.com': 25, 'cdn.example.com': 17 } };
    const bucket = createBucket(timestamp, entry);
    assert.equal(bucket.timestamp, timestamp);
    assert.equal(bucket.requests, 42);
    assert.equal(bucket.bytesTransferred, 10240);
    assert.deepEqual(bucket.byType, { xmlhttprequest: 30, script: 12 });
  });
});

describe('mergeSnapshotIntoActivity', () => {
  it('creates new activity entry for new extension', () => {
    const result = mergeSnapshotIntoActivity({}, { ext1: { requests: 10, bytes: 500, byType: {}, topDomains: {} } }, 1000);
    assert.ok('ext1' in result);
    assert.equal(result['ext1'].buckets.length, 1);
    assert.equal(result['ext1'].buckets[0].requests, 10);
  });

  it('appends bucket to existing activity', () => {
    const activity = { ext1: { buckets: [{ timestamp: 500, requests: 5, bytesTransferred: 100, byType: {}, topDomains: {} }] } };
    const result = mergeSnapshotIntoActivity(activity, { ext1: { requests: 10, bytes: 500, byType: {}, topDomains: {} } }, 1000);
    assert.equal(result['ext1'].buckets.length, 2);
  });

  it('handles multiple extensions in one snapshot', () => {
    const result = mergeSnapshotIntoActivity({}, {
      ext1: { requests: 10, bytes: 500, byType: {}, topDomains: {} },
      ext2: { requests: 20, bytes: 1000, byType: {}, topDomains: {} },
    }, 1000);
    assert.ok('ext1' in result);
    assert.ok('ext2' in result);
  });
});

describe('pruneOldBuckets', () => {
  it('removes buckets older than retention period', () => {
    const activity = { ext1: { buckets: [
      { timestamp: 10000, requests: 1, bytesTransferred: 0, byType: {}, topDomains: {} },
      { timestamp: 40000, requests: 2, bytesTransferred: 0, byType: {}, topDomains: {} },
      { timestamp: 80000, requests: 3, bytesTransferred: 0, byType: {}, topDomains: {} },
    ] } };
    const result = pruneOldBuckets(activity, 100000, 50000);
    assert.equal(result['ext1'].buckets.length, 1);
  });

  it('removes extension entry if all buckets are pruned', () => {
    const activity = { ext1: { buckets: [{ timestamp: 10000, requests: 1, bytesTransferred: 0, byType: {}, topDomains: {} }] } };
    const result = pruneOldBuckets(activity, 100000, 50000);
    assert.ok(!('ext1' in result));
  });

  it('keeps all buckets within retention', () => {
    const activity = { ext1: { buckets: [
      { timestamp: 10000, requests: 1, bytesTransferred: 0, byType: {}, topDomains: {} },
      { timestamp: 80000, requests: 2, bytesTransferred: 0, byType: {}, topDomains: {} },
    ] } };
    const result = pruneOldBuckets(activity, 100000, 200000);
    assert.equal(result['ext1'].buckets.length, 2);
  });
});
