const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { ResourceEstimator, CONTENT_SCRIPT_PER_TAB_BYTES, BACKGROUND_WORKER_BYTES } = require('../src/background/estimator.js');

describe('ResourceEstimator', () => {
  let est;

  beforeEach(() => {
    est = new ResourceEstimator('own-id');
    // Simulate tab URLs (normally from chrome.tabs.query)
    est._tabUrls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://other.com/x',
      'https://docs.google.com/doc',
      'chrome://extensions/',
    ];
  });

  describe('tab matching', () => {
    it('matches <all_urls> to all http/https tabs', () => {
      const count = est._countMatchingTabs(['<all_urls>']);
      assert.equal(count, 4); // 4 http tabs, excludes chrome://
    });

    it('matches specific domain pattern', () => {
      const count = est._countMatchingTabs(['https://example.com/*']);
      assert.equal(count, 2);
    });

    it('returns 0 for empty patterns', () => {
      assert.equal(est._countMatchingTabs([]), 0);
    });

    it('matches *://*/* as broad', () => {
      const count = est._countMatchingTabs(['*://*/*']);
      assert.equal(count, 4);
    });
  });

  describe('request frequency', () => {
    it('returns 0 with no timestamps', () => {
      assert.equal(est._getRequestFrequency('ext1'), 0);
    });

    it('calculates requests per minute', () => {
      const now = Date.now();
      // 10 requests over 1 minute
      for (let i = 0; i < 10; i++) {
        est.recordRequest('ext1', now - 60000 + i * 6000);
      }
      const rpm = est._getRequestFrequency('ext1');
      assert.ok(rpm >= 8 && rpm <= 12, `Expected ~10 rpm, got ${rpm}`);
    });
  });

  describe('polling detection', () => {
    it('detects regular intervals as polling', () => {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        est.recordRequest('ext1', now - 100000 + i * 10000); // every 10s
      }
      assert.equal(est._isPolling('ext1'), true);
    });

    it('rejects irregular intervals as non-polling', () => {
      const now = Date.now();
      const irregular = [0, 500, 800, 15000, 15200, 60000, 61000];
      for (const offset of irregular) {
        est.recordRequest('ext2', now - 120000 + offset);
      }
      assert.equal(est._isPolling('ext2'), false);
    });

    it('requires at least 4 timestamps', () => {
      const now = Date.now();
      est.recordRequest('ext3', now - 20000);
      est.recordRequest('ext3', now - 10000);
      assert.equal(est._isPolling('ext3'), false);
    });
  });

  describe('estimate', () => {
    it('disabled extension has zero estimates', () => {
      const result = est.estimate('ext1', { enabled: false, contentScriptPatterns: [], permissions: [] }, { totalRequests: 0, totalBytes: 0 });
      assert.equal(result.estMemory, 0);
      assert.equal(result.estCpu, 0);
    });

    it('extension with broad content scripts and many tabs has high memory', () => {
      const result = est.estimate('ext1',
        { enabled: true, contentScriptPatterns: ['<all_urls>'], permissions: ['storage'] },
        { totalRequests: 0, totalBytes: 0 }
      );
      // 4 matching tabs × 4MB + 15MB background = ~31MB
      const expected = BACKGROUND_WORKER_BYTES + 4 * CONTENT_SCRIPT_PER_TAB_BYTES;
      assert.ok(Math.abs(result.estMemory - expected) < 1024 * 1024, `Expected ~${expected}, got ${result.estMemory}`);
      assert.equal(result.matchingTabs, 4);
    });

    it('extension with no content scripts has only baseline memory', () => {
      const result = est.estimate('ext1',
        { enabled: true, contentScriptPatterns: [], permissions: ['storage'] },
        { totalRequests: 0, totalBytes: 0 }
      );
      assert.equal(result.estMemory, BACKGROUND_WORKER_BYTES);
      assert.equal(result.matchingTabs, 0);
    });

    it('high request frequency increases CPU estimate', () => {
      const now = Date.now();
      for (let i = 0; i < 60; i++) {
        est.recordRequest('ext1', now - 60000 + i * 1000); // 1 req/sec = 60 rpm
      }
      const result = est.estimate('ext1',
        { enabled: true, contentScriptPatterns: [], permissions: [] },
        { totalRequests: 60, totalBytes: 0 }
      );
      assert.ok(result.estCpu >= 30, `High-frequency CPU estimate ${result.estCpu} should be >= 30`);
      assert.ok(result.reqPerMin >= 50, `RPM ${result.reqPerMin} should be >= 50`);
    });

    it('network bytes add to memory estimate via cache factor', () => {
      const result = est.estimate('ext1',
        { enabled: true, contentScriptPatterns: [], permissions: [] },
        { totalRequests: 100, totalBytes: 10 * 1024 * 1024 }
      );
      // 15MB background + 10MB * 0.3 cache = ~18MB
      assert.ok(result.estMemory > BACKGROUND_WORKER_BYTES, 'Network bytes should increase memory');
    });

    it('estCpu is capped at 100', () => {
      est._tabUrls = Array(100).fill('https://example.com/page');
      const now = Date.now();
      for (let i = 0; i < 200; i++) {
        est.recordRequest('ext1', now - 60000 + i * 300);
      }
      const result = est.estimate('ext1',
        { enabled: true, contentScriptPatterns: ['<all_urls>'], permissions: [] },
        { totalRequests: 200, totalBytes: 0 }
      );
      assert.ok(result.estCpu <= 100, `CPU ${result.estCpu} should be <= 100`);
    });
  });
});
