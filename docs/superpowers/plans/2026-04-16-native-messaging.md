# Native Messaging for Real CPU/Memory Profiling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native messaging host that reads OS process data to provide real per-extension CPU% and memory (RSS) to the Chrome extension.

**Architecture:** Three layers — (1) Python native host reads `ps` output, matches Chrome renderer processes to extension IDs via `--extension-process` command-line flag, returns JSON over stdin/stdout with 32-bit length prefix; (2) service worker maintains a `connectNative()` long connection, polls every 30s, merges process data into the existing data pipeline; (3) UI shows CPU% and memory as primary KPIs alongside the existing network/permission analysis, with graceful fallback when native host is not installed.

**Tech Stack:** Python 3 (native host), Chrome Native Messaging protocol (32-bit LE length + UTF-8 JSON), existing vanilla JS extension.

---

## File Structure

```
chrome_extension_perf_monitor/
├── native-host/
│   ├── perf_monitor_host.py          # Native host: reads process data, responds via stdio
│   ├── com.perfmonitor.host.json     # Native messaging manifest template
│   └── install.sh                    # macOS/Linux installer: copies manifest, sets permissions
├── src/
│   ├── background/
│   │   ├── native-bridge.js          # connectNative() wrapper, message protocol, reconnect
│   │   └── service-worker.js         # MODIFY: import native-bridge, merge process data
│   ├── background/scorer.js          # MODIFY: add cpu/memory weights
│   ├── sidepanel/overview.js         # MODIFY: KPIs show CPU/MEM, chart shows CPU trend
│   ├── sidepanel/details.js          # MODIFY: per-extension CPU/MEM in expanded card
│   ├── popup/popup.js                # MODIFY: KPIs show CPU/MEM
│   ├── shared/i18n.js                # MODIFY: add native host status strings
│   └── shared/constants.js           # MODIFY: add native host name constant
├── manifest.json                     # MODIFY: add nativeMessaging permission
└── tests/
    ├── native-host.test.js           # Test message framing and protocol
    └── native-bridge.test.js         # Test bridge message handling
```

---

### Task 1: Native Host — Python Process Sampler

**Files:**
- Create: `native-host/perf_monitor_host.py`
- Test: `tests/native-host.test.js`

- [ ] **Step 1: Write the test for native host message protocol**

Create `tests/native-host.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

// Helper: encode a message in Chrome Native Messaging format (4-byte LE length + JSON)
function encodeMessage(obj) {
  const json = JSON.stringify(obj);
  const buf = Buffer.alloc(4 + json.length);
  buf.writeUInt32LE(json.length, 0);
  buf.write(json, 4);
  return buf;
}

// Helper: decode one response from native host stdout buffer
function decodeMessage(buf) {
  const len = buf.readUInt32LE(0);
  const json = buf.slice(4, 4 + len).toString('utf8');
  return JSON.parse(json);
}

describe('native host protocol', () => {
  const hostPath = path.join(__dirname, '..', 'native-host', 'perf_monitor_host.py');

  it('responds to hello with version and platform', () => {
    const input = encodeMessage({ type: 'hello' });
    const result = execFileSync('python3', [hostPath], { input, timeout: 5000 });
    const msg = decodeMessage(result);
    assert.equal(msg.type, 'hello');
    assert.ok(msg.version);
    assert.ok(msg.platform);
  });

  it('responds to sample with extensions array', () => {
    const input = encodeMessage({ type: 'sample' });
    const result = execFileSync('python3', [hostPath], { input, timeout: 5000 });
    const msg = decodeMessage(result);
    assert.equal(msg.type, 'sample');
    assert.ok(Array.isArray(msg.extensions));
    // Each entry should have: extId (or null), pid, cpu, rss
    for (const ext of msg.extensions) {
      assert.equal(typeof ext.pid, 'number');
      assert.equal(typeof ext.cpu, 'number');
      assert.equal(typeof ext.rss, 'number');
    }
  });

  it('responds to unknown type with error', () => {
    const input = encodeMessage({ type: 'bogus' });
    const result = execFileSync('python3', [hostPath], { input, timeout: 5000 });
    const msg = decodeMessage(result);
    assert.equal(msg.type, 'error');
    assert.ok(msg.message);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/native-host.test.js`
Expected: FAIL — host file doesn't exist

- [ ] **Step 3: Write the native host**

