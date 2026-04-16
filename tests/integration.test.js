/**
 * Integration tests — verify module interop and scoring consistency.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { SENSITIVE_PERMISSIONS, DEFAULT_SETTINGS } = require('../src/shared/constants.js');
const { formatBytes, formatNumber, getScoreColor, getScoreLabel } = require('../src/shared/utils.js');
const { calculateScore } = require('../src/background/scorer.js');

describe('Integration: Score consistency', () => {
  it('more sensitive permissions → higher score', () => {
    const s1 = calculateScore({ permissions: ['storage'], contentScriptPatterns: [] });
    const s2 = calculateScore({ permissions: ['<all_urls>', 'tabs', 'cookies'], contentScriptPatterns: [] });
    const s3 = calculateScore({
      permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history', 'bookmarks'],
      contentScriptPatterns: [],
    });
    assert.ok(s1 < s2, `${s1} should < ${s2}`);
    assert.ok(s2 < s3, `${s2} should < ${s3}`);
  });

  it('broader scope → higher score', () => {
    const narrow = calculateScore({ permissions: [], contentScriptPatterns: ['https://example.com/*'] });
    const broad = calculateScore({ permissions: [], contentScriptPatterns: ['<all_urls>'] });
    assert.ok(broad > narrow, `Broad ${broad} should > narrow ${narrow}`);
  });

  it('permissions + scope compound', () => {
    const permsOnly = calculateScore({ permissions: ['<all_urls>', 'tabs'], contentScriptPatterns: [] });
    const both = calculateScore({ permissions: ['<all_urls>', 'tabs'], contentScriptPatterns: ['<all_urls>'] });
    assert.ok(both > permsOnly, `Both ${both} should > permsOnly ${permsOnly}`);
  });

  it('score is deterministic across multiple calls', () => {
    const meta = { permissions: ['tabs', 'cookies', '<all_urls>'], contentScriptPatterns: ['https://*.google.com/*'] };
    const scores = [calculateScore(meta), calculateScore(meta), calculateScore(meta)];
    assert.equal(scores[0], scores[1]);
    assert.equal(scores[1], scores[2]);
  });

  it('empty extension scores 0', () => {
    assert.equal(calculateScore({ permissions: [], contentScriptPatterns: [] }), 0);
  });

  it('maxed out extension scores high', () => {
    const score = calculateScore({
      permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history', 'bookmarks', 'debugger'],
      contentScriptPatterns: ['<all_urls>'],
    });
    assert.ok(score >= 80, `Maxed score ${score} should be >= 80`);
  });
});

describe('Integration: Score colors match thresholds', () => {
  it('score colors', () => {
    assert.equal(getScoreColor(0), '#34D399');
    assert.equal(getScoreColor(49), '#34D399');
    assert.equal(getScoreColor(50), '#FBBF24');
    assert.equal(getScoreColor(69), '#FBBF24');
    assert.equal(getScoreColor(70), '#F87171');
    assert.equal(getScoreColor(100), '#F87171');
  });

  it('score labels', () => {
    assert.equal(getScoreLabel(25), 'Low');
    assert.equal(getScoreLabel(60), 'Medium');
    assert.equal(getScoreLabel(85), 'High');
  });
});

describe('Integration: Utility formatting', () => {
  it('formatBytes full range', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1023), '1023 B');
    assert.equal(formatBytes(1024), '1.0 KB');
    assert.equal(formatBytes(1048576), '1.0 MB');
    assert.equal(formatBytes(1073741824), '1.0 GB');
  });

  it('formatNumber', () => {
    assert.equal(formatNumber(42), '42');
    assert.equal(formatNumber(1500), '1.5K');
    assert.equal(formatNumber(2500000), '2.5M');
  });
});

describe('Integration: Constants integrity', () => {
  it('SENSITIVE_PERMISSIONS is non-empty', () => {
    assert.ok(SENSITIVE_PERMISSIONS.length >= 8);
  });

  it('DEFAULT_SETTINGS has required keys', () => {
    assert.ok('alertThreshold' in DEFAULT_SETTINGS);
    assert.ok('ignoreList' in DEFAULT_SETTINGS);
  });
});
