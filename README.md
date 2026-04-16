# Extension Audit

Audit your Chrome extensions by permissions and content script scope. See which ones are high-risk and decide what to keep.

## How It Works

This tool performs **static analysis only** — it reads each extension's declared permissions and content script patterns from their manifest.

**Risk Score (0-100)** is computed from two factors:
- **Permission sensitivity (60%)** — `<all_urls>`, `cookies`, `history`, `webRequest` etc. are weighted 2x; others 0.5x
- **Content script scope (40%)** — extensions injecting into all websites score highest; narrow patterns lower; none = 0

Scores are **deterministic** — they only change when an extension updates its permissions.

> Chrome does not expose per-extension CPU or memory data to other extensions. This tool provides the most reliable analysis possible within Chrome's security model.

## Install

### From source

```bash
git clone https://github.com/host452b/chrome_extension_perf_monitor.git
```

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the cloned directory

### Requirements

Chrome 116+

## Usage

- **Click the toolbar icon** — popup shows risk summary + top 5 extensions
- **Click "Open Full Audit"** — side panel with full extension list
- **Expand any extension** — see all permissions, content script patterns
- **Disable** — one-click disable with confirmation
- **Settings** (gear icon) — alert threshold, ignore list, JSON export

## Permissions

| Permission | Why |
|-----------|-----|
| `management` | Read extension metadata (names, permissions, content scripts) |
| `storage` | Save user preferences locally |
| `sidePanel` | Display the audit dashboard |

No host permissions. No access to web pages. No network requests.

## Development

```bash
npm test       # 59 unit tests
npm run pack   # Build + security audit + zip for Chrome Web Store
npm run audit  # Security checks only
```

### Project structure

```
├── manifest.json
├── src/
│   ├── background/
│   │   ├── service-worker.js   # Reads chrome.management, calculates scores
│   │   └── scorer.js           # Risk score: permissions 60% + scope 40%
│   ├── popup/                  # Quick summary popup
│   ├── sidepanel/              # Full audit dashboard (flat layout)
│   └── shared/                 # Constants, i18n, utils, storage helpers
├── scripts/
│   └── pack.sh                 # Build + validate + zip
├── store/                      # Chrome Web Store listing
├── PRIVACY_POLICY.md
└── tests/
```

## Privacy

All analysis is local. No data is collected or transmitted. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## License

MIT
