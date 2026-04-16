const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  SENSITIVE_PERMISSIONS,
  SCORE_THRESHOLDS,
  SCORE_WEIGHTS,
  COLORS,
  DEFAULT_SETTINGS,
  BUCKET_INTERVAL_MS,
} = require('../src/shared/constants.js');

describe('constants', () => {
  it('SENSITIVE_PERMISSIONS is a non-empty array of strings', () => {
    assert.ok(Array.isArray(SENSITIVE_PERMISSIONS));
    assert.ok(SENSITIVE_PERMISSIONS.length > 0);
    SENSITIVE_PERMISSIONS.forEach(p => assert.equal(typeof p, 'string'));
  });

  it('SCORE_WEIGHTS sum to 1.0', () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Weights sum to ${sum}, expected 1.0`);
  });

  it('SCORE_THRESHOLDS has green < yellow < red', () => {
    assert.ok(SCORE_THRESHOLDS.GREEN < SCORE_THRESHOLDS.YELLOW);
    assert.ok(SCORE_THRESHOLDS.YELLOW <= SCORE_THRESHOLDS.RED);
  });

  it('DEFAULT_SETTINGS has required keys', () => {
    assert.ok('refreshInterval' in DEFAULT_SETTINGS);
    assert.ok('alertThreshold' in DEFAULT_SETTINGS);
    assert.ok('ignoreList' in DEFAULT_SETTINGS);
    assert.ok('retentionHours' in DEFAULT_SETTINGS);
  });

  it('BUCKET_INTERVAL_MS is 15 minutes', () => {
    assert.equal(BUCKET_INTERVAL_MS, 15 * 60 * 1000);
  });
});
