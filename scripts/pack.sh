#!/usr/bin/env bash
set -euo pipefail

# ── Config ──────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
OUT_DIR="$ROOT_DIR/releases"
MANIFEST="$ROOT_DIR/manifest.json"

# ── Parse version ───────────────────────────────────
VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST" \
  | head -1 | grep -o '"[^"]*"$' | tr -d '"')
if [[ -z "$VERSION" ]]; then
  echo "ERROR: Could not parse version from $MANIFEST" >&2
  exit 1
fi

echo "Building Extension Audit v${VERSION}..."

# ── Clean dist ──────────────────────────────────────
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# ── Copy production files only ──────────────────────
cp "$ROOT_DIR/manifest.json" "$DIST_DIR/"
cp -r "$ROOT_DIR/src" "$DIST_DIR/src"
cp -r "$ROOT_DIR/assets/icons" "$DIST_DIR/assets/icons" 2>/dev/null && mkdir -p "$DIST_DIR/assets" && cp -r "$ROOT_DIR/assets/icons" "$DIST_DIR/assets/" || true

# Flatten: copy assets/icons to dist
mkdir -p "$DIST_DIR/assets/icons"
cp "$ROOT_DIR/assets/icons/"*.png "$DIST_DIR/assets/icons/"

# ── Remove dev-only files from dist ─────────────────
find "$DIST_DIR" \( \
  -name "*.test.*" -o \
  -name "*.spec.*" -o \
  -name "*.map" -o \
  -name ".env*" -o \
  -name ".DS_Store" -o \
  -name "Thumbs.db" -o \
  -name "node_modules" -o \
  -name ".git" \
\) -exec rm -rf {} + 2>/dev/null || true

# ── Validate: manifest.json at root ────────────────
if [[ ! -f "$DIST_DIR/manifest.json" ]]; then
  echo "ERROR: manifest.json must be at dist/ root" >&2
  exit 1
fi

# ── Validate: no forbidden files ────────────────────
FORBIDDEN=$(find "$DIST_DIR" \( \
  -name "*.ts" ! -name "*.d.ts" -o \
  -name "*.map" -o \
  -name ".env*" -o \
  -name "*.test.*" -o \
  -name "*.spec.*" \
\) -print 2>/dev/null || true)

if [[ -n "$FORBIDDEN" ]]; then
  echo "ERROR: Forbidden files found in dist:" >&2
  echo "$FORBIDDEN" >&2
  exit 1
fi

# ── Security checks ────────────────────────────────
echo ""
echo "=== Security Audit ==="

# Check for eval/new Function
EVAL_HITS=$(grep -rn 'eval\s*(' "$DIST_DIR/src/" --include="*.js" 2>/dev/null || true)
FUNC_HITS=$(grep -rn 'new\s\+Function\s*(' "$DIST_DIR/src/" --include="*.js" 2>/dev/null || true)
if [[ -n "$EVAL_HITS" || -n "$FUNC_HITS" ]]; then
  echo "WARNING: eval() or new Function() found:" >&2
  echo "$EVAL_HITS" "$FUNC_HITS" >&2
else
  echo "  [PASS] No eval() or new Function()"
fi

# Check for remote script loading
REMOTE_SCRIPT=$(grep -rn '<script.*src=.*http' "$DIST_DIR/src/" --include="*.html" 2>/dev/null || true)
if [[ -n "$REMOTE_SCRIPT" ]]; then
  echo "WARNING: Remote script loading found:" >&2
  echo "$REMOTE_SCRIPT" >&2
else
  echo "  [PASS] No remote script loading"
fi

# Check for unsafe innerHTML with user input (basic heuristic)
INNERHTML=$(grep -rn 'innerHTML.*\${' "$DIST_DIR/src/" --include="*.js" 2>/dev/null | grep -v 'escapeHtml\|escapeAttr' || true)
if [[ -n "$INNERHTML" ]]; then
  echo "  [WARN] innerHTML with template literals (verify escaping):"
  echo "$INNERHTML" | head -5
else
  echo "  [PASS] innerHTML usage appears safe (escapeHtml/escapeAttr used)"
fi

# Check permissions are minimal
PERMS=$(python3 -c "import json; m=json.load(open('$DIST_DIR/manifest.json')); print(', '.join(m.get('permissions',[])))" 2>/dev/null || echo "?")
echo "  [INFO] Permissions: $PERMS"
HOST_PERMS=$(python3 -c "import json; m=json.load(open('$DIST_DIR/manifest.json')); hp=m.get('host_permissions',[]); print(', '.join(hp) if hp else 'none')" 2>/dev/null || echo "?")
echo "  [INFO] Host permissions: $HOST_PERMS"

echo ""

# ── Package ─────────────────────────────────────────
mkdir -p "$OUT_DIR"
ZIP_NAME="extension-audit-v${VERSION}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"

rm -f "$ZIP_PATH"

(cd "$DIST_DIR" && zip -r -9 "$ZIP_PATH" . \
  -x "*.DS_Store" -x "__MACOSX/*")

SIZE=$(wc -c < "$ZIP_PATH" | tr -d ' ')
SIZE_KB=$((SIZE / 1024))

echo "=== Package Ready ==="
echo "  File:     $ZIP_PATH"
echo "  Version:  $VERSION"
echo "  Size:     ${SIZE_KB} KB"

if [[ $SIZE -gt 10485760 ]]; then
  echo "  WARNING: Zip > 10MB — consider optimizing"
fi

echo ""
echo "=== Verify before upload ==="
echo "  1. unzip -l $ZIP_PATH | head -20"
echo "  2. Load from dist/ in Chrome to test"
echo "  3. Upload: https://chrome.google.com/webstore/devconsole"
echo ""
