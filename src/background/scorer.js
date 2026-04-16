const _SENSITIVE_PERMISSIONS = (typeof SENSITIVE_PERMISSIONS !== 'undefined')
  ? SENSITIVE_PERMISSIONS
  : [
    '<all_urls>', 'tabs', 'webRequest', 'webRequestBlocking',
    'cookies', 'history', 'bookmarks', 'debugger',
    'clipboardRead', 'clipboardWrite', 'nativeMessaging',
  ];

// Reference maximums for normalization
const MAX_CPU = 25;                      // 25% of one core is heavy for an extension
const MAX_MEMORY = 200 * 1024 * 1024;   // 200 MB
const MAX_REQUESTS_PER_HOUR = 2000;
const MAX_BYTES_PER_HOUR = 20 * 1024 * 1024;
const MAX_PERMISSION_SCORE = 15;
const MAX_SCOPE_SCORE = 5;

// Weights — CPU & memory are primary, network & permissions secondary
const WEIGHTS = {
  cpu: 0.35,
  memory: 0.25,
  networkFrequency: 0.10,
  dataVolume: 0.05,
  permissions: 0.15,
  scope: 0.10,
};

function normalizeValue(value, max) {
  if (max === 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function calculatePermissionScore(permissions) {
  let score = 0;
  for (const perm of permissions) {
    score += _SENSITIVE_PERMISSIONS.includes(perm) ? 2 : 0.5;
  }
  return score;
}

function calculateScopeScore(contentScriptPatterns) {
  if (contentScriptPatterns.length === 0) return 0;
  const hasBroadPattern = contentScriptPatterns.some(p =>
    p === '<all_urls>' || p === 'http://*/*' || p === 'https://*/*' || p === '*://*/*'
  );
  if (hasBroadPattern) return MAX_SCOPE_SCORE;
  return Math.min(contentScriptPatterns.length, MAX_SCOPE_SCORE);
}

/**
 * Calculate impact score 0-100.
 * @param {Object} meta - { permissions, contentScriptPatterns }
 * @param {Object} activity - { totalRequests, totalBytes }
 * @param {Object} [process] - { cpu, memory } from chrome.processes (optional)
 */
function calculateScore(meta, activity, process) {
  const cpuScore = process ? normalizeValue(process.cpu, MAX_CPU) : 0;
  const memScore = process ? normalizeValue(process.memory, MAX_MEMORY) : 0;
  const netFreq = normalizeValue(activity.totalRequests, MAX_REQUESTS_PER_HOUR);
  const dataVol = normalizeValue(activity.totalBytes, MAX_BYTES_PER_HOUR);
  const permScore = normalizeValue(calculatePermissionScore(meta.permissions), MAX_PERMISSION_SCORE);
  const scopeScore = normalizeValue(calculateScopeScore(meta.contentScriptPatterns), MAX_SCOPE_SCORE);

  const raw =
    cpuScore * WEIGHTS.cpu +
    memScore * WEIGHTS.memory +
    netFreq * WEIGHTS.networkFrequency +
    dataVol * WEIGHTS.dataVolume +
    permScore * WEIGHTS.permissions +
    scopeScore * WEIGHTS.scope;

  return Math.min(100, Math.max(0, Math.round(raw)));
}

if (typeof module !== 'undefined') {
  module.exports = { calculateScore, normalizeValue };
}
