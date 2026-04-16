const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateScore, normalizeValue, calculatePermissionRisk, calculateScopeScore } = require('../src/background/scorer.js');

describe('normalizeValue', () => {
  it('returns 0 for 0', () => assert.equal(normalizeValue(0, 100), 0));
  it('returns 100 at max', () => assert.equal(normalizeValue(100, 100), 100));
  it('caps at 100', () => assert.equal(normalizeValue(200, 100), 100));
  it('proportional', () => assert.equal(normalizeValue(50, 100), 50));
});

describe('calculatePermissionRisk', () => {
  it('sensitive perms score 2 each', () => {
    assert.equal(calculatePermissionRisk(['<all_urls>', 'cookies']), 4);
  });
  it('normal perms score 0.5 each', () => {
    assert.equal(calculatePermissionRisk(['storage', 'alarms']), 1);
  });
  it('mixed', () => {
    assert.equal(calculatePermissionRisk(['<all_urls>', 'storage']), 2.5);
  });
  it('empty', () => {
    assert.equal(calculatePermissionRisk([]), 0);
  });
});

describe('calculateScopeScore', () => {
  it('no patterns = 0', () => assert.equal(calculateScopeScore([]), 0));
  it('<all_urls> = max', () => assert.equal(calculateScopeScore(['<all_urls>']), 5));
  it('specific patterns = count capped at 5', () => {
    assert.equal(calculateScopeScore(['https://a.com/*', 'https://b.com/*']), 2);
  });
});

describe('calculateScore', () => {
  it('returns 0 for no permissions and no scope', () => {
    assert.equal(calculateScore({ permissions: [], contentScriptPatterns: [] }), 0);
  });

  it('high score for broad permissions + all_urls scope', () => {
    const score = calculateScore({
      permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history'],
      contentScriptPatterns: ['<all_urls>'],
    });
    assert.ok(score >= 60, `Expected >= 60, got ${score}`);
  });

  it('low score for minimal permissions', () => {
    const score = calculateScore({ permissions: ['storage'], contentScriptPatterns: [] });
    assert.ok(score < 10, `Expected < 10, got ${score}`);
  });

  it('sensitive perms increase score', () => {
    const s1 = calculateScore({ permissions: ['<all_urls>', 'tabs', 'cookies'], contentScriptPatterns: [] });
    const s2 = calculateScore({ permissions: ['storage', 'alarms'], contentScriptPatterns: [] });
    assert.ok(s1 > s2, `${s1} should > ${s2}`);
  });

  it('broad scope increases score', () => {
    const s1 = calculateScore({ permissions: [], contentScriptPatterns: ['<all_urls>'] });
    const s2 = calculateScore({ permissions: [], contentScriptPatterns: ['https://example.com/*'] });
    assert.ok(s1 > s2, `${s1} should > ${s2}`);
  });

  it('score always 0-100', () => {
    const score = calculateScore({
      permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history', 'bookmarks', 'debugger'],
      contentScriptPatterns: ['<all_urls>'],
    });
    assert.ok(score >= 0 && score <= 100);
  });

  it('score is deterministic — same input = same output', () => {
    const meta = { permissions: ['tabs', 'cookies'], contentScriptPatterns: ['https://example.com/*'] };
    assert.equal(calculateScore(meta), calculateScore(meta));
  });
});
