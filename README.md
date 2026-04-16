# Extension Perf Monitor

A Chrome extension that monitors all installed extensions' network activity, calculates impact scores, and helps you decide which extensions to keep, replace, or remove.

## Features

- **Real-time network monitoring** — tracks every HTTP request made by each extension via `chrome.webRequest`
- **Impact scoring (0–100)** — weighted formula combining network frequency, data volume, permission breadth, and content script scope
- **Popup quick view** — 3 KPI cards + top 5 highest-impact extensions at a glance
- **Side Panel dashboard** — full monitoring interface with three tabs:
  - **Overview** — area chart (30-min trend), consumption proportion bars
  - **Details** — searchable, sortable extension cards with expandable permission/domain analysis and one-click disable
  - **Settings** — refresh rate, alert threshold, ignore list, data retention, JSON export
- **Low overhead** — in-memory accumulation with 2-min mini-flush, 15-min full aggregation; configurable polling (10s / 30s / 60s)
- **Privacy first** — all data stays local in `chrome.storage.local`, zero external network requests

## Screenshots

> Load the extension in Chrome and open the Side Panel to see the dashboard.

## Install

### From source (Developer mode)

1. Clone this repo:
   ```bash
   git clone https://github.com/host452b/chrome_extension_perf_monitor.git
   ```
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the cloned directory
5. The extension icon appears in the toolbar

### Requirements

- Chrome 116+ (required for `chrome.sidePanel` API)

### Enable CPU/Memory Monitoring (Optional)

The extension works out of the box with network + permission analysis. For **real CPU% and memory (RSS)** per extension, install the native host:

1. Find your extension ID at `chrome://extensions/` (enable Developer mode)
2. Run the installer:
   ```bash
   cd native-host
   ./install.sh <your-extension-id>
   ```
3. Restart Chrome

The side panel will show "Native host connected" when active.

**How it works:** A small Python script reads `ps` output to find Chrome extension renderer processes, matches them to extension IDs via command-line flags, and reports CPU% + RSS back to the extension.

**Uninstall:**
```bash
# macOS
rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.perfmonitor.host.json
# Linux
rm ~/.config/google-chrome/NativeMessagingHosts/com.perfmonitor.host.json
```

## Usage

1. **Click the toolbar icon** → popup shows KPI summary and top 5 extensions
2. **Click "Open Full Panel"** → Side Panel opens with the full dashboard
3. **Overview tab** → real-time area chart + consumption breakdown
4. **Details tab** → search/sort extensions, expand cards to see permissions, top request domains, and disable extensions directly
5. **Settings tab** → adjust refresh rate, alert threshold, manage ignore list, export data as JSON

### Impact Score

Each extension is scored 0–100 based on four weighted factors:

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Network frequency | 30% | Requests per hour |
| Data volume | 20% | Bytes transferred per hour |
| Permissions | 25% | Count + sensitive permission weighting |
| Content script scope | 25% | How many sites the extension injects into |

Score thresholds: **0–49** green (low) · **50–69** yellow (medium) · **70–100** red (high)

## Architecture

```
Background Service Worker
├── Collector (chrome.webRequest listener → in-memory Map)
├── Aggregator (15-min time buckets → chrome.storage.local)
└── Scorer (weighted multi-factor → 0-100)

Popup (380px)
├── 3 KPI cards (active / traffic / warnings)
├── Top 5 bar chart
└── "Open Full Panel" button

Side Panel (chrome.sidePanel API)
├── Overview tab (area chart + consumption bars)
├── Details tab (search + sort + expandable cards)
└── Settings tab (refresh / threshold / ignore / export)
```

## Permissions

| Permission | Why |
|-----------|-----|
| `webRequest` + `<all_urls>` | Monitor network requests and attribute them to extensions |
| `management` | List extensions, read metadata, enable/disable |
| `storage` | Store aggregated activity data locally |
| `sidePanel` | Render the full dashboard |
| `alarms` | Periodic data aggregation (2-min + 15-min) |
| `nativeMessaging` | Communicate with local process sampler for CPU/memory data |

## Development

```bash
# Run unit tests (Node.js 18+)
npm test
```

55 unit tests covering: constants, utilities, scorer, collector, aggregator.

### Project structure

```
├── manifest.json
├── src/
│   ├── background/
│   │   ├── service-worker.js   # Entry point, event wiring
│   │   ├── collector.js        # Network event accumulator
│   │   ├── aggregator.js       # Time-bucket management
│   │   └── scorer.js           # Impact score calculator
│   ├── popup/
│   │   ├── popup.html/css/js   # Quick summary popup
│   ├── sidepanel/
│   │   ├── panel.html/css/js   # Dashboard shell + tab routing
│   │   ├── overview.js         # KPI cards + charts
│   │   ├── details.js          # Extension list + expandable cards
│   │   └── settings.js         # Settings form + export
│   └── shared/
│       ├── constants.js        # Thresholds, colors, config
│       ├── utils.js            # Formatting helpers
│       └── storage.js          # chrome.storage.local wrappers
├── lib/
│   └── chart.min.js            # Chart.js v4
├── assets/icons/               # Extension icons (16/48/128)
└── tests/                      # Node.js unit tests
```

## Tech Stack

- **Vanilla JS** — no framework, minimal bundle, instant popup/panel load
- **Chart.js v4** — lightweight charting (~60KB gzipped)
- **CSS custom properties** — dark theme with semantic color tokens
- **Node.js `node:test`** — zero-dependency test runner

## License

MIT
