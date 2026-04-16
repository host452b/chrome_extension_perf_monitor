# Extension Perf Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that monitors all other extensions' network activity, calculates impact scores, and presents the data in a dark-mode dashboard via Popup and Side Panel.

**Architecture:** Manifest V3 extension with a background service worker (data collection + aggregation), a popup (quick summary), and a side panel (full dashboard with 3 tabs). All data stays local in `chrome.storage.local`. Pure logic is unit-tested with Node.js built-in test runner; Chrome API integration is manually verified.

**Tech Stack:** Vanilla JS (ES modules for tests, classic scripts for extension), Chart.js for charts, Lucide Icons (SVG), CSS custom properties for theming, Node.js `node:test` for unit tests.

---

## File Structure

```
chrome_extension_perf_monitor/
├── manifest.json                    # Manifest V3 config
├── package.json                     # For test runner only
├── src/
│   ├── background/
│   │   ├── service-worker.js        # Entry point: wires collector, aggregator, scorer
│   │   ├── collector.js             # webRequest listener, in-memory accumulation
│   │   ├── aggregator.js            # Time-bucket creation, storage flush, cleanup
│   │   └── scorer.js                # Impact score calculation (0-100)
│   ├── popup/
│   │   ├── popup.html               # Popup markup
│   │   ├── popup.js                 # Popup logic: read data, render KPIs + top 5
│   │   └── popup.css                # Popup styles (dark theme)
│   ├── sidepanel/
│   │   ├── panel.html               # Side panel markup (3 tabs)
│   │   ├── panel.js                 # Tab routing, data polling
│   │   ├── panel.css                # Side panel styles (dark theme)
│   │   ├── overview.js              # Overview tab: KPI cards, area chart, bar chart
│   │   ├── details.js               # Details tab: search, sort, expandable cards
│   │   └── settings.js              # Settings tab: form, export
│   └── shared/
│       ├── constants.js             # Thresholds, colors, timing, sensitive perms
│       ├── storage.js               # chrome.storage.local read/write helpers
│       └── utils.js                 # formatBytes, formatNumber, scoring helpers
├── assets/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── lib/
│   └── chart.min.js                 # Chart.js v4 UMD bundle
└── tests/
    ├── utils.test.js
    ├── scorer.test.js
    ├── collector.test.js
    └── aggregator.test.js
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `assets/icons/icon16.png`, `assets/icons/icon48.png`, `assets/icons/icon128.png`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Extension Perf Monitor",
  "version": "1.0.0",
  "description": "Monitor all Chrome extensions' resource usage, network activity, and impact scores.",
  "permissions": [
    "management",
    "storage",
    "sidePanel",
    "webRequest",
    "alarms"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js"
  },
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "src/sidepanel/panel.html"
  },
  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  },
  "minimum_chrome_version": "116"
}
```

- [ ] **Step 2: Create package.json for test runner**

```json
{
  "name": "extension-perf-monitor",
  "private": true,
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 3: Generate placeholder icons**

Create simple colored square PNGs at 16x16, 48x48, and 128x128 using a canvas script or any image editor. These are placeholders — the final icons can be designed later.

Run this Node.js script once to generate them:

```js
// generate-icons.js (run once, then delete)
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const dir = path.join(__dirname, 'assets', 'icons');
fs.mkdirSync(dir, { recursive: true });

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  // Dark background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, size, size);
  // Green accent circle
  ctx.fillStyle = '#22C55E';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
  fs.writeFileSync(path.join(dir, `icon${size}.png`), canvas.toBuffer('image/png'));
}
console.log('Icons generated.');
```

If `canvas` npm package is not available, create any 16/48/128 PNG files manually. The extension will load with any valid PNG.

- [ ] **Step 4: Verify extension loads in Chrome**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `chrome_extension_perf_monitor` directory
4. Expected: Extension appears in the list (will show errors about missing files — that's OK for now)

- [ ] **Step 5: Commit**

```bash
git init
git add manifest.json package.json assets/
git commit -m "feat: project scaffolding with manifest v3 and placeholder icons"
```

---

### Task 2: Shared Constants

**Files:**
- Create: `src/shared/constants.js`
- Test: `tests/constants.test.js`

- [ ] **Step 1: Write the test**

Create `tests/constants.test.js`:

```js
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
    assert.ok(SCORE_THRESHOLDS.YELLOW < SCORE_THRESHOLDS.RED);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/constants.test.js`
Expected: FAIL — cannot find module `../src/shared/constants.js`

- [ ] **Step 3: Write constants.js**

Create `src/shared/constants.js`:

```js
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
  RED: 70,  // >= RED is danger
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

const BUCKET_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/constants.test.js`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants.js tests/constants.test.js
git commit -m "feat: add shared constants with thresholds, colors, and defaults"
```

---

### Task 3: Shared Utilities

**Files:**
- Create: `src/shared/utils.js`
- Test: `tests/utils.test.js`

- [ ] **Step 1: Write the tests**

Create `tests/utils.test.js`:

```js
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
  it('formats 0 bytes', () => {
    assert.equal(formatBytes(0), '0 B');
  });
  it('formats bytes', () => {
    assert.equal(formatBytes(500), '500 B');
  });
  it('formats kilobytes', () => {
    assert.equal(formatBytes(1024), '1.0 KB');
  });
  it('formats megabytes', () => {
    assert.equal(formatBytes(1048576), '1.0 MB');
  });
  it('formats gigabytes', () => {
    assert.equal(formatBytes(1073741824), '1.0 GB');
  });
  it('formats with decimals', () => {
    assert.equal(formatBytes(1536), '1.5 KB');
  });
});

describe('formatNumber', () => {
  it('formats small numbers as-is', () => {
    assert.equal(formatNumber(42), '42');
  });
  it('formats thousands with K', () => {
    assert.equal(formatNumber(1500), '1.5K');
  });
  it('formats millions with M', () => {
    assert.equal(formatNumber(2500000), '2.5M');
  });
  it('formats exact thousands', () => {
    assert.equal(formatNumber(1000), '1.0K');
  });
});

describe('getScoreColor', () => {
  it('returns green for low scores', () => {
    assert.equal(getScoreColor(30), '#22C55E');
  });
  it('returns yellow for medium scores', () => {
    assert.equal(getScoreColor(60), '#EAB308');
  });
  it('returns red for high scores', () => {
    assert.equal(getScoreColor(85), '#EF4444');
  });
  it('returns green for 0', () => {
    assert.equal(getScoreColor(0), '#22C55E');
  });
  it('returns red for 100', () => {
    assert.equal(getScoreColor(100), '#EF4444');
  });
});

describe('getScoreLabel', () => {
  it('returns Low for green range', () => {
    assert.equal(getScoreLabel(30), 'Low');
  });
  it('returns Medium for yellow range', () => {
    assert.equal(getScoreLabel(60), 'Medium');
  });
  it('returns High for red range', () => {
    assert.equal(getScoreLabel(85), 'High');
  });
});

describe('getBucketKey', () => {
  it('rounds down to 15-minute boundary', () => {
    // 2026-01-01 10:07:30 → should round to 10:00
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
  it('extracts ID from chrome-extension:// URL', () => {
    assert.equal(
      extractExtensionId('chrome-extension://abcdefghijklmnop'),
      'abcdefghijklmnop'
    );
  });
  it('returns null for non-extension URL', () => {
    assert.equal(extractExtensionId('https://example.com'), null);
  });
  it('returns null for undefined', () => {
    assert.equal(extractExtensionId(undefined), null);
  });
  it('returns null for empty string', () => {
    assert.equal(extractExtensionId(''), null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/utils.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write utils.js**

Create `src/shared/utils.js`:

```js
const SCORE_GREEN = 50;
const SCORE_YELLOW = 70;
const COLOR_GREEN = '#22C55E';
const COLOR_YELLOW = '#EAB308';
const COLOR_RED = '#EF4444';
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/utils.test.js`
Expected: all 18 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils.js tests/utils.test.js
git commit -m "feat: add shared utilities for formatting and scoring helpers"
```

