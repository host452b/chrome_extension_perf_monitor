#!/bin/bash
set -e

HOST_NAME="com.perfmonitor.host"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$SCRIPT_DIR/perf_monitor_host.py"

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
        exit 1
        ;;
esac

mkdir -p "$TARGET_DIR"

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

chmod +x "$HOST_PATH"

echo ""
echo "Installed native messaging host:"
echo "  Manifest: $TARGET_DIR/$HOST_NAME.json"
echo "  Host:     $HOST_PATH"
echo "  Origin:   $ORIGIN"
echo ""
echo "Restart Chrome, then the extension will auto-detect the native host."
echo ""
