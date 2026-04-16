/**
 * Risk Score (0-100) — purely static analysis, no estimation tricks.
 *
 * Two dimensions:
 *   Permission Risk (60%): sensitive permission count × 2, others × 0.5
 *   Injection Scope (40%): how broadly content scripts are declared
 *
 * These are facts from the manifest, not guesses. Score never drifts.
 */

const _SENSITIVE_PERMISSIONS = (typeof SENSITIVE_PERMISSIONS !== 'undefined')
  ? SENSITIVE_PERMISSIONS
  : [
    '<all_urls>', 'tabs', 'webRequest', 'webRequestBlocking',
    'cookies', 'history', 'bookmarks', 'debugger',
    'clipboardRead', 'clipboardWrite', 'nativeMessaging',
  ];

const MAX_PERMISSION_SCORE = 15;
const MAX_SCOPE_SCORE = 5;

function normalizeValue(value, max) {
  if (max === 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function calculatePermissionRisk(permissions) {
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
 * Calculate risk score 0-100. Pure static analysis.
 * @param {Object} meta - { permissions: string[], contentScriptPatterns: string[] }
 * @returns {number}
 */
function calculateScore(meta) {
  const permScore = normalizeValue(calculatePermissionRisk(meta.permissions), MAX_PERMISSION_SCORE);
  const scopeScore = normalizeValue(calculateScopeScore(meta.contentScriptPatterns), MAX_SCOPE_SCORE);
  const raw = permScore * 0.60 + scopeScore * 0.40;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

if (typeof module !== 'undefined') {
  module.exports = { calculateScore, normalizeValue, calculatePermissionRisk, calculateScopeScore };
}