Create `native-host/perf_monitor_host.py`:

```python
#!/usr/bin/env python3
"""
Native messaging host for Extension Perf Monitor.
Reads Chrome process data from OS and returns per-extension CPU% and RSS.

Protocol: Chrome Native Messaging (32-bit LE length prefix + UTF-8 JSON).
Runs as long-lived process when connected via runtime.connectNative().
Also supports single-shot mode (read one message, reply, exit).
"""

import json
import platform
import struct
import subprocess
import sys
import re

VERSION = "1.0.0"


def read_message():
    """Read one native messaging message from stdin."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    length = struct.unpack('<I', raw_length)[0]
    data = sys.stdin.buffer.read(length)
    if len(data) < length:
        return None
    return json.loads(data.decode('utf-8'))


def write_message(obj):
    """Write one native messaging message to stdout."""
    data = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def sample_chrome_processes():
    """
    Read Chrome extension processes from OS.
    Returns list of { extId: str|None, pid: int, cpu: float, rss: int }

    Chrome extension renderer processes have command lines containing:
      --extension-process --disable-client-side-phishing-detection
    and the extension URL like: chrome-extension://<id>/...

    We parse `ps` output to find them.
    """
    os_name = platform.system()
    extensions = []

    try:
        if os_name == 'Darwin' or os_name == 'Linux':
            # ps -eo pid,%cpu,rss,command — get all processes with CPU% and RSS (KB)
            out = subprocess.check_output(
                ['ps', '-eo', 'pid,%cpu,rss,command'],
                text=True, timeout=5
            )
            for line in out.strip().split('\n')[1:]:  # skip header
                parts = line.strip().split(None, 3)
                if len(parts) < 4:
                    continue
                pid_str, cpu_str, rss_str, cmd = parts
                if '--extension-process' not in cmd:
                    continue
                try:
                    pid = int(pid_str)
                    cpu = float(cpu_str)
                    rss = int(rss_str) * 1024  # KB → bytes
                except ValueError:
                    continue

                # Extract extension ID from chrome-extension://<id>/ in command line
                ext_id = None
                match = re.search(r'chrome-extension://([a-z]{32})', cmd)
                if match:
                    ext_id = match.group(1)

                extensions.append({
                    'extId': ext_id,
                    'pid': pid,
                    'cpu': round(cpu, 2),
                    'rss': rss,
                })

        elif os_name == 'Windows':
            # Use wmic to get process data
            out = subprocess.check_output(
                ['wmic', 'process', 'where',
                 "name like '%chrome%'",
                 'get', 'ProcessId,CommandLine,WorkingSetSize',
                 '/format:csv'],
                text=True, timeout=10
            )
            for line in out.strip().split('\n')[1:]:
                cols = line.strip().split(',')
                if len(cols) < 4:
                    continue
                # CSV: Node,CommandLine,ProcessId,WorkingSetSize
                cmd = cols[1]
                if '--extension-process' not in cmd:
                    continue
                try:
                    pid = int(cols[2])
                    rss = int(cols[3])  # bytes
                except (ValueError, IndexError):
                    continue

                ext_id = None
                match = re.search(r'chrome-extension://([a-z]{32})', cmd)
                if match:
                    ext_id = match.group(1)

                extensions.append({
                    'extId': ext_id,
                    'pid': pid,
                    'cpu': 0.0,  # wmic doesn't give CPU% directly
                    'rss': rss,
                })

    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.CalledProcessError) as e:
        # Return whatever we have, plus a note
        pass

    return extensions


def handle_message(msg):
    """Handle one incoming message and return the response."""
    msg_type = msg.get('type', '')

    if msg_type == 'hello':
        return {
            'type': 'hello',
            'version': VERSION,
            'platform': platform.system(),
        }

    elif msg_type == 'sample':
        exts = sample_chrome_processes()
        return {
            'type': 'sample',
            'extensions': exts,
        }

    else:
        return {
            'type': 'error',
            'message': f'Unknown message type: {msg_type}',
        }


def main():
    """Main loop: read messages, respond, repeat until stdin closes."""
    while True:
        msg = read_message()
        if msg is None:
            break  # stdin closed, Chrome disconnected
        response = handle_message(msg)
        write_message(response)


if __name__ == '__main__':
    main()
```