---

### Task 4: Storage Helpers

**Files:**
- Create: `src/shared/storage.js`

No unit tests for this file — it's a thin wrapper around `chrome.storage.local`. Verified manually in Task 12.

- [ ] **Step 1: Write storage.js**

Create `src/shared/storage.js`:

```js
const STORAGE_KEY_ACTIVITY = 'activity';
const STORAGE_KEY_EXTENSIONS = 'extensions';
const STORAGE_KEY_SETTINGS = 'settings';

const DEFAULT_SETTINGS = {
  refreshInterval: 30,
  alertThreshold: 70,
  ignoreList: [],
  retentionHours: 24,
};

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
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY_SETTINGS] };
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
    settings: { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY_SETTINGS] },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/storage.js
git commit -m "feat: add chrome.storage.local helpers for activity, extensions, settings"
```

---

### Task 5: Impact Score Calculator

**Files:**
- Create: `src/background/scorer.js`
- Test: `tests/scorer.test.js`

- [ ] **Step 1: Write the tests**

Create `tests/scorer.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateScore, normalizeValue } = require('../src/background/scorer.js');

describe('normalizeValue', () => {
  it('returns 0 for 0 value', () => {
    assert.equal(normalizeValue(0, 100), 0);
  });
  it('returns 100 for value at max', () => {
    assert.equal(normalizeValue(100, 100), 100);
  });
  it('caps at 100 for value above max', () => {
    assert.equal(normalizeValue(200, 100), 100);
  });
  it('returns proportional value', () => {
    assert.equal(normalizeValue(50, 100), 50);
  });
});

describe('calculateScore', () => {
  it('returns 0 for extension with no activity and no permissions', () => {
    const meta = { permissions: [], contentScriptPatterns: [] };
    const activity = { totalRequests: 0, totalBytes: 0 };
    assert.equal(calculateScore(meta, activity), 0);
  });

  it('returns high score for extension with heavy activity and broad permissions', () => {
    const meta = {
      permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history'],
      contentScriptPatterns: ['<all_urls>'],
    };
    const activity = { totalRequests: 5000, totalBytes: 50 * 1024 * 1024 };
    const score = calculateScore(meta, activity);
    assert.ok(score >= 70, `Expected >= 70, got ${score}`);
  });

  it('returns low score for extension with minimal activity', () => {
    const meta = {
      permissions: ['storage'],
      contentScriptPatterns: [],
    };
    const activity = { totalRequests: 5, totalBytes: 1024 };
    const score = calculateScore(meta, activity);
    assert.ok(score < 30, `Expected < 30, got ${score}`);
  });

  it('sensitive permissions increase score vs non-sensitive', () => {
    const activity = { totalRequests: 100, totalBytes: 10240 };
    const metaSensitive = {
      permissions: ['<all_urls>', 'tabs', 'cookies'],
      contentScriptPatterns: [],
    };
    const metaNormal = {
      permissions: ['storage', 'alarms', 'notifications'],
      contentScriptPatterns: [],
    };
    const scoreSensitive = calculateScore(metaSensitive, activity);
    const scoreNormal = calculateScore(metaNormal, activity);
    assert.ok(
      scoreSensitive > scoreNormal,
      `Sensitive ${scoreSensitive} should > normal ${scoreNormal}`
    );
  });

  it('content script scope increases score', () => {
    const activity = { totalRequests: 100, totalBytes: 10240 };
    const metaBroad = {
      permissions: ['storage'],
      contentScriptPatterns: ['<all_urls>'],
    };
    const metaNarrow = {
      permissions: ['storage'],
      contentScriptPatterns: ['https://example.com/*'],
    };
    const scoreBroad = calculateScore(metaBroad, activity);
    const scoreNarrow = calculateScore(metaNarrow, activity);
    assert.ok(
      scoreBroad > scoreNarrow,
      `Broad ${scoreBroad} should > narrow ${scoreNarrow}`
    );
  });

  it('score is always between 0 and 100', () => {
    const meta = {
      permissions: ['<all_urls>', 'tabs', 'webRequest', 'cookies', 'history', 'bookmarks', 'debugger'],
      contentScriptPatterns: ['<all_urls>', 'http://*/*', 'https://*/*'],
    };
    const activity = { totalRequests: 999999, totalBytes: 999999999 };
    const score = calculateScore(meta, activity);
    assert.ok(score >= 0 && score <= 100, `Score ${score} out of range`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/scorer.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write scorer.js**

Create `src/background/scorer.js`:

```js
const SENSITIVE_PERMISSIONS = [
  '<all_urls>', 'tabs', 'webRequest', 'webRequestBlocking',
  'cookies', 'history', 'bookmarks', 'debugger',
  'clipboardRead', 'clipboardWrite', 'nativeMessaging',
];

// Reference maximums for normalization (tuned for typical extension behavior)
const MAX_REQUESTS_PER_HOUR = 2000;
const MAX_BYTES_PER_HOUR = 20 * 1024 * 1024; // 20 MB
const MAX_PERMISSION_SCORE = 15; // ~5 sensitive perms * 2 + some normal ones
const MAX_SCOPE_SCORE = 5;      // broad patterns count

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
    score += SENSITIVE_PERMISSIONS.includes(perm) ? 2 : 0.5;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/scorer.test.js`
Expected: all 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/scorer.js tests/scorer.test.js
git commit -m "feat: add impact score calculator with weighted multi-factor scoring"
```

---

### Task 6: Collector (Network Event Accumulator)

**Files:**
- Create: `src/background/collector.js`
- Test: `tests/collector.test.js`

- [ ] **Step 1: Write the tests**

Create `tests/collector.test.js`:

```js
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Collector } = require('../src/background/collector.js');

describe('Collector', () => {
  let collector;

  beforeEach(() => {
    collector = new Collector('own-extension-id');
  });

  it('starts with empty data', () => {
    const snapshot = collector.getSnapshot();
    assert.deepEqual(snapshot, {});
  });

  it('records a request from an extension', () => {
    collector.processRequest({
      initiator: 'chrome-extension://abc123',
      url: 'https://api.example.com/data',
      type: 'xmlhttprequest',
      responseHeaders: [{ name: 'content-length', value: '2048' }],
    });

    const snapshot = collector.getSnapshot();
    assert.ok('abc123' in snapshot);
    assert.equal(snapshot['abc123'].requests, 1);
    assert.equal(snapshot['abc123'].bytes, 2048);
    assert.equal(snapshot['abc123'].byType['xmlhttprequest'], 1);
    assert.equal(snapshot['abc123'].topDomains['api.example.com'], 1);
  });

  it('accumulates multiple requests from the same extension', () => {
    collector.processRequest({
      initiator: 'chrome-extension://abc123',
      url: 'https://api.example.com/a',
      type: 'xmlhttprequest',
      responseHeaders: [{ name: 'content-length', value: '1000' }],
    });
    collector.processRequest({
      initiator: 'chrome-extension://abc123',
      url: 'https://cdn.example.com/b',
      type: 'script',
      responseHeaders: [{ name: 'content-length', value: '500' }],
    });

    const snapshot = collector.getSnapshot();
    assert.equal(snapshot['abc123'].requests, 2);
    assert.equal(snapshot['abc123'].bytes, 1500);
    assert.equal(snapshot['abc123'].byType['xmlhttprequest'], 1);
    assert.equal(snapshot['abc123'].byType['script'], 1);
  });

  it('ignores requests from own extension', () => {
    collector.processRequest({
      initiator: 'chrome-extension://own-extension-id',
      url: 'https://api.example.com/data',
      type: 'xmlhttprequest',
      responseHeaders: [],
    });

    const snapshot = collector.getSnapshot();
    assert.deepEqual(snapshot, {});
  });

  it('ignores requests without extension initiator', () => {
    collector.processRequest({
      initiator: 'https://example.com',
      url: 'https://api.example.com/data',
      type: 'xmlhttprequest',
      responseHeaders: [],
    });

    const snapshot = collector.getSnapshot();
    assert.deepEqual(snapshot, {});
  });

  it('ignores requests with no initiator', () => {
    collector.processRequest({
      url: 'https://api.example.com/data',
      type: 'xmlhttprequest',
      responseHeaders: [],
    });

    const snapshot = collector.getSnapshot();
    assert.deepEqual(snapshot, {});
  });

  it('handles missing content-length header', () => {
    collector.processRequest({
      initiator: 'chrome-extension://abc123',
      url: 'https://api.example.com/data',
      type: 'xmlhttprequest',
      responseHeaders: [],
    });

    const snapshot = collector.getSnapshot();
    assert.equal(snapshot['abc123'].bytes, 0);
  });

  it('reset clears all data', () => {
    collector.processRequest({
      initiator: 'chrome-extension://abc123',
      url: 'https://api.example.com/data',
      type: 'xmlhttprequest',
      responseHeaders: [],
    });
    collector.reset();

    const snapshot = collector.getSnapshot();
    assert.deepEqual(snapshot, {});
  });

  it('tracks separate extensions independently', () => {
    collector.processRequest({
      initiator: 'chrome-extension://ext1',
      url: 'https://a.com/x',
      type: 'xmlhttprequest',
      responseHeaders: [{ name: 'content-length', value: '100' }],
    });
    collector.processRequest({
      initiator: 'chrome-extension://ext2',
      url: 'https://b.com/y',
      type: 'script',
      responseHeaders: [{ name: 'content-length', value: '200' }],
    });

    const snapshot = collector.getSnapshot();
    assert.equal(snapshot['ext1'].requests, 1);
    assert.equal(snapshot['ext1'].bytes, 100);
    assert.equal(snapshot['ext2'].requests, 1);
    assert.equal(snapshot['ext2'].bytes, 200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/collector.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write collector.js**

Create `src/background/collector.js`:

```js
class Collector {
  constructor(ownExtensionId) {
    this._ownId = ownExtensionId;
    this._data = new Map();
  }

  processRequest(details) {
    const extId = this._extractExtensionId(details.initiator);
    if (!extId || extId === this._ownId) return;

    if (!this._data.has(extId)) {
      this._data.set(extId, {
        requests: 0,
        bytes: 0,
        byType: {},
        topDomains: {},
      });
    }

    const entry = this._data.get(extId);
    entry.requests += 1;
    entry.bytes += this._getContentLength(details.responseHeaders);

    const type = details.type || 'other';
    entry.byType[type] = (entry.byType[type] || 0) + 1;

    const domain = this._extractDomain(details.url);
    if (domain) {
      entry.topDomains[domain] = (entry.topDomains[domain] || 0) + 1;
    }
  }

  getSnapshot() {
    const result = {};
    for (const [id, data] of this._data) {
      result[id] = {
        requests: data.requests,
        bytes: data.bytes,
        byType: { ...data.byType },
        topDomains: { ...data.topDomains },
      };
    }
    return result;
  }

  reset() {
    this._data.clear();
  }

  _extractExtensionId(initiator) {
    if (!initiator) return null;
    const prefix = 'chrome-extension://';
    if (!initiator.startsWith(prefix)) return null;
    return initiator.slice(prefix.length).split('/')[0];
  }

  _getContentLength(headers) {
    if (!headers) return 0;
    for (const h of headers) {
      if (h.name.toLowerCase() === 'content-length') {
        return parseInt(h.value, 10) || 0;
      }
    }
    return 0;
  }

  _extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Collector };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/collector.test.js`
Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/collector.js tests/collector.test.js
git commit -m "feat: add network request collector with per-extension accumulation"
```

---

### Task 7: Aggregator (Bucket Management and Storage Flush)

**Files:**
- Create: `src/background/aggregator.js`
- Test: `tests/aggregator.test.js`

- [ ] **Step 1: Write the tests**

Create `tests/aggregator.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createBucket, mergeSnapshotIntoActivity, pruneOldBuckets } = require('../src/background/aggregator.js');

describe('createBucket', () => {
  it('creates a bucket from collector snapshot entry', () => {
    const timestamp = Date.now();
    const entry = {
      requests: 42,
      bytes: 10240,
      byType: { xmlhttprequest: 30, script: 12 },
      topDomains: { 'api.example.com': 25, 'cdn.example.com': 17 },
    };
    const bucket = createBucket(timestamp, entry);
    assert.equal(bucket.timestamp, timestamp);
    assert.equal(bucket.requests, 42);
    assert.equal(bucket.bytesTransferred, 10240);
    assert.deepEqual(bucket.byType, { xmlhttprequest: 30, script: 12 });
    assert.deepEqual(bucket.topDomains, { 'api.example.com': 25, 'cdn.example.com': 17 });
  });
});

describe('mergeSnapshotIntoActivity', () => {
  it('creates new activity entry for new extension', () => {
    const activity = {};
    const snapshot = {
      ext1: { requests: 10, bytes: 500, byType: { xhr: 10 }, topDomains: { 'a.com': 10 } },
    };
    const timestamp = 1000;
    const result = mergeSnapshotIntoActivity(activity, snapshot, timestamp);
    assert.ok('ext1' in result);
    assert.equal(result['ext1'].buckets.length, 1);
    assert.equal(result['ext1'].buckets[0].requests, 10);
  });

  it('appends bucket to existing activity', () => {
    const activity = {
      ext1: {
        buckets: [{ timestamp: 500, requests: 5, bytesTransferred: 100, byType: {}, topDomains: {} }],
      },
    };
    const snapshot = {
      ext1: { requests: 10, bytes: 500, byType: {}, topDomains: {} },
    };
    const result = mergeSnapshotIntoActivity(activity, snapshot, 1000);
    assert.equal(result['ext1'].buckets.length, 2);
  });

  it('handles multiple extensions in one snapshot', () => {
    const activity = {};
    const snapshot = {
      ext1: { requests: 10, bytes: 500, byType: {}, topDomains: {} },
      ext2: { requests: 20, bytes: 1000, byType: {}, topDomains: {} },
    };
    const result = mergeSnapshotIntoActivity(activity, snapshot, 1000);
    assert.ok('ext1' in result);
    assert.ok('ext2' in result);
  });
});

describe('pruneOldBuckets', () => {
  it('removes buckets older than retention period', () => {
    const now = 100000;
    const retentionMs = 50000;
    const activity = {
      ext1: {
        buckets: [
          { timestamp: 10000, requests: 1, bytesTransferred: 0, byType: {}, topDomains: {} },
          { timestamp: 40000, requests: 2, bytesTransferred: 0, byType: {}, topDomains: {} },
          { timestamp: 80000, requests: 3, bytesTransferred: 0, byType: {}, topDomains: {} },
        ],
      },
    };
    const result = pruneOldBuckets(activity, now, retentionMs);
    assert.equal(result['ext1'].buckets.length, 2);
    assert.equal(result['ext1'].buckets[0].requests, 2);
    assert.equal(result['ext1'].buckets[1].requests, 3);
  });

  it('removes extension entry if all buckets are pruned', () => {
    const now = 100000;
    const retentionMs = 50000;
    const activity = {
      ext1: {
        buckets: [
          { timestamp: 10000, requests: 1, bytesTransferred: 0, byType: {}, topDomains: {} },
        ],
      },
    };
    const result = pruneOldBuckets(activity, now, retentionMs);
    assert.ok(!('ext1' in result));
  });

  it('keeps all buckets within retention', () => {
    const now = 100000;
    const retentionMs = 200000;
    const activity = {
      ext1: {
        buckets: [
          { timestamp: 10000, requests: 1, bytesTransferred: 0, byType: {}, topDomains: {} },
          { timestamp: 80000, requests: 2, bytesTransferred: 0, byType: {}, topDomains: {} },
        ],
      },
    };
    const result = pruneOldBuckets(activity, now, retentionMs);
    assert.equal(result['ext1'].buckets.length, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/aggregator.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write aggregator.js**

Create `src/background/aggregator.js`:

```js
function createBucket(timestamp, snapshotEntry) {
  return {
    timestamp,
    requests: snapshotEntry.requests,
    bytesTransferred: snapshotEntry.bytes,
    byType: { ...snapshotEntry.byType },
    topDomains: { ...snapshotEntry.topDomains },
  };
}

