# Privacy Policy — Extension Audit

**Last updated:** 2026-04-16

## Summary

Extension Audit does not collect, store, or transmit any personal data. All analysis is performed locally on your device.

## Data Collection

**We do not collect any data.** Specifically:

- No browsing history is accessed or recorded
- No web page content is read or modified
- No network requests are made to external servers
- No analytics, telemetry, or crash reports are sent
- No cookies, passwords, or form data are accessed

## What the Extension Reads

Extension Audit reads the following data through the `chrome.management` API:

- Extension names, versions, and enabled/disabled status
- Declared permissions (from each extension's manifest)
- Declared content script URL patterns (from each extension's manifest)

This information is used solely to compute a local risk score displayed in the extension's popup and side panel. It is never transmitted anywhere.

## Local Storage

The extension uses `chrome.storage.local` to save:

- User preferences (alert threshold, hidden extensions list)

This data stays on your device and is never synced or uploaded.

## Permissions

| Permission | Purpose |
|-----------|---------|
| `management` | Read installed extension metadata for audit analysis |
| `storage` | Save user preferences locally |
| `sidePanel` | Display the audit dashboard |

No host permissions are requested. The extension cannot access any web page content.

## Third Parties

Extension Audit does not integrate with any third-party services, APIs, or analytics platforms.

## Changes

If this privacy policy changes, the updated version will be posted at this URL. The extension does not auto-update privacy policies — users can review changes via the GitHub repository.

## Contact

For questions about this privacy policy, open an issue at:
https://github.com/host452b/chrome_extension_perf_monitor/issues