Make executable:
```bash
chmod +x native-host/perf_monitor_host.py
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/native-host.test.js`
Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add native-host/perf_monitor_host.py tests/native-host.test.js
git commit -m "feat: add native host for real CPU/memory process sampling"
```

---

### Task 2: Native Messaging Manifest & Installer

**Files:**
- Create: `native-host/com.perfmonitor.host.json`
- Create: `native-host/install.sh`

- [ ] **Step 1: Create the native messaging manifest template**

Create `native-host/com.perfmonitor.host.json`:

```json
{
  "name": "com.perfmonitor.host",
  "description": "Extension Perf Monitor — native process sampler",
  "path": "PLACEHOLDER_PATH",
  "type": "stdio",
  "allowed_origins": [
    "PLACEHOLDER_ORIGIN"
  ]
}
```

Note: `path` must be an absolute path to `perf_monitor_host.py`. `allowed_origins` must be `chrome-extension://<extension-id>/`. The installer fills these in.

- [ ] **Step 2: Create the installer script**

Create `native-host/install.sh`:

```bash
#!/bin/bash
set -e

# --- Configuration ---
HOST_NAME="com.perfmonitor.host"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$SCRIPT_DIR/perf_monitor_host.py"

# --- Detect extension ID ---
# User must pass their extension ID as argument, or we read from manifest
if [ -n "$1" ]; then
    EXT_ID="$1"
else
    echo ""
    echo "Usage: ./install.sh <extension-id>"
    echo ""
    echo "Find your extension ID at chrome://extensions (enable Developer mode)"
    echo "It looks like: abcdefghijklmnopqrstuvwxyzabcdef"
    echo ""
    exit 1
fi

ORIGIN="chrome-extension://${EXT_ID}/"

# --- Detect platform ---
OS="$(uname -s)"
case "$OS" in
    Darwin)
        TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        ;;
    Linux)
        TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
        ;;
    *)
        echo "Unsupported platform: $OS"
        echo "For Windows, run install.bat instead."
        exit 1
        ;;
esac

# --- Install ---
mkdir -p "$TARGET_DIR"

# Generate manifest with actual paths
cat > "$TARGET_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Extension Perf Monitor — native process sampler",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "$ORIGIN"
  ]
}
EOF

# Ensure host is executable
chmod +x "$HOST_PATH"

echo ""
echo "Installed native messaging host:"
echo "  Manifest: $TARGET_DIR/$HOST_NAME.json"
echo "  Host:     $HOST_PATH"
echo "  Origin:   $ORIGIN"
echo ""
echo "Restart Chrome, then the extension will auto-detect the native host."
echo ""
```

Make executable:
```bash
chmod +x native-host/install.sh
```

- [ ] **Step 3: Commit**

```bash
git add native-host/com.perfmonitor.host.json native-host/install.sh
git commit -m "feat: add native host manifest template and macOS/Linux installer"
```

---

### Task 3: Extension — Native Bridge Module

**Files:**
- Create: `src/background/native-bridge.js`
- Modify: `src/shared/constants.js`
- Modify: `manifest.json`
- Test: `tests/native-bridge.test.js`

- [ ] **Step 1: Add nativeMessaging permission and host name constant**

Modify `manifest.json` — add `"nativeMessaging"` to permissions array:

```json
"permissions": [
    "management",
    "storage",
    "sidePanel",
    "webRequest",
    "alarms",
    "nativeMessaging"
],
```

Modify `src/shared/constants.js` — add at the end (before the `module.exports` block):

```js
const NATIVE_HOST_NAME = 'com.perfmonitor.host';
```

And add `NATIVE_HOST_NAME` to the module.exports object.

- [ ] **Step 2: Write the test**

