# Chrome Web Store Listing — Extension Audit v2.0.0

## Name
Extension Audit

## Summary (132 chars max)
Audit your Chrome extensions by permissions and content script scope. See which ones are high-risk and decide what to keep.

## Description (16,000 chars max)

How many Chrome extensions do you have? Do you know what each one can access?

Extension Audit reads every installed extension's manifest and shows you a clear risk score based on two things:

• Permission sensitivity — extensions requesting cookies, browsing history, or access to all websites score higher
• Content script scope — extensions that inject code into every page you visit score higher than those limited to specific sites

The risk score is deterministic. It never drifts, never estimates, and never guesses. The same extension always gets the same score.

WHAT YOU CAN DO:
• See all extensions ranked by risk in one view
• Expand any extension to see its full permission list with sensitive ones highlighted
• Search and sort by risk score or permission count
• Disable high-risk extensions directly from the panel
• Export audit data as JSON

WHAT THIS TOOL DOES NOT DO:
• It does not monitor CPU or memory (Chrome doesn't allow extensions to read other extensions' process data)
• It does not track your browsing activity
• It does not send any data anywhere — everything stays on your device
• It does not modify any web pages

THREE PERMISSIONS ONLY:
• management — to read extension metadata
• storage — to save your preferences
• sidePanel — to show the audit dashboard

No host permissions. No access to your web pages. No network requests.

Built with vanilla JavaScript. Open source: https://github.com/host452b/chrome_extension_perf_monitor

## Category
Developer Tools

## Language
English (also supports Chinese)

## Permission Justifications

### management
"Reads the list of installed Chrome extensions and their declared permissions, content script patterns, and enabled/disabled status. This is the core data source for the audit — no extension data is modified or transmitted."

### storage
"Stores user preferences locally (alert threshold, hidden extensions list). No data is synced to external servers."

### sidePanel
"Displays the full audit dashboard in Chrome's side panel, allowing users to browse the web while reviewing their extensions."

## Assets

| Asset | File | Size |
|-------|------|------|
| Store icon | assets/store/icon-store-128.png | 128×128 |
| Screenshot 1 | assets/store/screenshot-1-overview.jpg | 1280×800 |
| Screenshot 2 | assets/store/screenshot-2-details.jpg | 1280×800 |
| Screenshot 3 | assets/store/screenshot-3-popup.jpg | 1280×800 |
| Small promo | assets/store/promo-small-440x280.jpg | 440×280 |
| Large promo | assets/store/promo-large-1400x560.jpg | 1400×560 |

## Privacy Policy URL
https://github.com/host452b/chrome_extension_perf_monitor/blob/main/PRIVACY_POLICY.md

## Support URL
https://github.com/host452b/chrome_extension_perf_monitor/issues
