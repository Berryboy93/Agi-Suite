#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo "🧠 PNPM WORKSPACE AUTO-FIX v1.1 (SAFE)"
echo "======================================"

# ----------------------------
# FIND REPO ROOT (IMPORTANT FIX)
# ----------------------------
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

cd "$ROOT"

echo "[ROOT] $ROOT"

WORKSPACE_FILE="$ROOT/pnpm-workspace.yaml"

if [ ! -f "$WORKSPACE_FILE" ]; then
  echo "[ERROR] pnpm-workspace.yaml not found at repo root"
  exit 1
fi

# ----------------------------
# FIND PACKAGES (FIXED)
# ----------------------------
echo "[SCAN] Searching repo packages..."

mapfile -t PKGS < <(find "$ROOT" \
  -name package.json \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  | sed 's|/package.json||')

echo ""
echo "[FOUND PACKAGES]"
for p in "${PKGS[@]}"; do
  echo " - $p"
done

echo ""

# ----------------------------
# BUILD SAFE WORKSPACE GLOBS
# ----------------------------
NEW_WS="packages:"
NEW_WS+="\n"

HAS_LIB=0
HAS_APPS=0
HAS_ARTIFACTS=0
HAS_SCRIPTS=0

for p in "${PKGS[@]}"; do
  [[ "$p" == *"/lib/"* ]] && HAS_LIB=1
  [[ "$p" == *"/apps/"* ]] && HAS_APPS=1
  [[ "$p" == *"/artifacts/"* ]] && HAS_ARTIFACTS=1
  [[ "$p" == *"/scripts"* ]] && HAS_SCRIPTS=1
done

if [ $HAS_APPS -eq 1 ]; then
  NEW_WS+="  - \"apps/*\"\n"
fi

if [ $HAS_LIB -eq 1 ]; then
  NEW_WS+="  - \"lib/*\"\n"
fi

if [ $HAS_ARTIFACTS -eq 1 ]; then
  NEW_WS+="  - \"artifacts/*\"\n"
fi

if [ $HAS_SCRIPTS -eq 1 ]; then
  NEW_WS+="  - \"scripts\"\n"
fi

echo ""
echo "=============================="
echo "PROPOSED WORKSPACE CONFIG"
echo "=============================="
echo -e "$NEW_WS"
echo "=============================="

read -p "Apply changes? (y/n): " CONFIRM

if [[ "$CONFIRM" != "y" ]]; then
  echo "[ABORTED]"
  exit 0
fi

# ----------------------------
# BACKUP (FIXED PATH)
# ----------------------------
BACKUP="$WORKSPACE_FILE.bak.$(date +%s)"
cp "$WORKSPACE_FILE" "$BACKUP"

echo "[BACKUP] $BACKUP"

# ----------------------------
# WRITE FIX
# ----------------------------
echo -e "$NEW_WS" > "$WORKSPACE_FILE"

echo "[OK] workspace updated"

# ----------------------------
# VERIFY
# ----------------------------
echo ""
echo "[VERIFY]"
pnpm list -r || true

echo ""
echo "[DONE]"