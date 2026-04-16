# Extension Perf Monitor - Design Spec

## Overview

A Chrome Web Store extension that monitors all installed Chrome extensions' resource usage and activity. Provides real-time consumption metrics, proportional breakdowns, and short-term trend analysis to help users identify problematic extensions and make informed decisions about which to keep, replace, or remove.

**Target Users:** All Chrome Stable users (not dev-only)
**Distribution:** Chrome Web Store
**Manifest Version:** V3

## Architecture

Three-layer Manifest V3 architecture:

### 1. Background Service Worker (Data Engine)

The core data collection and aggregation layer. Runs as a Manifest V3 service worker.

**Responsibilities:**
- Listen to `chrome.webRequest.onCompleted` to capture network activity per extension
- Use `chrome.management.getAll()` to collect extension metadata on startup and on change events
- Aggregate raw events into time-bucketed summaries in memory
- Periodically flush aggregated data to `chrome.storage.local`
- Calculate impact scores for each extension

**Self-identification:** The extension filters itself out from all monitoring data using `chrome.runtime.id`.

### 2. Popup (Quick Summary)

A compact 400x500px popup providing at-a-glance status.

**Contents:**
- 3 KPI cards: active extensions count, total data transferred, warning count
- Top 5 highest-impact extensions as horizontal bar chart
- "Open Full Panel" button to launch Side Panel

### 3. Side Panel (Full Dashboard)

The primary monitoring interface using `chrome.sidePanel` API (Chrome 116+).

**Three tabs:**
- **Overview:** KPI cards + streaming area chart (30-min trend) + consumption proportion bar chart
- **Details:** Searchable/sortable extension list with expandable cards showing per-extension deep dive
- **Settings:** Refresh rate, alert thresholds, ignore list, data retention, export

## Data Collection

### Data Dimensions

| Dimension | Source API | Collection Method | Aggregation |
|-----------|-----------|-------------------|-------------|
| Network request count | `chrome.webRequest.onCompleted` | Real-time event listener | Per extension ID, per 15-min bucket |
| Data transfer volume | `onCompleted` response headers (`content-length`) | Real-time event listener | Same as above |
| Request type distribution | `onCompleted` `type` field (xhr, script, image, etc.) | Real-time event listener | Per-type count |
| Request target domains | `onCompleted` url | Real-time event listener | Top domains per extension |
| Extension metadata | `chrome.management.getAll()` | On startup + `onInstalled`/`onEnabled`/`onDisabled` events | Snapshot |
| Permissions list | `management` permissions field | Same as metadata | Snapshot |
| Content script scope | `management` content_scripts.matches | Same as metadata | Pattern count |
| Enable/disable state | `chrome.management.onEnabled`/`onDisabled` | Real-time event listener | State log |

### How Extension Requests Are Identified

`chrome.webRequest.onCompleted` provides an `initiator` field containing the origin of the request. For extension-originated requests, this is `chrome-extension://<extension-id>`. We match this against known extension IDs from `chrome.management.getAll()`.

Requests without an extension initiator (i.e., normal web page requests) are ignored.

### Low-Overhead Design

To minimize this extension's own resource footprint:

- **In-memory accumulation:** Network events increment counters in a JS Map in the service worker. No storage I/O per event.
- **Batch flush:** Aggregated data is written to `chrome.storage.local` every 15 minutes (one write operation).
- **Default UI refresh:** Side Panel polls aggregated data every 30 seconds. Configurable: 60s (low) / 30s (mid) / 10s (high).
- **No persistent connections:** Side Panel reads from storage on interval, no long-lived message ports.
- **Lazy chart rendering:** Charts only render when the corresponding tab is visible.

## Impact Score Algorithm

Each extension receives a score from 0 to 100, calculated as:

```
rawScore =
  networkFrequencyScore * 0.30 +   // requests per hour, normalized
  dataVolumeScore * 0.20 +          // bytes transferred per hour, normalized
  permissionScore * 0.25 +          // permission count + sensitive permission weight
  scopeScore * 0.25                 // content script match pattern breadth

finalScore = normalize(rawScore, 0, 100)
```

**Sensitive permissions** (extra weight): `<all_urls>`, `tabs`, `webRequest`, `webRequestBlocking`, `cookies`, `history`, `bookmarks`, `debugger`

**Score thresholds:**
- 0-49: Green (low impact)
- 50-69: Yellow (moderate, worth reviewing)
- 70-100: Red (high impact, consider action)

## Data Storage & Lifecycle

**Storage:** `chrome.storage.local` (with `unlimitedStorage` permission not needed given short retention)

**Data structure in storage:**
```
{
  "extensions": {
    "<ext-id>": {
      "name": "...",
      "version": "...",
      "icon": "...",
      "enabled": true,
      "permissions": [...],
      "contentScriptPatterns": [...],
      "hasBackgroundWorker": true
    }
  },
  "activity": {
    "<ext-id>": {
      "buckets": [
        {
          "timestamp": 1713200000000,
          "requests": 42,
          "bytesTransferred": 102400,
          "byType": { "xhr": 30, "script": 10, "image": 2 },
          "topDomains": { "api.example.com": 25, "cdn.example.com": 17 }
        }
      ],
      "score": 72
    }
  },
  "settings": {
    "refreshInterval": 30,
    "alertThreshold": 70,
    "ignoreList": [],
    "retentionHours": 24
  }
}
```

**Lifecycle:**
- In-memory: fine-grained counters for current bucket (up to 15 min)
- Storage: last 24 hours of 15-min bucketed data (max ~96 buckets per extension)
- Auto-cleanup: on each flush, discard buckets older than configured retention
- Browser restart: in-memory counters reset, storage data persists until expiry