function mergeSnapshotIntoActivity(activity, snapshot, timestamp) {
  const result = {};

  // Copy existing activity
  for (const [extId, data] of Object.entries(activity)) {
    result[extId] = { buckets: [...data.buckets] };
  }

  // Merge snapshot
  for (const [extId, entry] of Object.entries(snapshot)) {
    if (!result[extId]) {
      result[extId] = { buckets: [] };
    }
    result[extId].buckets.push(createBucket(timestamp, entry));
  }

  return result;
}

function pruneOldBuckets(activity, now, retentionMs) {
  const cutoff = now - retentionMs;
  const result = {};

  for (const [extId, data] of Object.entries(activity)) {
    const kept = data.buckets.filter(b => b.timestamp >= cutoff);
    if (kept.length > 0) {
      result[extId] = { buckets: kept };
    }
  }

  return result;
}

if (typeof module !== 'undefined') {
  module.exports = { createBucket, mergeSnapshotIntoActivity, pruneOldBuckets };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/aggregator.test.js`
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/aggregator.js tests/aggregator.test.js
git commit -m "feat: add aggregator for time-bucket creation, merging, and pruning"
```

---

### Task 8: Background Service Worker

**Files:**
- Create: `src/background/service-worker.js`

This file wires collector, aggregator, scorer, and Chrome APIs together. Tested manually.

- [ ] **Step 1: Write service-worker.js**

Create `src/background/service-worker.js`:

```js
importScripts(
  '../shared/constants.js',
  '../shared/utils.js',
  '../shared/storage.js',
  './collector.js',
  './aggregator.js',
  './scorer.js'
);

const collector = new Collector(chrome.runtime.id);

// --- Network request listener ---
chrome.webRequest.onCompleted.addListener(
  (details) => collector.processRequest(details),
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// --- Periodic aggregation via alarms (every 15 minutes) ---
chrome.alarms.create('aggregate', { periodInMinutes: 15 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'aggregate') {
    await flushAndPrune();
  }
});

async function flushAndPrune() {
  const snapshot = collector.getSnapshot();
  collector.reset();

  if (Object.keys(snapshot).length === 0) return;

  const now = Date.now();
  const settings = await getSettings();
  const retentionMs = settings.retentionHours * 60 * 60 * 1000;

  let activity = await getActivity();
  activity = mergeSnapshotIntoActivity(activity, snapshot, now);
  activity = pruneOldBuckets(activity, now, retentionMs);

  // Recalculate scores
  const extensions = await getExtensions();
  for (const extId of Object.keys(activity)) {
    const meta = extensions[extId];
    if (meta) {
      const totalRequests = activity[extId].buckets.reduce((s, b) => s + b.requests, 0);
      const totalBytes = activity[extId].buckets.reduce((s, b) => s + b.bytesTransferred, 0);
      activity[extId].score = calculateScore(
        { permissions: meta.permissions || [], contentScriptPatterns: meta.contentScriptPatterns || [] },
        { totalRequests, totalBytes }
      );
    }
  }

  await saveActivity(activity);
}

// --- Extension metadata sync ---
async function syncExtensionMetadata() {
  const allExtensions = await chrome.management.getAll();
  const extensions = {};
  const ownId = chrome.runtime.id;

  for (const ext of allExtensions) {
    if (ext.id === ownId) continue;
    if (ext.type !== 'extension') continue;

    const contentScriptPatterns = [];
    if (ext.contentScripts) {
      for (const cs of ext.contentScripts) {
        contentScriptPatterns.push(...(cs.matches || []));
      }
    }

    extensions[ext.id] = {
      name: ext.name,
      version: ext.version,
      enabled: ext.enabled,
      icons: ext.icons || [],
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      contentScriptPatterns,
      hasBackgroundWorker: !!(ext.backgroundUrl || ext.offlineEnabled),
    };
  }

  await saveExtensions(extensions);
}

// Sync on startup
syncExtensionMetadata();

// Sync on extension changes
chrome.management.onInstalled.addListener(syncExtensionMetadata);
chrome.management.onUninstalled.addListener(syncExtensionMetadata);
chrome.management.onEnabled.addListener(syncExtensionMetadata);
chrome.management.onDisabled.addListener(syncExtensionMetadata);

// --- Message handler for popup/sidepanel ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LIVE_SNAPSHOT') {
    // Return current in-memory data (not yet flushed) merged with stored data
    (async () => {
      const snapshot = collector.getSnapshot();
      const stored = await getAllData();
      const now = Date.now();
      let activity = { ...stored.activity };
      if (Object.keys(snapshot).length > 0) {
        activity = mergeSnapshotIntoActivity(activity, snapshot, now);
      }
      // Calculate scores for live data
      for (const extId of Object.keys(activity)) {
        const meta = stored.extensions[extId];
        if (meta) {
          const totalRequests = activity[extId].buckets.reduce((s, b) => s + b.requests, 0);
          const totalBytes = activity[extId].buckets.reduce((s, b) => s + b.bytesTransferred, 0);
          activity[extId].score = calculateScore(
            { permissions: meta.permissions || [], contentScriptPatterns: meta.contentScriptPatterns || [] },
            { totalRequests, totalBytes }
          );
        }
      }
      sendResponse({
        activity,
        extensions: stored.extensions,
        settings: stored.settings,
      });
    })();
    return true; // async sendResponse
  }

  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.sidePanel.open({ windowId: sender.tab?.windowId }).then(() => sendResponse({ ok: true }));
    return true;
  }
});
```

- [ ] **Step 2: Reload extension in Chrome and verify no errors**

1. Go to `chrome://extensions/`
2. Click reload on the extension
3. Click "service worker" link to open DevTools for the background script
4. Expected: No errors in console. `syncExtensionMetadata` should have populated storage.
5. Check storage: In DevTools console run `chrome.storage.local.get(null, d => console.log(d))` — should see `extensions` key with data.

- [ ] **Step 3: Commit**

```bash
git add src/background/service-worker.js
git commit -m "feat: add background service worker wiring collector, aggregator, scorer"
```

---

### Task 9: Popup UI

**Files:**
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.css`
- Create: `src/popup/popup.js`

- [ ] **Step 1: Write popup.html**

Create `src/popup/popup.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="popup.css">
  <title>Extension Perf Monitor</title>
</head>
<body>
  <div class="popup">
    <header class="header">
      <div class="header-left">
        <svg class="header-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        <h1 class="header-title">Perf Monitor</h1>
      </div>
      <span id="status-dot" class="status-dot status-green"></span>
    </header>

    <div class="kpi-row">
      <div class="kpi-card">
        <span id="kpi-active" class="kpi-value">--</span>
        <span class="kpi-label">Active</span>
      </div>
      <div class="kpi-card">
        <span id="kpi-traffic" class="kpi-value">--</span>
        <span class="kpi-label">Traffic</span>
      </div>
      <div class="kpi-card">
        <span id="kpi-warnings" class="kpi-value">--</span>
        <span class="kpi-label">Warnings</span>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Top Impact</h2>
      <div id="top-list" class="top-list">
        <div class="empty-state">Collecting data...</div>
      </div>
    </div>

    <button id="btn-open-panel" class="btn-primary">
      Open Full Panel
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  </div>

  <script src="../shared/constants.js"></script>
  <script src="../shared/utils.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write popup.css**

Create `src/popup/popup.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 380px;
  background: #0F172A;
  color: #F8FAFC;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1.5;
}

.popup {
  padding: 16px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #F8FAFC;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-green { background: #22C55E; box-shadow: 0 0 6px #22C55E80; }
.status-yellow { background: #EAB308; box-shadow: 0 0 6px #EAB30880; }
.status-red { background: #EF4444; box-shadow: 0 0 6px #EF444480; }

/* KPI Cards */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.kpi-card {
  background: #1E293B;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}

.kpi-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  font-family: 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
  color: #F8FAFC;
}

.kpi-label {
  display: block;
  font-size: 11px;
  color: #94A3B8;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Section */
.section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

/* Top Impact List */
.top-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.top-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #1E293B;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.top-item:hover {
  background: #334155;
}

.top-item-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
  background: #334155;
}

.top-item-name {
  flex: 1;
  font-size: 12px;
  color: #E2E8F0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-item-bar-wrap {
  width: 80px;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.top-item-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.top-item-score {
  font-size: 12px;
  font-weight: 600;
  font-family: 'Fira Code', monospace;
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  color: #64748B;
  padding: 20px 0;
  font-size: 12px;
}

/* Button */
.btn-primary {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: #1E293B;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #22C55E;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.btn-primary:hover {
  background: #334155;
  border-color: #22C55E40;
}

.btn-primary:active {
  background: #3B4D6A;
}
```

- [ ] **Step 3: Write popup.js**

Create `src/popup/popup.js`:

```js
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  document.getElementById('btn-open-panel').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  });
});

async function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_LIVE_SNAPSHOT' }, (response) => {
    if (!response) return;
    render(response);
  });
}

function render({ activity, extensions, settings }) {
  const extEntries = buildExtensionEntries(activity, extensions);

  // KPIs
  const activeCount = Object.values(extensions).filter(e => e.enabled).length;
  const totalBytes = extEntries.reduce((sum, e) => sum + e.totalBytes, 0);
  const warningCount = extEntries.filter(e => e.score >= settings.alertThreshold).length;

  document.getElementById('kpi-active').textContent = activeCount;
  document.getElementById('kpi-traffic').textContent = formatBytes(totalBytes);
  document.getElementById('kpi-warnings').textContent = warningCount;

  // Status dot
  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot';
  if (warningCount > 3) dot.classList.add('status-red');
  else if (warningCount > 0) dot.classList.add('status-yellow');
  else dot.classList.add('status-green');

  // Top 5
  const top5 = extEntries.slice(0, 5);
  const listEl = document.getElementById('top-list');

  if (top5.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Collecting data...</div>';
    return;
  }

  const maxScore = Math.max(...top5.map(e => e.score), 1);
  listEl.innerHTML = top5.map(entry => {
    const barWidth = Math.round((entry.score / maxScore) * 100);
    const color = getScoreColor(entry.score);
    const iconUrl = getIconUrl(entry.icons);
    return `
      <div class="top-item" data-ext-id="${entry.id}">
        <img class="top-item-icon" src="${iconUrl}" alt="" width="20" height="20">
        <span class="top-item-name">${escapeHtml(entry.name)}</span>
        <div class="top-item-bar-wrap">
          <div class="top-item-bar" style="width:${barWidth}%;background:${color}"></div>
        </div>
        <span class="top-item-score" style="color:${color}">${entry.score}</span>
      </div>`;
  }).join('');
}

function buildExtensionEntries(activity, extensions) {
  const entries = [];
  for (const [extId, ext] of Object.entries(extensions)) {
    const act = activity[extId];
    const totalRequests = act ? act.buckets.reduce((s, b) => s + b.requests, 0) : 0;
    const totalBytes = act ? act.buckets.reduce((s, b) => s + b.bytesTransferred, 0) : 0;
    const score = act?.score || 0;
    entries.push({
      id: extId,
      name: ext.name,
      version: ext.version,
      enabled: ext.enabled,
      icons: ext.icons,
      totalRequests,
      totalBytes,
      score,
    });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function getIconUrl(icons) {
  if (!icons || icons.length === 0) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23334155" rx="4"/></svg>';
  const icon = icons.find(i => i.size >= 32) || icons[icons.length - 1];
  return icon.url;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

- [ ] **Step 4: Reload extension and test popup**

1. Reload extension at `chrome://extensions/`
2. Click the extension icon in the toolbar
3. Expected: Popup appears with dark theme, KPI cards showing "--" or real counts, and a "Top Impact" section
4. After a minute of browsing, data should appear in the top 5 list

- [ ] **Step 5: Commit**

```bash
git add src/popup/
git commit -m "feat: add popup UI with KPI cards and top 5 impact list"
```

---

### Task 10: Side Panel Shell (HTML, CSS, Tab Routing)

**Files:**
- Create: `src/sidepanel/panel.html`
- Create: `src/sidepanel/panel.css`
- Create: `src/sidepanel/panel.js`

- [ ] **Step 1: Write panel.html**

Create `src/sidepanel/panel.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="panel.css">
  <title>Extension Perf Monitor</title>
</head>
<body>
  <div class="panel">
    <header class="panel-header">
      <div class="header-left">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        <h1 class="header-title">Perf Monitor</h1>
      </div>
      <span id="status-dot" class="status-dot status-green"></span>
    </header>

    <nav class="tabs">
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="details">Details</button>
      <button class="tab" data-tab="settings">Settings</button>
    </nav>

    <main class="tab-content">
      <section id="tab-overview" class="tab-pane active"></section>
      <section id="tab-details" class="tab-pane"></section>
      <section id="tab-settings" class="tab-pane"></section>
    </main>
  </div>

  <script src="../../lib/chart.min.js"></script>
  <script src="../shared/constants.js"></script>
  <script src="../shared/utils.js"></script>
  <script src="../shared/storage.js"></script>
  <script src="overview.js"></script>
  <script src="details.js"></script>
  <script src="settings.js"></script>
  <script src="panel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write panel.css**

Create `src/sidepanel/panel.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #0F172A;
  --surface: #1E293B;
  --surface-hover: #334155;
  --fg: #F8FAFC;
  --fg-muted: #94A3B8;
  --border: #475569;
  --green: #22C55E;
  --yellow: #EAB308;
  --red: #EF4444;
  --blue: #3B82F6;
  --radius: 8px;
  --font-mono: 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
  --font-sans: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  overflow-x: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-green { background: var(--green); box-shadow: 0 0 6px #22C55E80; }
.status-yellow { background: var(--yellow); box-shadow: 0 0 6px #EAB30880; }
.status-red { background: var(--red); box-shadow: 0 0 6px #EF444480; }

/* Tabs */
.tabs {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.tab {
  flex: 1;
  padding: 10px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--fg-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab:hover {
  color: var(--fg);
}

.tab.active {
  color: var(--green);
  border-bottom-color: var(--green);
}

/* Tab Content */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tab-pane {
  display: none;
}

.tab-pane.active {
  display: block;
}

/* Shared components */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  text-align: center;
}

.kpi-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.kpi-label {
  display: block;
  font-size: 10px;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.kpi-delta {
  font-size: 10px;
  font-family: var(--font-mono);
  margin-top: 2px;
}

.kpi-delta.up { color: var(--red); }
.kpi-delta.down { color: var(--green); }
.kpi-delta.neutral { color: var(--fg-muted); }

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.chart-container {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  margin-bottom: 16px;
}

/* Search / Sort */
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: var(--green);
}

.search-input::placeholder {
  color: var(--fg-muted);
}

.sort-btn {
  padding: 8px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.sort-btn:hover {
  background: var(--surface-hover);
  color: var(--fg);
}

.sort-btn.active {
  color: var(--green);
  border-color: var(--green);
}

/* Extension Card */
.ext-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  overflow: hidden;
  transition: border-color 0.15s;
}

.ext-card:hover {
  border-color: var(--surface-hover);
}

.ext-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
}

.ext-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
  background: var(--surface-hover);
}

.ext-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ext-version {
  font-size: 11px;
  color: var(--fg-muted);
}

.ext-score-badge {
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: 10px;
  background: #22C55E20;
  flex-shrink: 0;
}

.ext-sparkline {
  width: 60px;
  height: 20px;
  flex-shrink: 0;
}

.ext-card-body {
  display: none;
  padding: 0 12px 12px;
  border-top: 1px solid var(--border);
}

.ext-card.expanded .ext-card-body {
  display: block;
}

.ext-detail-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px solid #1E293B;
}

.ext-detail-label {
  color: var(--fg-muted);
}

.ext-detail-value {
  font-family: var(--font-mono);
  color: var(--fg);
}

.perm-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin: 2px;
  background: var(--surface-hover);
  color: var(--fg-muted);
}

.perm-tag.sensitive {
  background: #EF444420;
  color: var(--red);
}

.domain-list {
  font-size: 12px;
  list-style: none;
  padding: 0;
}

.domain-list li {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  color: var(--fg-muted);
}

.domain-list li span {
  font-family: var(--font-mono);
  color: var(--fg);
}

.btn-disable {
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  background: #EF444420;
  border: 1px solid #EF444440;
  border-radius: var(--radius);
  color: var(--red);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-disable:hover {
  background: #EF444440;
}

.btn-disable.confirming {
  background: var(--red);
  color: white;
}

/* Bar chart items */
.bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bar-label {
  width: 120px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: var(--surface-hover);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.bar-value {
  width: 45px;
  text-align: right;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--fg-muted);
}

/* Settings */
.setting-group {
  margin-bottom: 20px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.setting-description {
  font-size: 11px;
  color: var(--fg-muted);
  margin-bottom: 8px;
}

.radio-group {
  display: flex;
  gap: 8px;
}

.radio-option {
  flex: 1;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg-muted);
  font-size: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}

.radio-option:hover {
  background: var(--surface-hover);
}

.radio-option.selected {
  border-color: var(--green);
  color: var(--green);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-row input[type="range"] {
  flex: 1;
  accent-color: var(--green);
}

.slider-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  width: 36px;
  text-align: right;
}

.btn-export {
  padding: 10px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--green);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-export:hover {
  background: var(--surface-hover);
}

.empty-state {
  text-align: center;
  color: #64748B;
  padding: 32px 0;
  font-size: 13px;
}
```

- [ ] **Step 3: Write panel.js (tab routing and data polling)**

Create `src/sidepanel/panel.js`:

```js
let currentData = null;
let refreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadData();
  startPolling();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const pane = document.getElementById(`tab-${tab.dataset.tab}`);
      pane.classList.add('active');

      // Render the active tab with current data
      if (currentData) renderActiveTab();
    });
  });
}