Create `tests/native-bridge.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// We can't test actual chrome.runtime.connectNative in Node,
// but we can test the message parsing and state management logic.

// Simulate the bridge's response handler
function processHostResponse(response, state) {
  if (!response || response.type === 'error') {
    state.connected = false;
    state.error = response?.message || 'Unknown error';
    return state;
  }

  if (response.type === 'hello') {
    state.connected = true;
    state.version = response.version;
    state.platform = response.platform;
    return state;
  }

  if (response.type === 'sample') {
    state.lastSample = {};
    for (const ext of response.extensions || []) {
      if (ext.extId) {
        state.lastSample[ext.extId] = {
          cpu: ext.cpu,
          rss: ext.rss,
          pid: ext.pid,
        };
      }
    }
    state.lastSampleTime = Date.now();
    return state;
  }

  return state;
}

describe('native bridge message processing', () => {
  it('processes hello response', () => {
    const state = { connected: false };
    processHostResponse({ type: 'hello', version: '1.0.0', platform: 'Darwin' }, state);
    assert.equal(state.connected, true);
    assert.equal(state.version, '1.0.0');
  });

  it('processes sample response', () => {
    const state = {};
    processHostResponse({
      type: 'sample',
      extensions: [
        { extId: 'abc123', pid: 1234, cpu: 5.2, rss: 52428800 },
        { extId: 'def456', pid: 5678, cpu: 1.1, rss: 10485760 },
        { extId: null, pid: 9999, cpu: 0.5, rss: 8388608 },
      ],
    }, state);
    assert.ok(state.lastSample);
    assert.equal(Object.keys(state.lastSample).length, 2); // null extId filtered out
    assert.equal(state.lastSample['abc123'].cpu, 5.2);
    assert.equal(state.lastSample['abc123'].rss, 52428800);
    assert.equal(state.lastSample['def456'].cpu, 1.1);
  });

  it('handles error response', () => {
    const state = { connected: true };
    processHostResponse({ type: 'error', message: 'something broke' }, state);
    assert.equal(state.connected, false);
    assert.equal(state.error, 'something broke');
  });

  it('handles null response (host disconnected)', () => {
    const state = { connected: true };
    processHostResponse(null, state);
    assert.equal(state.connected, false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/native-bridge.test.js`
Expected: PASS (these are pure logic tests, no external deps) — actually they should pass immediately since the logic is defined inline in the test. But we need the real module. Let me restructure: the test imports from the bridge module.

Actually, since the real `native-bridge.js` will use Chrome APIs that aren't available in Node, extract the testable logic into functions that can be imported. Put the pure logic in the module, Chrome API calls in a wrapper.

- [ ] **Step 4: Write native-bridge.js**

Create `src/background/native-bridge.js`:

```js
/**
 * NativeBridge — manages connection to the native process sampler host.
 *
 * Usage in service worker:
 *   const bridge = new NativeBridge('com.perfmonitor.host');
 *   bridge.connect();           // establish long connection
 *   bridge.requestSample();     // ask for fresh CPU/MEM data
 *   bridge.getLatest();         // get last received sample { extId: { cpu, rss, pid } }
 *   bridge.isConnected();       // true if native host is reachable
 */

const _NATIVE_HOST = (typeof NATIVE_HOST_NAME !== 'undefined')
  ? NATIVE_HOST_NAME
  : 'com.perfmonitor.host';

class NativeBridge {
  constructor(hostName) {
    this._hostName = hostName || _NATIVE_HOST;
    this._port = null;
    this._connected = false;
    this._lastSample = {};      // { extId: { cpu, rss, pid } }
    this._lastSampleTime = 0;
    this._version = null;
    this._error = null;
    this._onSampleCallback = null;
  }

  /** Connect to the native host. Returns immediately; connection is async. */
  connect() {
    if (this._port) return;

    try {
      this._port = chrome.runtime.connectNative(this._hostName);

      this._port.onMessage.addListener((msg) => {
        this._processResponse(msg);
      });

      this._port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError?.message || 'disconnected';
        console.warn('[PerfMon] Native host disconnected:', err);
        this._port = null;
        this._connected = false;
        this._error = err;
      });

      // Send hello to verify connection
      this._port.postMessage({ type: 'hello' });

    } catch (e) {
      console.warn('[PerfMon] Cannot connect to native host:', e.message);
      this._connected = false;
      this._error = e.message;
    }
  }

  /** Request a fresh process sample from the native host. */
  requestSample() {
    if (!this._port) {
      this.connect(); // try to reconnect
      return;
    }
    try {
      this._port.postMessage({ type: 'sample' });
    } catch (e) {
      this._error = e.message;
    }
  }

  /** Process a response message from the native host. */
  _processResponse(msg) {
    if (!msg) {
      this._connected = false;
      this._error = 'empty response';
      return;
    }

    if (msg.type === 'hello') {
      this._connected = true;
      this._version = msg.version;
      this._error = null;
      console.log(`[PerfMon] Native host connected: v${msg.version} (${msg.platform})`);
      return;
    }

    if (msg.type === 'sample') {
      this._lastSample = {};
      for (const ext of msg.extensions || []) {
        if (ext.extId) {
          this._lastSample[ext.extId] = {
            cpu: ext.cpu || 0,
            rss: ext.rss || 0,
            pid: ext.pid || 0,
          };
        }
      }
      this._lastSampleTime = Date.now();
      if (this._onSampleCallback) this._onSampleCallback(this._lastSample);
      return;
    }

    if (msg.type === 'error') {
      console.warn('[PerfMon] Native host error:', msg.message);
      this._error = msg.message;
    }
  }

  /** Set a callback to be invoked when a new sample arrives. */
  onSample(fn) {
    this._onSampleCallback = fn;
  }

  /** Get the last received process sample. */
  getLatest() {
    return { ...this._lastSample };
  }

  /** Check if native host is connected. */
  isConnected() {
    return this._connected;
  }

  /** Get status info for UI display. */
  getStatus() {
    return {
      connected: this._connected,
      version: this._version,
      error: this._error,
      lastSampleTime: this._lastSampleTime,
      extensionCount: Object.keys(this._lastSample).length,
    };
  }
}

// Export processResponse for testing
function processHostResponse(response, state) {
  if (!response || response.type === 'error') {
    state.connected = false;
    state.error = response?.message || 'Unknown error';
    return state;
  }
  if (response.type === 'hello') {
    state.connected = true;
    state.version = response.version;
    state.platform = response.platform;
    return state;
  }
  if (response.type === 'sample') {
    state.lastSample = {};
    for (const ext of response.extensions || []) {
      if (ext.extId) {
        state.lastSample[ext.extId] = { cpu: ext.cpu, rss: ext.rss, pid: ext.pid };
      }
    }
    state.lastSampleTime = Date.now();
    return state;
  }
  return state;
}

if (typeof module !== 'undefined') {
  module.exports = { NativeBridge, processHostResponse };
}
```

