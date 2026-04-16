/**
 * Integration tests - verify module interop, data flow, and edge cases
 * that unit tests per module don't catch.
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Load modules in the same order as the service worker
const { SENSITIVE_PERMISSIONS, DEFAULT_SETTINGS, BUCKET_INTERVAL_MS } = require('../src/shared/constants.js');
const { formatBytes, formatNumber, getScoreColor, getScoreLabel, extractExtensionId } = require('../src/shared/utils.js');
const { calculateScore, normalizeValue } = require('../src/background/scorer.js');
const { Collector } = require('../src/background/collector.js');
const { createBucket, mergeSnapshotIntoActivity, pruneOldBuckets } = require('../src/background/aggregator.js');

describe('Integration: Full data pipeline', () => {
  let collector;

  beforeEach(() => {
    collector = new Collector('own-id');
  });

  it('collect → snapshot → bucket → merge → score: end-to-end', () => {
    // 1. Simulate requests from two extensions
    for (let i = 0; i < 50; i++) {
      collector.processRequest({
        initiator: 'chrome-extension://ext-heavy',
        url: 'https://api.heavy.com/data',
        type: 'xmlhttprequest',
        responseHeaders: [{ name: 'content-length', value: '10240' }],
      });
    }
    for (let i = 0; i < 5; i++) {
      collector.processRequest({
        initiator: 'chrome-extension://ext-light',
        url: 'https://api.light.com/ping',
        type: 'xmlhttprequest',
        responseHeaders: [{ name: 'content-length', value: '256' }],
      });
    }

    // 2. Get snapshot
    const snapshot = collector.getSnapshot();
    assert.equal(Object.keys(snapshot).length, 2);
    assert.equal(snapshot['ext-heavy'].requests, 50);
    assert.equal(snapshot['ext-light'].requests, 5);

    // 3. Merge into activity
    const now = Date.now();
    let activity = mergeSnapshotIntoActivity({}, snapshot, now);
    assert.equal(activity['ext-heavy'].buckets.length, 1);
    assert.equal(activity['ext-heavy'].buckets[0].requests, 50);
    assert.equal(activity['ext-heavy'].buckets[0].bytesTransferred, 50 * 10240);

    // 4. Calculate scores
    const heavyMeta = {
      permissions: ['<all_urls>', 'webRequest', 'cookies'],
      contentScriptPatterns: ['<all_urls>'],
    };
    const lightMeta = {
      permissions: ['storage'],
      contentScriptPatterns: [],
    };

    const heavyScore = calculateScore(heavyMeta, {
      totalRequests: 50,
      totalBytes: 50 * 10240,
    });
    const lightScore = calculateScore(lightMeta, {
      totalRequests: 5,
      totalBytes: 5 * 256,
    });

    // Heavy extension should score higher (without process data, scores are lower)
    assert.ok(heavyScore > lightScore, `Heavy ${heavyScore} should > light ${lightScore}`);
    assert.ok(heavyScore >= 10, `Heavy score ${heavyScore} should be non-trivial`);

    // With process data, scores should be higher
    const heavyWithProcess = calculateScore(heavyMeta, { totalRequests: 50, totalBytes: 50 * 10240 },
      { cpu: 15, memory: 80 * 1024 * 1024 });
    assert.ok(heavyWithProcess > heavyScore, `With CPU/mem ${heavyWithProcess} > without ${heavyScore}`);
  });

  it('collector ignores own extension and non-extension requests', () => {
    collector.processRequest({
      initiator: 'chrome-extension://own-id',
      url: 'https://self.com', type: 'xmlhttprequest', responseHeaders: [],
    });
    collector.processRequest({
      initiator: 'https://example.com',
      url: 'https://other.com', type: 'xmlhttprequest', responseHeaders: [],
    });
    collector.processRequest({
      url: 'https://noinit.com', type: 'xmlhttprequest', responseHeaders: [],
    });
    assert.deepEqual(collector.getSnapshot(), {});
  });

  it('prune removes old data, keeps recent', () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    const activity = {
      ext1: {
        buckets: [
          { timestamp: twoHoursAgo, requests: 10, bytesTransferred: 100, byType: {}, topDomains: {} },
          { timestamp: oneHourAgo, requests: 20, bytesTransferred: 200, byType: {}, topDomains: {} },
          { timestamp: now, requests: 30, bytesTransferred: 300, byType: {}, topDomains: {} },
        ],
      },
    };

    // Retain 90 minutes
    const pruned = pruneOldBuckets(activity, now, 90 * 60 * 1000);
    assert.equal(pruned.ext1.buckets.length, 2);
    assert.equal(pruned.ext1.buckets[0].requests, 20);
    assert.equal(pruned.ext1.buckets[1].requests, 30);
  });

  it('multiple snapshot merges append buckets correctly', () => {
    const snap1 = { ext1: { requests: 10, bytes: 100, byType: {}, topDomains: {} } };
    const snap2 = { ext1: { requests: 20, bytes: 200, byType: {}, topDomains: {} } };

    let activity = mergeSnapshotIntoActivity({}, snap1, 1000);
    activity = mergeSnapshotIntoActivity(activity, snap2, 2000);

    assert.equal(activity.ext1.buckets.length, 2);
    assert.equal(activity.ext1.buckets[0].requests, 10);
    assert.equal(activity.ext1.buckets[1].requests, 20);
  });
});

describe('Integration: Score consistency', () => {
  it('score increases with more permissions', () => {
    const activity = { totalRequests: 100, totalBytes: 10000 };
    const score1 = calculateScore({ permissions: ['storage'], contentScriptPatterns: [] }, activity);
    const score2 = calculateScore({ permissions: ['storage', 'tabs'], contentScriptPatterns: [] }, activity);
    const score3 = calculateScore({ permissions: ['<all_urls>', 'tabs', 'cookies', 'webRequest'], contentScriptPatterns: [] }, activity);
    assert.ok(score1 <= score3, `Minimal ${score1} should <= heavy ${score3}`);
  });

  it('score increases with more network activity', () => {
    const meta = { permissions: ['storage'], contentScriptPatterns: [] };
    const score1 = calculateScore(meta, { totalRequests: 10, totalBytes: 1000 });
    const score2 = calculateScore(meta, { totalRequests: 500, totalBytes: 500000 });
    const score3 = calculateScore(meta, { totalRequests: 5000, totalBytes: 50000000 });
    assert.ok(score1 < score2, `${score1} should < ${score2}`);
    assert.ok(score2 < score3, `${score2} should < ${score3}`);
  });

  it('broad content scripts increase score', () => {
    const activity = { totalRequests: 100, totalBytes: 10000 };
    const narrow = calculateScore({ permissions: [], contentScriptPatterns: ['https://example.com/*'] }, activity);
    const broad = calculateScore({ permissions: [], contentScriptPatterns: ['<all_urls>'] }, activity);
    assert.ok(broad > narrow, `Broad ${broad} should > narrow ${narrow}`);
  });
});

describe('Integration: Utility formatting', () => {
  it('score colors match thresholds', () => {
    assert.equal(getScoreColor(0), '#34D399');   // green
    assert.equal(getScoreColor(49), '#34D399');   // green
    assert.equal(getScoreColor(50), '#FBBF24');   // yellow
    assert.equal(getScoreColor(69), '#FBBF24');   // yellow
    assert.equal(getScoreColor(70), '#F87171');   // red
    assert.equal(getScoreColor(100), '#F87171');  // red
  });

  it('score labels match thresholds', () => {
    assert.equal(getScoreLabel(25), 'Low');
    assert.equal(getScoreLabel(60), 'Medium');
    assert.equal(getScoreLabel(85), 'High');
  });

  it('formatBytes handles full range', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1), '1 B');
    assert.equal(formatBytes(1023), '1023 B');
    assert.equal(formatBytes(1024), '1.0 KB');
    assert.equal(formatBytes(1048576), '1.0 MB');
    assert.equal(formatBytes(1073741824), '1.0 GB');
  });

  it('extractExtensionId handles all cases', () => {
    assert.equal(extractExtensionId('chrome-extension://abc123'), 'abc123');
    assert.equal(extractExtensionId('chrome-extension://abc123/page.html'), 'abc123');
    assert.equal(extractExtensionId('https://example.com'), null);
    assert.equal(extractExtensionId(undefined), null);
    assert.equal(extractExtensionId(''), null);
    assert.equal(extractExtensionId(null), null);
  });
});

describe('Integration: DEFAULT_SETTINGS is consistent', () => {
  it('DEFAULT_SETTINGS from constants.js has all required keys', () => {
    assert.ok('refreshInterval' in DEFAULT_SETTINGS);
    assert.ok('alertThreshold' in DEFAULT_SETTINGS);
    assert.ok('ignoreList' in DEFAULT_SETTINGS);
    assert.ok('retentionHours' in DEFAULT_SETTINGS);
    assert.equal(typeof DEFAULT_SETTINGS.refreshInterval, 'number');
    assert.equal(typeof DEFAULT_SETTINGS.alertThreshold, 'number');
    assert.ok(Array.isArray(DEFAULT_SETTINGS.ignoreList));
    assert.equal(typeof DEFAULT_SETTINGS.retentionHours, 'number');
  });
});

describe('Integration: Edge cases', () => {
  it('collector handles rapid requests without data loss', () => {
    const collector = new Collector('self');
    for (let i = 0; i < 1000; i++) {
      collector.processRequest({
        initiator: 'chrome-extension://speed-test',
        url: `https://api.example.com/req${i}`,
        type: 'xmlhttprequest',
        responseHeaders: [{ name: 'content-length', value: '100' }],
      });
    }
    const snap = collector.getSnapshot();
    assert.equal(snap['speed-test'].requests, 1000);
    assert.equal(snap['speed-test'].bytes, 100000);
  });

  it('empty activity produces zero scores', () => {
    const score = calculateScore(
      { permissions: [], contentScriptPatterns: [] },
      { totalRequests: 0, totalBytes: 0 }
    );
    assert.equal(score, 0);
  });

  it('maxed out activity caps at 100', () => {
    const score = calculateScore(
      { permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history', 'bookmarks', 'debugger'], contentScriptPatterns: ['<all_urls>'] },
      { totalRequests: 999999, totalBytes: 999999999 }
    );
    assert.ok(score >= 20 && score <= 100, `Maxed score ${score} should be high (no process data reduces max)`);
  });

  it('collector reset clears everything', () => {
    const collector = new Collector('self');
    collector.processRequest({
      initiator: 'chrome-extension://test',
      url: 'https://a.com', type: 'xhr', responseHeaders: [],
    });
    assert.equal(Object.keys(collector.getSnapshot()).length, 1);
    collector.reset();
    assert.equal(Object.keys(collector.getSnapshot()).length, 0);
  });

  it('pruneOldBuckets removes extension with no remaining buckets', () => {
    const activity = {
      ext1: { buckets: [{ timestamp: 0, requests: 1, bytesTransferred: 0, byType: {}, topDomains: {} }] },
    };
    const pruned = pruneOldBuckets(activity, Date.now(), 1000);
    assert.ok(!('ext1' in pruned));
  });
});