function loadData() {
  chrome.runtime.sendMessage({ type: 'GET_LIVE_SNAPSHOT' }, (response) => {
    if (!response) return;
    currentData = response;
    updateStatusDot(response);
    renderActiveTab();
  });
}

function startPolling() {
  if (refreshTimer) clearInterval(refreshTimer);
  const interval = currentData?.settings?.refreshInterval || 30;
  refreshTimer = setInterval(loadData, interval * 1000);
}

function renderActiveTab() {
  const activeTab = document.querySelector('.tab.active')?.dataset.tab;
  if (!currentData) return;
  if (activeTab === 'overview') renderOverview(currentData);
  if (activeTab === 'details') renderDetails(currentData);
  if (activeTab === 'settings') renderSettings(currentData.settings);
}

function updateStatusDot(data) {
  const threshold = data.settings.alertThreshold;
  const warningCount = Object.values(data.activity)
    .filter(a => (a.score || 0) >= threshold).length;
  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot';
  if (warningCount > 3) dot.classList.add('status-red');
  else if (warningCount > 0) dot.classList.add('status-yellow');
  else dot.classList.add('status-green');
}

function onSettingsChanged(newSettings) {
  currentData.settings = newSettings;
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });
  startPolling(); // restart with new interval
}
```

- [ ] **Step 4: Reload extension and verify Side Panel opens with tabs**

1. Reload extension at `chrome://extensions/`
2. Click the extension icon → click "Open Full Panel" button
3. Expected: Side Panel opens on the right side of the browser, showing three tabs (Overview, Details, Settings). Tabs switch content areas. Content is empty for now — that's OK.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/panel.html src/sidepanel/panel.css src/sidepanel/panel.js
git commit -m "feat: add side panel shell with dark theme, tab routing, and data polling"
```

---

### Task 11: Side Panel — Overview Tab

**Files:**
- Create: `src/sidepanel/overview.js`

- [ ] **Step 1: Download Chart.js**

```bash
mkdir -p lib
curl -L -o lib/chart.min.js "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"
```

Verify the file is valid JS (not a 404 HTML page):

```bash
head -c 100 lib/chart.min.js
```

Expected: starts with `/*!` or `(function` — JS content, not HTML.

- [ ] **Step 2: Write overview.js**

Create `src/sidepanel/overview.js`:

```js
let areaChart = null;

function renderOverview(data) {
  const container = document.getElementById('tab-overview');
  const entries = buildSortedEntries(data.activity, data.extensions);

  container.innerHTML = `
    <div class="kpi-row">
      ${renderKpiCard('kpi-ov-active', countActiveExtensions(data.extensions), 'Active', null)}
      ${renderKpiCard('kpi-ov-requests', sumField(entries, 'totalRequests'), 'Requests', 'number')}
      ${renderKpiCard('kpi-ov-traffic', sumField(entries, 'totalBytes'), 'Traffic', 'bytes')}
      ${renderKpiCard('kpi-ov-warnings', countWarnings(entries, data.settings.alertThreshold), 'Warnings', null)}
    </div>

    <div class="section-title">Network Activity (Last 30 min)</div>
    <div class="chart-container">
      <canvas id="area-chart" height="150"></canvas>
    </div>

    <div class="section-title">Consumption by Extension</div>
    <div id="consumption-bars"></div>
  `;

  renderAreaChart(data.activity);
  renderConsumptionBars(entries);
}

function renderKpiCard(id, value, label, format) {
  let display = value;
  if (format === 'bytes') display = formatBytes(value);
  else if (format === 'number') display = formatNumber(value);
  return `
    <div class="kpi-card">
      <span id="${id}" class="kpi-value">${display}</span>
      <span class="kpi-label">${label}</span>
    </div>`;
}

function renderAreaChart(activity) {
  const canvas = document.getElementById('area-chart');
  if (!canvas) return;

  // Aggregate all extensions' data into time series (last 30 min, per-minute resolution)
  const now = Date.now();
  const thirtyMinAgo = now - 30 * 60 * 1000;
  const labels = [];
  const dataPoints = [];

  // Create 30 one-minute slots
  for (let i = 0; i < 30; i++) {
    const slotStart = thirtyMinAgo + i * 60 * 1000;
    labels.push(new Date(slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    let total = 0;
    for (const act of Object.values(activity)) {
      for (const bucket of act.buckets || []) {
        // Distribute bucket requests evenly across its 15-minute span
        const bucketEnd = bucket.timestamp + 15 * 60 * 1000;
        if (bucket.timestamp <= slotStart + 60000 && bucketEnd > slotStart) {
          total += bucket.requests / 15; // approximate per-minute
        }
      }
    }
    dataPoints.push(Math.round(total));
  }

  if (areaChart) areaChart.destroy();

  areaChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: dataPoints,
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F620',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B',
          borderColor: '#475569',
          borderWidth: 1,
          titleColor: '#F8FAFC',
          bodyColor: '#94A3B8',
          callbacks: {
            label: (ctx) => `${ctx.raw} req/min`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748B', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 6 },
          grid: { color: '#1E293B' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#64748B', font: { size: 10 } },
          grid: { color: '#1E293B' },
        },
      },
      animation: { duration: 300 },
    },
  });
}

function renderConsumptionBars(entries) {
  const container = document.getElementById('consumption-bars');
  if (!container) return;

  const totalBytes = entries.reduce((s, e) => s + e.totalBytes, 0);
  if (totalBytes === 0) {
    container.innerHTML = '<div class="empty-state">No traffic recorded yet</div>';
    return;
  }

  container.innerHTML = entries.slice(0, 10).map(entry => {
    const pct = totalBytes > 0 ? (entry.totalBytes / totalBytes * 100) : 0;
    const color = getScoreColor(entry.score);
    return `
      <div class="bar-item">
        <span class="bar-label">${escapeHtml(entry.name)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
        </div>
        <span class="bar-value">${pct.toFixed(1)}%</span>
      </div>`;
  }).join('');
}

// --- Shared helpers used by overview and details ---
function buildSortedEntries(activity, extensions) {
  const ignoreList = currentData?.settings?.ignoreList || [];
  const entries = [];
  for (const [extId, ext] of Object.entries(extensions)) {
    if (ignoreList.includes(extId)) continue;
    const act = activity[extId];
    const totalRequests = act ? act.buckets.reduce((s, b) => s + b.requests, 0) : 0;
    const totalBytes = act ? act.buckets.reduce((s, b) => s + b.bytesTransferred, 0) : 0;
    entries.push({
      id: extId,
      name: ext.name,
      version: ext.version,
      enabled: ext.enabled,
      icons: ext.icons,
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      contentScriptPatterns: ext.contentScriptPatterns || [],
      totalRequests,
      totalBytes,
      score: act?.score || 0,
      buckets: act?.buckets || [],
    });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

function countActiveExtensions(extensions) {
  return Object.values(extensions).filter(e => e.enabled).length;
}

function sumField(entries, field) {
  return entries.reduce((s, e) => s + e[field], 0);
}

function countWarnings(entries, threshold) {
  return entries.filter(e => e.score >= threshold).length;
}

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function getIconUrl(icons) {
  if (!icons || icons.length === 0) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="%23334155" rx="4"/></svg>';
  }
  const icon = icons.find(i => i.size >= 32) || icons[icons.length - 1];
  return icon.url;
}
```

- [ ] **Step 3: Verify overview tab renders**

1. Reload extension
2. Open Side Panel → Overview tab
3. Expected: 4 KPI cards visible, area chart renders (may be flat if no data), consumption bars section visible

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/overview.js lib/chart.min.js
git commit -m "feat: add overview tab with KPI cards, area chart, and consumption bars"
```

---

### Task 12: Side Panel — Details Tab

**Files:**
- Create: `src/sidepanel/details.js`

- [ ] **Step 1: Write details.js**

Create `src/sidepanel/details.js`:

```js
const SENSITIVE_PERMS = [
  '<all_urls>', 'tabs', 'webRequest', 'webRequestBlocking',
  'cookies', 'history', 'bookmarks', 'debugger',
  'clipboardRead', 'clipboardWrite', 'nativeMessaging',
];

let currentSort = 'score';
let currentSearch = '';

function renderDetails(data) {
  const container = document.getElementById('tab-details');
  let entries = buildSortedEntries(data.activity, data.extensions);

  container.innerHTML = `
    <div class="toolbar">
      <input id="search-ext" class="search-input" type="text" placeholder="Search extensions..." value="${escapeHtml(currentSearch)}">
      <button class="sort-btn ${currentSort === 'score' ? 'active' : ''}" data-sort="score">Score</button>
      <button class="sort-btn ${currentSort === 'traffic' ? 'active' : ''}" data-sort="traffic">Traffic</button>
      <button class="sort-btn ${currentSort === 'requests' ? 'active' : ''}" data-sort="requests">Requests</button>
    </div>
    <div id="details-list"></div>
  `;

  // Search handler
  const searchInput = document.getElementById('search-ext');
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderDetailsList(entries, data.settings);
  });

  // Sort handlers
  container.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      container.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDetailsList(entries, data.settings);
    });
  });

  renderDetailsList(entries, data.settings);
}

function renderDetailsList(entries, settings) {
  let filtered = entries;
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = entries.filter(e => e.name.toLowerCase().includes(q));
  }

  if (currentSort === 'traffic') filtered.sort((a, b) => b.totalBytes - a.totalBytes);
  else if (currentSort === 'requests') filtered.sort((a, b) => b.totalRequests - a.totalRequests);
  else filtered.sort((a, b) => b.score - a.score);

  const listEl = document.getElementById('details-list');
  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No extensions found</div>';
    return;
  }

  listEl.innerHTML = filtered.map(entry => {
    const color = getScoreColor(entry.score);
    const bgColor = color + '20';
    const iconUrl = getIconUrl(entry.icons);

    // Build permissions HTML
    const allPerms = [...entry.permissions, ...entry.hostPermissions];
    const permsHtml = allPerms.length > 0
      ? allPerms.map(p => `<span class="perm-tag ${SENSITIVE_PERMS.includes(p) ? 'sensitive' : ''}">${escapeHtml(p)}</span>`).join('')
      : '<span style="color:var(--fg-muted);font-size:12px">None</span>';

    // Build top domains from latest bucket
    const latestBucket = entry.buckets.length > 0 ? entry.buckets[entry.buckets.length - 1] : null;
    const domains = latestBucket?.topDomains || {};
    const topDomains = Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const domainsHtml = topDomains.length > 0
      ? `<ul class="domain-list">${topDomains.map(([d, c]) => `<li>${escapeHtml(d)} <span>${c}</span></li>`).join('')}</ul>`
      : '<span style="color:var(--fg-muted);font-size:12px">None</span>';

    // Content script scope
    const scopeText = entry.contentScriptPatterns.length === 0 ? 'None'
      : entry.contentScriptPatterns.some(p => p === '<all_urls>' || p.includes('*://*/*'))
        ? 'All sites' : `${entry.contentScriptPatterns.length} pattern(s)`;

    const disabledAttr = entry.enabled ? '' : 'disabled style="opacity:0.5;cursor:default"';

    return `
      <div class="ext-card" data-ext-id="${entry.id}">
        <div class="ext-card-header" onclick="toggleCard(this)">
          <img class="ext-icon" src="${iconUrl}" alt="" width="24" height="24">
          <span class="ext-name">${escapeHtml(entry.name)}</span>
          <span class="ext-version">${escapeHtml(entry.version)}</span>
          <span class="ext-score-badge" style="color:${color};background:${bgColor}">${entry.score}</span>
        </div>
        <div class="ext-card-body">
          <div class="ext-detail-row">
            <span class="ext-detail-label">Requests</span>
            <span class="ext-detail-value">${formatNumber(entry.totalRequests)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">Traffic</span>
            <span class="ext-detail-value">${formatBytes(entry.totalBytes)}</span>
          </div>
          <div class="ext-detail-row">
            <span class="ext-detail-label">Content Scripts</span>
            <span class="ext-detail-value">${scopeText}</span>
          </div>
          <div style="margin-top:8px">
            <div class="section-title">Permissions</div>
            <div>${permsHtml}</div>
          </div>
          <div style="margin-top:8px">
            <div class="section-title">Top Domains</div>
            ${domainsHtml}
          </div>
          <button class="btn-disable" ${disabledAttr} onclick="handleDisable(event, '${entry.id}')">
            ${entry.enabled ? 'Disable Extension' : 'Already Disabled'}
          </button>
        </div>
      </div>`;
  }).join('');
}