- [ ] **Step 5: Update test to import from module**

Update `tests/native-bridge.test.js` — replace the inline `processHostResponse` function with:

```js
const { processHostResponse } = require('../src/background/native-bridge.js');
```

Remove the inline function definition.

- [ ] **Step 6: Run tests**

Run: `node --test tests/native-bridge.test.js`
Expected: all 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add manifest.json src/shared/constants.js src/background/native-bridge.js tests/native-bridge.test.js
git commit -m "feat: add native bridge module for Chrome↔host communication"
```

---

### Task 4: Service Worker — Integrate Native Bridge

**Files:**
- Modify: `src/background/service-worker.js`
- Modify: `src/background/scorer.js`

- [ ] **Step 1: Update scorer to accept optional process data**

Modify `src/background/scorer.js`:

Replace the `WEIGHTS` and `calculateScore` function:

```js
const WEIGHTS_WITH_PROCESS = {
  cpu: 0.30,
  memory: 0.20,
  networkFrequency: 0.10,
  dataVolume: 0.05,
  permissions: 0.20,
  scope: 0.15,
};

const WEIGHTS_WITHOUT_PROCESS = {
  networkFrequency: 0.25,
  dataVolume: 0.15,
  permissions: 0.35,
  scope: 0.25,
};

const MAX_CPU = 25;
const MAX_RSS = 200 * 1024 * 1024;

function calculateScore(meta, activity, processData) {
  const permScore = normalizeValue(calculatePermissionScore(meta.permissions), MAX_PERMISSION_SCORE);
  const scopeScore = normalizeValue(calculateScopeScore(meta.contentScriptPatterns), MAX_SCOPE_SCORE);
  const netFreq = normalizeValue(activity.totalRequests, MAX_REQUESTS_PER_HOUR);
  const dataVol = normalizeValue(activity.totalBytes, MAX_BYTES_PER_HOUR);

  let raw;
  if (processData && (processData.cpu > 0 || processData.rss > 0)) {
    const w = WEIGHTS_WITH_PROCESS;
    const cpuScore = normalizeValue(processData.cpu, MAX_CPU);
    const memScore = normalizeValue(processData.rss, MAX_RSS);
    raw = cpuScore * w.cpu + memScore * w.memory +
          netFreq * w.networkFrequency + dataVol * w.dataVolume +
          permScore * w.permissions + scopeScore * w.scope;
  } else {
    const w = WEIGHTS_WITHOUT_PROCESS;
    raw = netFreq * w.networkFrequency + dataVol * w.dataVolume +
          permScore * w.permissions + scopeScore * w.scope;
  }

  return Math.min(100, Math.max(0, Math.round(raw)));
}
```

- [ ] **Step 2: Update service worker to use native bridge**

Modify `src/background/service-worker.js`:

Add `'./native-bridge.js'` to `importScripts`.

After the collector initialization, add:

```js
const nativeBridge = new NativeBridge();
nativeBridge.connect();

