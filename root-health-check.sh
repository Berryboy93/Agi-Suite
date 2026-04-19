#!/usr/bin/env bash

set -euo pipefail

echo "[RHOS-GATE-v2] starting preflight validation..."

SCRIPT="./root-health-check.sh"

if [ ! -f "$SCRIPT" ]; then
  echo "[RHOS-GATE-v2] ERROR: missing health check script"
  exit 1
fi

# ----------------------------
# RUN WITH ERROR PRESERVATION
# ----------------------------
set +e
OUTPUT=$($SCRIPT)
STATUS=$?
set -e

echo "$OUTPUT"

# ----------------------------
# BASIC STATE
# ----------------------------
STATE="OK"

if [ $STATUS -ne 0 ]; then
  STATE="FAIL"
fi

# ----------------------------
# EXTRACT KEY SIGNALS (LIGHT PARSING LAYER)
# ----------------------------
DISK_USAGE=$(echo "$OUTPUT" | grep -Eo '[0-9]+%' | head -1 | tr -d '%')
NODE_OK=$(echo "$OUTPUT" | grep -c "Node installed" || true)
PNPM_OK=$(echo "$OUTPUT" | grep -c "pnpm installed" || true)

# ----------------------------
# STATE ENHANCEMENT LOGIC
# ----------------------------
if [ "${DISK_USAGE:-0}" -gt 90 ]; then
  STATE="FAIL"
elif [ "${DISK_USAGE:-0}" -gt 80 ]; then
  STATE="DEGRADED"
fi

if [ "$NODE_OK" -eq 0 ] || [ "$PNPM_OK" -eq 0 ]; then
  STATE="DEGRADED"
fi

# ----------------------------
# OUTPUT DECISION
# ----------------------------
echo ""
echo "[RHOS-GATE-v2] STATE: $STATE"

if [ "$STATE" = "FAIL" ]; then
  echo "[RHOS-GATE-v2] BLOCKING RHOS KERNEL"
  exit 1
fi

if [ "$STATE" = "DEGRADED" ]; then
  echo "[RHOS-GATE-v2] WARNING: degraded mode enabled"
fi

# ----------------------------
# STRUCTURED STATE EXPORT (CI READY)
# ----------------------------
mkdir -p ~/.rhos_state

cat > ~/.rhos_state/preflight.json <<EOF
{
  "state": "$STATE",
  "disk_usage": "${DISK_USAGE:-unknown}",
  "node_ok": "$NODE_OK",
  "pnpm_ok": "$PNPM_OK",
  "timestamp": "$(date -Iseconds)"
}
EOF

echo "[RHOS-GATE-v2] preflight complete"

exit 0
