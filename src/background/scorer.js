const _SENSITIVE_PERMISSIONS = (typeof SENSITIVE_PERMISSIONS !== 'undefined')
  ? SENSITIVE_PERMISSIONS
  : [
    '<all_urls>', 'tabs', 'webRequest', 'webRequestBlocking',
    'cookies', 'history', 'bookmarks', 'debugger',
    'clipboardRead', 'clipboardWrite', 'nativeMessaging',
  ];

const MAX_REQUESTS_PER_HOUR = 2000;
const MAX_BYTES_PER_HOUR = 20 * 1024 * 1024;
const MAX_PERMISSION_SCORE = 15;
const MAX_SCOPE_SCORE = 5;

const WEIGHTS = {
  networkFrequency: 0.30,
  dataVolume: 0.20,
  permissions: 0.25,
  scope: 0.25,
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

function calculateScore(meta, activity) {
  const netFreq = normalizeValue(activity.totalRequests, MAX_REQUESTS_PER_HOUR);
  const dataVol = normalizeValue(activity.totalBytes, MAX_BYTES_PER_HOUR);
  const permScore = normalizeValue(calculatePermissionScore(meta.permissions), MAX_PERMISSION_SCORE);
  const scopeScore = normalizeValue(calculateScopeScore(meta.contentScriptPatterns), MAX_SCOPE_SCORE);

  const raw =
    netFreq * WEIGHTS.networkFrequency +
    dataVol * WEIGHTS.dataVolume +
    permScore * WEIGHTS.permissions +
    scopeScore * WEIGHTS.scope;

  return Math.min(100, Math.max(0, Math.round(raw)));
}

if (typeof module !== 'undefined') {
  module.exports = { calculateScore, normalizeValue };
}