// Poll native host every 30 seconds
chrome.alarms.create('sample-native', { periodInMinutes: 0.5 });
```

Update the alarm listener to handle `sample-native`:

```js
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sample-native') {
    nativeBridge.requestSample();
  }
  if (alarm.name === 'aggregate' || alarm.name === 'mini-flush') {
    await flushAndPrune();
  }
});
```

In the `GET_LIVE_SNAPSHOT` handler, after calculating scores, add process data:

```js
const processData = nativeBridge.getLatest();

for (const [extId, meta] of Object.entries(stored.extensions)) {
  if (!activity[extId]) activity[extId] = { buckets: [], score: 0 };
  const totalRequests = activity[extId].buckets.reduce((s, b) => s + b.requests, 0);
  const totalBytes = activity[extId].buckets.reduce((s, b) => s + b.bytesTransferred, 0);
  const proc = processData[extId] || null;
  activity[extId].score = calculateScore(
    { permissions: meta.permissions || [], contentScriptPatterns: meta.contentScriptPatterns || [] },
    { totalRequests, totalBytes },
    proc
  );
  // Attach process data for UI
  if (proc) {
    activity[extId].cpu = proc.cpu;
    activity[extId].rss = proc.rss;
  }
}

sendResponse({
  activity,
  extensions: stored.extensions,
  settings: stored.settings,
  nativeConnected: nativeBridge.isConnected(),
});
```

- [ ] **Step 3: Update tests for new scorer signature**

Update `tests/scorer.test.js` — add tests for 3-arg version:

```js
it('score with process data is higher than without', () => {
  const meta = { permissions: ['storage'], contentScriptPatterns: [] };
  const activity = { totalRequests: 100, totalBytes: 10000 };
  const without = calculateScore(meta, activity);
  const withProc = calculateScore(meta, activity, { cpu: 10, rss: 80 * 1024 * 1024 });
  assert.ok(withProc > without, `${withProc} should > ${without}`);
});

