#!/bin/bash
# Remote installer for Extension Perf Monitor native host.
# Usage: curl -sL <url>/install-remote.sh | bash -s <extension-id>
set -e

EXT_ID="${1:?Usage: bash install-remote.sh <extension-id>}"
HOST_NAME="com.perfmonitor.host"
REPO="https://raw.githubusercontent.com/host452b/chrome_extension_perf_monitor/main"

OS="$(uname -s)"
case "$OS" in
  Darwin) TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" ;;
  Linux)  TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts" ;;
  *)      echo "Unsupported: $OS"; exit 1 ;;
esac

HOST_DIR="$HOME/.perfmonitor"
HOST_PATH="$HOST_DIR/perf_monitor_host.py"

# Download host script
mkdir -p "$HOST_DIR" "$TARGET_DIR"
curl -sL "$REPO/native-host/perf_monitor_host.py" -o "$HOST_PATH"
chmod +x "$HOST_PATH"

# Write native messaging manifest
cat > "$TARGET_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Extension Perf Monitor — native process sampler",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF

echo ""
echo "Done. Restart Chrome to activate CPU/memory monitoring."
echo ""
