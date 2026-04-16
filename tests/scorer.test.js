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
  it('returns 0 for extension with no activity, no permissions, no process', () => {
    const meta = { permissions: [], contentScriptPatterns: [] };
    const activity = { totalRequests: 0, totalBytes: 0 };
    assert.equal(calculateScore(meta, activity), 0);
  });

  it('returns higher score when CPU/memory data is provided', () => {
    const meta = { permissions: ['storage'], contentScriptPatterns: [] };
    const activity = { totalRequests: 0, totalBytes: 0 };
    const scoreWithout = calculateScore(meta, activity);
    const scoreWith = calculateScore(meta, activity, { cpu: 10, memory: 50 * 1024 * 1024 });
    assert.ok(scoreWith > scoreWithout, `With process ${scoreWith} should > without ${scoreWithout}`);
  });

  it('CPU-heavy extension gets high score', () => {
    const meta = { permissions: [], contentScriptPatterns: [] };
    const activity = { totalRequests: 0, totalBytes: 0 };
    const score = calculateScore(meta, activity, { cpu: 30, memory: 100 * 1024 * 1024 });
    assert.ok(score >= 40, `CPU-heavy score ${score} should be >= 40`);
  });

  it('returns high score for broad permissions + heavy process', () => {
    const meta = {
      permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history'],
      contentScriptPatterns: ['<all_urls>'],
    };
    const activity = { totalRequests: 5000, totalBytes: 50 * 1024 * 1024 };
    const score = calculateScore(meta, activity, { cpu: 20, memory: 150 * 1024 * 1024 });
    assert.ok(score >= 70, `Expected >= 70, got ${score}`);
  });

  it('returns low score for extension with minimal everything', () => {
    const meta = { permissions: ['storage'], contentScriptPatterns: [] };
    const activity = { totalRequests: 5, totalBytes: 1024 };
    const score = calculateScore(meta, activity);
    assert.ok(score < 15, `Expected < 15, got ${score}`);
  });

  it('sensitive permissions increase score vs non-sensitive', () => {
    const activity = { totalRequests: 100, totalBytes: 10240 };
    const metaSensitive = { permissions: ['<all_urls>', 'tabs', 'cookies'], contentScriptPatterns: [] };
    const metaNormal = { permissions: ['storage', 'alarms', 'notifications'], contentScriptPatterns: [] };
    assert.ok(calculateScore(metaSensitive, activity) > calculateScore(metaNormal, activity));
  });

  it('content script scope increases score', () => {
    const activity = { totalRequests: 100, totalBytes: 10240 };
    const metaBroad = { permissions: ['storage'], contentScriptPatterns: ['<all_urls>'] };
    const metaNarrow = { permissions: ['storage'], contentScriptPatterns: ['https://example.com/*'] };
    assert.ok(calculateScore(metaBroad, activity) > calculateScore(metaNarrow, activity));
  });

  it('score is always between 0 and 100', () => {
    const meta = {
      permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history', 'bookmarks', 'debugger'],
      contentScriptPatterns: ['<all_urls>', 'http://*/*', 'https://*/*'],
    };
    const activity = { totalRequests: 999999, totalBytes: 999999999 };
    const score = calculateScore(meta, activity, { cpu: 100, memory: 500 * 1024 * 1024 });
    assert.ok(score >= 0 && score <= 100, `Score ${score} out of range`);
  });
});
