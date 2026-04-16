const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateScore, normalizeValue } = require('../src/background/scorer.js');

describe('normalizeValue', () => {
  it('returns 0 for 0 value', () => assert.equal(normalizeValue(0, 100), 0));
  it('returns 100 for value at max', () => assert.equal(normalizeValue(100, 100), 100));
  it('caps at 100 for value above max', () => assert.equal(normalizeValue(200, 100), 100));
  it('returns proportional value', () => assert.equal(normalizeValue(50, 100), 50));
});

describe('calculateScore', () => {
  it('returns 0 for no activity and no permissions', () => {
    assert.equal(calculateScore({ permissions: [], contentScriptPatterns: [] }, { totalRequests: 0, totalBytes: 0 }), 0);
  });

  it('returns high score for heavy activity + broad permissions', () => {
    const meta = { permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history'], contentScriptPatterns: ['<all_urls>'] };
    const score = calculateScore(meta, { totalRequests: 5000, totalBytes: 50 * 1024 * 1024 });
    assert.ok(score >= 70, `Expected >= 70, got ${score}`);
  });

  it('returns low score for minimal activity', () => {
    const score = calculateScore({ permissions: ['storage'], contentScriptPatterns: [] }, { totalRequests: 5, totalBytes: 1024 });
    assert.ok(score < 20, `Expected < 20, got ${score}`);
  });

  it('sensitive permissions increase score', () => {
    const activity = { totalRequests: 100, totalBytes: 10240 };
    const s1 = calculateScore({ permissions: ['<all_urls>', 'tabs', 'cookies'], contentScriptPatterns: [] }, activity);
    const s2 = calculateScore({ permissions: ['storage', 'alarms', 'notifications'], contentScriptPatterns: [] }, activity);
    assert.ok(s1 > s2, `${s1} should > ${s2}`);
  });

  it('broad content scripts increase score', () => {
    const activity = { totalRequests: 100, totalBytes: 10240 };
    const broad = calculateScore({ permissions: ['storage'], contentScriptPatterns: ['<all_urls>'] }, activity);
    const narrow = calculateScore({ permissions: ['storage'], contentScriptPatterns: ['https://example.com/*'] }, activity);
    assert.ok(broad > narrow, `${broad} should > ${narrow}`);
  });

  it('score always 0-100', () => {
    const meta = { permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history', 'bookmarks', 'debugger'], contentScriptPatterns: ['<all_urls>'] };
    const score = calculateScore(meta, { totalRequests: 999999, totalBytes: 999999999 });
    assert.ok(score >= 0 && score <= 100);
  });

  it('permissions-only score is non-zero even without network activity', () => {
    const meta = { permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies'], contentScriptPatterns: ['<all_urls>'] };
    const score = calculateScore(meta, { totalRequests: 0, totalBytes: 0 });
    assert.ok(score > 0, `Permissions-only score should be > 0, got ${score}`);
  });
});