## UI Design

### Visual Style

- **Theme:** Dark Mode OLED (`#0F172A` background, `#F8FAFC` foreground)
- **Accent:** `#22C55E` (healthy/green), `#EAB308` (warning/yellow), `#EF4444` (danger/red)
- **Secondary surfaces:** `#1E293B` (cards), `#334155` (hover states)
- **Border:** `#475569`
- **Typography:** Fira Sans (UI text), Fira Code (numbers/data)
- **Icons:** Lucide Icons (SVG, consistent stroke width)
- **Effects:** Subtle glow on accent elements, smooth 200ms transitions

### Popup Layout (400x500px)

1. **Header:** Extension name + green/yellow/red status dot (system health)
2. **KPI Row:** 3 cards — Active Extensions | Total Traffic | Warnings
3. **Top 5 Bar Chart:** Horizontal bars sorted by impact score, extension name + score label
4. **Footer Button:** "Open Full Panel" → triggers `chrome.sidePanel.open()`

### Side Panel — Tab 1: Overview

1. **KPI Cards Row:** Same 3 metrics as popup, larger format with delta indicators (up/down arrow comparing current 15-min bucket vs the previous 15-min bucket)
2. **Streaming Area Chart:** Last 30 minutes of total network activity (all extensions stacked). X-axis: time, Y-axis: requests/min. Refreshes every 30s with smooth transition.
3. **Consumption Proportion:** Horizontal bar chart showing each extension's share of total traffic. Sorted descending. Click a bar → navigate to Details tab with that extension expanded.

### Side Panel — Tab 2: Details

1. **Search Bar:** Filter by extension name
2. **Sort Controls:** Sort by Impact Score / Traffic / Request Count (toggle asc/desc)
3. **Extension Cards:** Collapsible list, each card shows:
   - **Collapsed:** Icon + Name + Version + Impact Score badge (color-coded) + mini sparkline (last 1h, tiny 60x20px line)
   - **Expanded:**
     - Permission list (sensitive permissions highlighted in red with warning icon)
     - Content script scope (e.g., "All sites" vs specific patterns)
     - Top 5 request domains with counts
     - Mini area chart: last 1 hour trend for this extension
     - Action button: "Disable Extension" (calls `chrome.management.setEnabled(id, false)`)

### Side Panel — Tab 3: Settings

- **Refresh Rate:** Radio group — Low (60s) / Medium (30s, default) / High (10s)
- **Alert Threshold:** Slider 0-100, default 70
- **Ignore List:** Multi-select from installed extensions
- **Data Retention:** Radio group — 1h / 6h / 24h (default)
- **Export:** Button to download current data as JSON

### Key Interactions

- Click popup bar chart item → opens Side Panel, scrolls to that extension in Details tab
- Expandable cards: 200ms ease-out transition
- Charts: smooth data transitions, no jarring redraws
- Score badge color updates in real-time as data accumulates
- Disable extension button requires single confirmation click (not a modal — inline "Are you sure?" that replaces the button for 3s)

## Required Chrome Permissions

```json
{
  "permissions": [
    "management",
    "storage",
    "sidePanel",
    "webRequest",
    "alarms"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

**Justification:**
- `management`: List extensions, read metadata, enable/disable extensions
- `storage`: Store aggregated activity data
- `sidePanel`: Render full dashboard in Chrome Side Panel
- `webRequest`: Monitor network requests to attribute them to extensions
- `<all_urls>` host permission: Required by `webRequest` to observe requests across all URLs

## Technology Stack

- **Build:** Vanilla JS (no framework) — minimal bundle size, fast popup/panel load
- **Charts:** Chart.js (lightweight, ~60KB gzipped, sufficient for bar/area/sparkline)
- **Icons:** Lucide Icons (tree-shakeable SVG)
- **CSS:** Plain CSS with CSS custom properties for theming
- **Build tool:** None needed (or Vite if complexity grows)

Rationale for no framework: This is a self-contained monitoring tool with limited UI complexity. A framework would add unnecessary bundle size and startup latency for a popup/side panel that needs to open instantly.

## File Structure

```
chrome_extension_perf_monitor/
├── manifest.json
├── src/
│   ├── background/
│   │   ├── service-worker.js      # Entry point, event registration
│   │   ├── collector.js           # webRequest listener, data accumulation
│   │   ├── aggregator.js          # Bucket aggregation, storage flush
│   │   └── scorer.js              # Impact score calculation
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── sidepanel/
│   │   ├── panel.html
│   │   ├── panel.js               # Tab routing, data polling
│   │   ├── panel.css
│   │   ├── overview.js            # Overview tab rendering + charts
│   │   ├── details.js             # Details tab rendering
│   │   └── settings.js            # Settings tab logic
│   └── shared/
│       ├── constants.js           # Shared config, thresholds, color tokens
│       ├── storage.js             # chrome.storage.local read/write helpers
│       └── utils.js               # Formatting, time helpers
├── assets/
│   └── icons/                     # Extension icons (16, 48, 128px)
├── lib/
│   └── chart.min.js              # Chart.js library
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-16-extension-perf-monitor-design.md
```

## Chrome Web Store Considerations

- **Privacy:** All data stays local. No external network requests from this extension.
- **Permissions justification:** Must be provided in Chrome Web Store listing for `<all_urls>` and `management`.
- **Performance:** Low overhead by design (batch writes, lazy rendering, configurable refresh rate).
- **Minimum Chrome version:** 116 (for `chrome.sidePanel` API).
