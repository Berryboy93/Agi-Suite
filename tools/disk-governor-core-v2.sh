#!/usr/bin/env bash

set -euo pipefail

echo "[DISK-GOV-v2.1] evaluating system..."

# ----------------------------
# SAFE DIR GUARANTEE
# ----------------------------
mkdir -p "$HOME/.rhos_state"

# ----------------------------
# METRICS
# ----------------------------
ROOT_USAGE=$(df / | awk 'NR==2 {gsub("%","",$5); print $5}')

STABLE_SIZE=$(du -sm "$HOME/Stable" 2>/dev/null | awk '{print $1}' || echo 0)
AGI_SIZE=$(du -sm "$HOME/Agi-Suite" 2>/dev/null | awk '{print $1}' || echo 0)

MAX_ROOT=85
MAX_WORKSPACE=6000

STATE="OK"
EXIT_CODE=0

# ----------------------------
# DECISION ENGINE
# ----------------------------
if [ "$ROOT_USAGE" -ge "$MAX_ROOT" ]; then
  STATE="FAIL"
  EXIT_CODE=1
elif [ "$STABLE_SIZE" -gt "$MAX_WORKSPACE" ] || [ "$AGI_SIZE" -gt "$MAX_WORKSPACE" ]; then
  STATE="DEGRADED"
  EXIT_CODE=0   # CI SAFE: not a failure condition
fi

echo "[DISK-GOV-v2.1] state=$STATE"

# ----------------------------
# ATOMIC SAFE WRITE (SAME FS GUARANTEED)
# ----------------------------
STATE_FILE="$HOME/.rhos_state/disk.json"
TMP_FILE="$STATE_FILE.tmp"

cat > "$TMP_FILE" <<EOF
{
  "state": "$STATE",
  "root_usage": "$ROOT_USAGE",
  "stable_mb": "$STABLE_SIZE",
  "agi_mb": "$AGI_SIZE"
}
EOF

mv "$TMP_FILE" "$STATE_FILE"

# ----------------------------
# RHOS COMPATIBLE OUTPUT
# ----------------------------
if [ "$STATE" = "FAIL" ]; then
  echo "[DISK-GOV-v2.1] BLOCKING"
  exit 1
fi

if [ "$STATE" = "DEGRADED" ]; then
  echo "[DISK-GOV-v2.1] WARNING (non-blocking)"
fi

exit 0
