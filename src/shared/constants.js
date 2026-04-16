const SENSITIVE_PERMISSIONS = [
  '<all_urls>',
  'tabs',
  'webRequest',
  'webRequestBlocking',
  'cookies',
  'history',
  'bookmarks',
  'debugger',
  'clipboardRead',
  'clipboardWrite',
  'nativeMessaging',
];

const SCORE_WEIGHTS = {
  networkFrequency: 0.30,
  dataVolume: 0.20,
  permissions: 0.25,
  scope: 0.25,
};

const SCORE_THRESHOLDS = {
  GREEN: 50,
  YELLOW: 70,
  RED: 70,
};

const COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceHover: '#334155',
  foreground: '#F8FAFC',
  muted: '#272F42',
  border: '#475569',
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#EF4444',
  accent: '#22C55E',
  chartLine: '#3B82F6',
};

const DEFAULT_SETTINGS = {
  refreshInterval: 30,
  alertThreshold: 70,
  ignoreList: [],
  retentionHours: 24,
};

const BUCKET_INTERVAL_MS = 15 * 60 * 1000;

if (typeof module !== 'undefined') {
  module.exports = {
    SENSITIVE_PERMISSIONS,
    SCORE_WEIGHTS,
    SCORE_THRESHOLDS,
    COLORS,
    DEFAULT_SETTINGS,
    BUCKET_INTERVAL_MS,
  };
}
