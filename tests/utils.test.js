const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatBytes,
  formatNumber,
  getScoreColor,
  getScoreLabel,
  getBucketKey,
  extractExtensionId,
} = require('../src/shared/utils.js');

describe('formatBytes', () => {
  it('formats 0 bytes', () => assert.equal(formatBytes(0), '0 B'));
  it('formats bytes', () => assert.equal(formatBytes(500), '500 B'));
  it('formats kilobytes', () => assert.equal(formatBytes(1024), '1.0 KB'));
  it('formats megabytes', () => assert.equal(formatBytes(1048576), '1.0 MB'));
  it('formats gigabytes', () => assert.equal(formatBytes(1073741824), '1.0 GB'));
  it('formats with decimals', () => assert.equal(formatBytes(1536), '1.5 KB'));
});

describe('formatNumber', () => {
  it('formats small numbers as-is', () => assert.equal(formatNumber(42), '42'));
  it('formats thousands with K', () => assert.equal(formatNumber(1500), '1.5K'));
  it('formats millions with M', () => assert.equal(formatNumber(2500000), '2.5M'));
  it('formats exact thousands', () => assert.equal(formatNumber(1000), '1.0K'));
});

describe('getScoreColor', () => {
  it('returns green for low scores', () => assert.equal(getScoreColor(30), '#34D399'));
  it('returns yellow for medium scores', () => assert.equal(getScoreColor(60), '#FBBF24'));
  it('returns red for high scores', () => assert.equal(getScoreColor(85), '#F87171'));
  it('returns green for 0', () => assert.equal(getScoreColor(0), '#34D399'));
  it('returns red for 100', () => assert.equal(getScoreColor(100), '#F87171'));
});

describe('getScoreLabel', () => {
  it('returns Low for green range', () => assert.equal(getScoreLabel(30), 'Low'));
  it('returns Medium for yellow range', () => assert.equal(getScoreLabel(60), 'Medium'));
  it('returns High for red range', () => assert.equal(getScoreLabel(85), 'High'));
});

describe('getBucketKey', () => {
  it('rounds down to 15-minute boundary', () => {
    const ts = new Date(2026, 0, 1, 10, 7, 30).getTime();
    const bucket = getBucketKey(ts);
    const expected = new Date(2026, 0, 1, 10, 0, 0).getTime();
    assert.equal(bucket, expected);
  });
  it('exact boundary stays the same', () => {
    const ts = new Date(2026, 0, 1, 10, 15, 0).getTime();
    assert.equal(getBucketKey(ts), ts);
  });
});

describe('extractExtensionId', () => {
  it('extracts ID from chrome-extension:// URL', () =>
    assert.equal(extractExtensionId('chrome-extension://abcdefghijklmnop'), 'abcdefghijklmnop'));
  it('returns null for non-extension URL', () =>
    assert.equal(extractExtensionId('https://example.com'), null));
  it('returns null for undefined', () => assert.equal(extractExtensionId(undefined), null));
  it('returns null for empty string', () => assert.equal(extractExtensionId(''), null));
});
