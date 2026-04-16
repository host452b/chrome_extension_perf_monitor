const STORAGE_KEY_ACTIVITY = 'activity';
const STORAGE_KEY_EXTENSIONS = 'extensions';
const STORAGE_KEY_SETTINGS = 'settings';

// DEFAULT_SETTINGS is always available from constants.js (loaded before this file)
// Fallback only needed if somehow loaded standalone
const _DEFAULTS = (typeof DEFAULT_SETTINGS !== 'undefined')
  ? DEFAULT_SETTINGS
  : { refreshInterval: 30, alertThreshold: 70, ignoreList: [], retentionHours: 24 };

async function getActivity() {
  const result = await chrome.storage.local.get(STORAGE_KEY_ACTIVITY);
  return result[STORAGE_KEY_ACTIVITY] || {};
}

async function saveActivity(activity) {
  await chrome.storage.local.set({ [STORAGE_KEY_ACTIVITY]: activity });
}

async function getExtensions() {
  const result = await chrome.storage.local.get(STORAGE_KEY_EXTENSIONS);
  return result[STORAGE_KEY_EXTENSIONS] || {};
}

async function saveExtensions(extensions) {
  await chrome.storage.local.set({ [STORAGE_KEY_EXTENSIONS]: extensions });
}

async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  return { ..._DEFAULTS, ...result[STORAGE_KEY_SETTINGS] };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings });
}

async function getAllData() {
  const result = await chrome.storage.local.get([
    STORAGE_KEY_ACTIVITY,
    STORAGE_KEY_EXTENSIONS,
    STORAGE_KEY_SETTINGS,
  ]);
  return {
    activity: result[STORAGE_KEY_ACTIVITY] || {},
    extensions: result[STORAGE_KEY_EXTENSIONS] || {},
    settings: { ..._DEFAULTS, ...result[STORAGE_KEY_SETTINGS] },
  };
}
