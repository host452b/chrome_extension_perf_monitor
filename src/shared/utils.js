const SCORE_GREEN = 50;
const SCORE_YELLOW = 70;
const COLOR_GREEN = '#34D399';
const COLOR_YELLOW = '#FBBF24';
const COLOR_RED = '#F87171';
const BUCKET_MS = 15 * 60 * 1000;

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function formatNumber(n) {
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(1)}M`;
}

function getScoreColor(score) {
  if (score < SCORE_GREEN) return COLOR_GREEN;
  if (score < SCORE_YELLOW) return COLOR_YELLOW;
  return COLOR_RED;
}

function getScoreLabel(score) {
  if (score < SCORE_GREEN) return 'Low';
  if (score < SCORE_YELLOW) return 'Medium';
  return 'High';
}

function getBucketKey(timestamp) {
  return Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;
}

function extractExtensionId(initiator) {
  if (!initiator) return null;
  const prefix = 'chrome-extension://';
  if (!initiator.startsWith(prefix)) return null;
  return initiator.slice(prefix.length).split('/')[0];
}

if (typeof module !== 'undefined') {
  module.exports = {
    formatBytes,
    formatNumber,
    getScoreColor,
    getScoreLabel,
    getBucketKey,
    extractExtensionId,
  };
}