it('high CPU produces high score even with few permissions', () => {
  const meta = { permissions: [], contentScriptPatterns: [] };
  const activity = { totalRequests: 0, totalBytes: 0 };
  const score = calculateScore(meta, activity, { cpu: 25, rss: 200 * 1024 * 1024 });
  assert.ok(score >= 40, `CPU-heavy score ${score} should >= 40`);
});
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/background/service-worker.js src/background/scorer.js tests/scorer.test.js
git commit -m "feat: integrate native bridge into service worker, CPU/MEM-aware scoring"
```

---

### Task 5: UI — Show CPU/Memory Data with Fallback

**Files:**
- Modify: `src/popup/popup.js`
- Modify: `src/sidepanel/overview.js`
- Modify: `src/sidepanel/details.js`
- Modify: `src/sidepanel/panel.js`
- Modify: `src/shared/i18n.js`

- [ ] **Step 1: Add i18n strings**

Add to both `en` and `zh` sections of `src/shared/i18n.js`:

English:
```js
kpiCpu: 'CPU',
kpiMemory: 'MEM',
nativeConnected: 'Native host connected — showing real CPU/memory',
nativeNotConnected: 'Install native host for CPU/memory data',
installGuide: 'Setup Guide',
```

Chinese:
```js
kpiCpu: 'CPU',
kpiMemory: '内存',
nativeConnected: '本地采集器已连接 — 显示真实 CPU/内存',
nativeNotConnected: '安装本地采集器以获取 CPU/内存数据',
installGuide: '安装指南',
```

- [ ] **Step 2: Update popup KPIs**

In `src/popup/popup.js`, in the `render` function:

If `nativeConnected` is true in the response, show CPU/MEM as the first two KPIs. Otherwise show Active/Requests as before.

```js
function render({ activity, extensions, settings, nativeConnected }) {
  const extEntries = buildExtensionEntries(activity, extensions, settings);
  const warningCount = extEntries.filter(e => e.score >= settings.alertThreshold).length;

  if (nativeConnected) {
    let totalCpu = 0, totalMem = 0;
    for (const e of extEntries) {
      totalCpu += e.cpu || 0;
      totalMem += e.rss || 0;
    }
    document.getElementById('kpi-active').textContent = totalCpu.toFixed(1) + '%';
    document.getElementById('kpi-traffic').textContent = formatBytes(totalMem);
    document.getElementById('lbl-active').textContent = t('kpiCpu');
    document.getElementById('lbl-traffic').textContent = t('kpiMemory');
  } else {
    const activeCount = Object.values(extensions).filter(e => e.enabled).length;
    const totalRequests = extEntries.reduce((s, e) => s + e.totalRequests, 0);
    document.getElementById('kpi-active').textContent = activeCount;
    document.getElementById('kpi-traffic').textContent = formatNumber(totalRequests);
    document.getElementById('lbl-active').textContent = t('kpiActive');
    document.getElementById('lbl-traffic').textContent = t('kpiRequests');
  }
  document.getElementById('kpi-warnings').textContent = warningCount;
  // ... rest of render
}
```

Update `buildExtensionEntries` to include `cpu` and `rss`:

```js
const cpu = act?.cpu || 0;
const rss = act?.rss || 0;
entries.push({ ..., cpu, rss });
```

- [ ] **Step 3: Update side panel overview**

In `src/sidepanel/overview.js`, update `renderOverviewSection`:

- If `currentData.nativeConnected`, show CPU and MEM as first two KPI cards
- Otherwise show Active and Requests as fallback
- Chart: if native connected, show per-extension CPU bars instead of network chart

Update `buildSortedEntries` to include `cpu` and `rss`.

- [ ] **Step 4: Update details cards**

In `src/sidepanel/details.js`, in the expanded card body, add CPU and Memory rows when data is available:

```js
${(entry.cpu > 0 || entry.rss > 0) ? `
  <div class="ext-detail-row">
    <span class="ext-detail-label">CPU</span>
    <span class="ext-detail-value">${entry.cpu.toFixed(1)}%</span>
  </div>
  <div class="ext-detail-row">
    <span class="ext-detail-label">Memory (RSS)</span>
    <span class="ext-detail-value">${formatBytes(entry.rss)}</span>
  </div>
` : ''}
```

- [ ] **Step 5: Add native host status banner in panel**

In `src/sidepanel/panel.js`, in `renderAll`, add a small status line at the top:

```js
const statusBanner = currentData.nativeConnected
  ? `<div class="native-status connected">${escapeHtml(t('nativeConnected'))}</div>`
  : `<div class="native-status">${escapeHtml(t('nativeNotConnected'))}</div>`;
```

Add CSS class `.native-status` in `panel.css`:
```css
.native-status {
  font-size: 10px; color: var(--fg-dim); text-align: center;
  padding: 4px 0; margin-bottom: 8px;
}
.native-status.connected { color: var(--accent); }
```

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/ tests/
git commit -m "feat: UI shows real CPU/MEM when native host connected, graceful fallback"
```

---

### Task 6: Documentation & README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Native Host section to README**

Add after the "Install" section:

```markdown
### Enable CPU/Memory Monitoring (Optional)

The extension shows permission-based impact scores by default. For **real CPU% and memory (RSS)** data, install the native host:

1. Find your extension ID at `chrome://extensions/` (enable Developer mode)
2. Run the installer:
   ```bash
   cd native-host
   ./install.sh <your-extension-id>
   ```
3. Restart Chrome

The side panel will show "Native host connected" when active. Without the native host, the extension still works — it just shows network + permission analysis instead of CPU/memory.

#### How it works

The native host is a small Python script that reads `ps` output to find Chrome extension renderer processes. It matches them to extension IDs via command-line flags and reports CPU% and RSS (resident memory) back to the extension over stdin/stdout.

#### Uninstall native host

```bash
# macOS
rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.perfmonitor.host.json

# Linux
rm ~/.config/google-chrome/NativeMessagingHosts/com.perfmonitor.host.json
```
```

- [ ] **Step 2: Update permissions table**

Add row:
```
| `nativeMessaging` | Communicate with local process sampler for CPU/memory data |
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add native host setup instructions to README"
```