function toggleCard(headerEl) {
  const card = headerEl.closest('.ext-card');
  card.classList.toggle('expanded');
}

function handleDisable(event, extId) {
  event.stopPropagation();
  const btn = event.target;

  if (btn.classList.contains('confirming')) {
    chrome.management.setEnabled(extId, false, () => {
      btn.textContent = 'Already Disabled';
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.classList.remove('confirming');
    });
    return;
  }

  btn.classList.add('confirming');
  btn.textContent = 'Click again to confirm';
  setTimeout(() => {
    if (btn.classList.contains('confirming')) {
      btn.classList.remove('confirming');
      btn.textContent = 'Disable Extension';
    }
  }, 3000);
}
```

- [ ] **Step 2: Verify details tab**

1. Reload extension
2. Open Side Panel → Details tab
3. Expected: Extension cards listed sorted by score, search filters by name, sort buttons switch sorting, clicking a card expands to show permissions/domains/disable button

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/details.js
git commit -m "feat: add details tab with search, sort, expandable cards, and disable action"
```

---

### Task 13: Side Panel — Settings Tab

**Files:**
- Create: `src/sidepanel/settings.js`

- [ ] **Step 1: Write settings.js**

Create `src/sidepanel/settings.js`:

```js
function renderSettings(settings) {
  const container = document.getElementById('tab-settings');
  const extensions = currentData?.extensions || {};
  const ignoreList = settings.ignoreList || [];

  // Build ignore list checkboxes from known extensions
  const ignoreHtml = Object.entries(extensions).map(([id, ext]) => {
    const checked = ignoreList.includes(id) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;cursor:pointer">
      <input type="checkbox" class="ignore-checkbox" data-ext-id="${id}" ${checked} style="accent-color:var(--green)">
      ${escapeHtml(ext.name)}
    </label>`;
  }).join('');

  container.innerHTML = `
    <div class="setting-group">
      <div class="setting-label">Refresh Rate</div>
      <div class="setting-description">How often the dashboard polls for new data</div>
      <div class="radio-group" id="setting-refresh">
        <div class="radio-option ${settings.refreshInterval === 60 ? 'selected' : ''}" data-value="60">Low (60s)</div>
        <div class="radio-option ${settings.refreshInterval === 30 ? 'selected' : ''}" data-value="30">Mid (30s)</div>
        <div class="radio-option ${settings.refreshInterval === 10 ? 'selected' : ''}" data-value="10">High (10s)</div>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">Alert Threshold</div>
      <div class="setting-description">Extensions scoring at or above this value are flagged as warnings</div>
      <div class="slider-row">
        <input type="range" id="setting-threshold" min="10" max="100" step="5" value="${settings.alertThreshold}">
        <span class="slider-value" id="threshold-display">${settings.alertThreshold}</span>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">Ignore List</div>
      <div class="setting-description">Excluded extensions are hidden from all views</div>
      <div id="ignore-list" style="max-height:160px;overflow-y:auto;padding:4px 0">
        ${ignoreHtml || '<span style="color:var(--fg-muted);font-size:12px">No other extensions installed</span>'}
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">Data Retention</div>
      <div class="setting-description">How long activity data is kept before auto-cleanup</div>
      <div class="radio-group" id="setting-retention">
        <div class="radio-option ${settings.retentionHours === 1 ? 'selected' : ''}" data-value="1">1 hour</div>
        <div class="radio-option ${settings.retentionHours === 6 ? 'selected' : ''}" data-value="6">6 hours</div>
        <div class="radio-option ${settings.retentionHours === 24 ? 'selected' : ''}" data-value="24">24 hours</div>
      </div>
    </div>

    <div class="setting-group">
      <div class="setting-label">Export Data</div>
      <div class="setting-description">Download current monitoring data as JSON</div>
      <button class="btn-export" id="btn-export">Export JSON</button>
    </div>
  `;

  // Refresh rate radio
  container.querySelectorAll('#setting-refresh .radio-option').forEach(opt => {
    opt.addEventListener('click', () => {
      container.querySelectorAll('#setting-refresh .radio-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const newSettings = { ...currentData.settings, refreshInterval: parseInt(opt.dataset.value) };
      onSettingsChanged(newSettings);
    });
  });

  // Threshold slider
  const slider = document.getElementById('setting-threshold');
  const display = document.getElementById('threshold-display');
  slider.addEventListener('input', () => {
    display.textContent = slider.value;
  });
  slider.addEventListener('change', () => {
    const newSettings = { ...currentData.settings, alertThreshold: parseInt(slider.value) };
    onSettingsChanged(newSettings);
  });

  // Ignore list checkboxes
  container.querySelectorAll('.ignore-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const newIgnore = [];
      container.querySelectorAll('.ignore-checkbox:checked').forEach(c => newIgnore.push(c.dataset.extId));
      const newSettings = { ...currentData.settings, ignoreList: newIgnore };
      onSettingsChanged(newSettings);
    });
  });

  // Retention radio
  container.querySelectorAll('#setting-retention .radio-option').forEach(opt => {
    opt.addEventListener('click', () => {
      container.querySelectorAll('#setting-retention .radio-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const newSettings = { ...currentData.settings, retentionHours: parseInt(opt.dataset.value) };
      onSettingsChanged(newSettings);
    });
  });

  // Export button
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perf-monitor-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
```

- [ ] **Step 2: Verify settings tab**

1. Reload extension → Open Side Panel → Settings tab
2. Expected: Refresh rate radio buttons work, threshold slider updates display, retention radio works, export button downloads a JSON file

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/settings.js
git commit -m "feat: add settings tab with refresh rate, threshold, retention, and export"
```

---

### Task 14: Integration and Final Wiring

**Files:**
- Verify all wiring between popup, side panel, and background

- [ ] **Step 1: Test popup → side panel flow**

1. Reload extension
2. Click the extension icon → popup appears
3. Click "Open Full Panel" → side panel opens
4. Expected: Both views show consistent data

- [ ] **Step 2: Test data collection end-to-end**

1. Open Side Panel → Overview tab
2. Install or enable a few extensions (e.g., uBlock Origin, React DevTools)
3. Browse several websites for 2-3 minutes
4. Expected: KPI numbers update on next refresh cycle, consumption bars show extensions sorted by traffic

- [ ] **Step 3: Test details tab interaction**

1. Switch to Details tab
2. Search for a specific extension by name → list filters
3. Click on an extension card → expands showing permissions, domains
4. Click "Disable Extension" → confirm → extension is disabled
5. Verify at `chrome://extensions/` that the extension is actually disabled

- [ ] **Step 4: Test settings persistence**

1. Switch to Settings tab
2. Change refresh rate to "High (10s)"
3. Close and reopen Side Panel
4. Expected: Setting persists — refresh rate still shows "High (10s)"

- [ ] **Step 5: Run all unit tests**

Run: `npm test`
Expected: All tests pass (constants, utils, scorer, collector, aggregator)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete extension with end-to-end data collection, popup, and side panel"
```

---

### Task 15: Polish and Chrome Web Store Readiness

**Files:**
- Modify: `manifest.json` (verify all fields)
- Create: Final production icons (if not done)

- [ ] **Step 1: Verify permissions are minimal**

Open `manifest.json` and confirm only these permissions are listed:
- `management`, `storage`, `sidePanel`, `webRequest`
- `host_permissions`: `["<all_urls>"]`
- No unnecessary permissions

- [ ] **Step 2: Test with all extensions disabled except this one**

1. Disable all other extensions at `chrome://extensions/`
2. Open popup and side panel
3. Expected: Shows 0 active extensions, empty charts, no errors in console

- [ ] **Step 3: Test with 10+ extensions enabled**

1. Re-enable multiple extensions
2. Browse actively for 5 minutes
3. Expected: Data populates, no performance degradation, charts render smoothly

- [ ] **Step 4: Check for console errors**

1. Right-click popup → Inspect → Console
2. Open Side Panel DevTools → Console
3. Open service worker DevTools → Console
4. Expected: No errors, no warnings (some Chrome API deprecation notices are OK)

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "chore: polish and verify chrome web store readiness"
```
