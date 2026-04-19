#!/usr/bin/env bash

set -euo pipefail

echo "======================================"
echo "🧠 RHOS ENFORCEMENT KERNEL v1"
echo "======================================"

# ----------------------------
# RUN POLICY ENGINE
# ----------------------------
POLICY_OUTPUT=$("$HOME/Agi-Suite/tools/rhos/policy-engine-v1.sh")
POLICY_STATUS=$?

# ----------------------------
# LOAD STATE
# ----------------------------
STATE_FILE="$HOME/.rhos_state/policy.json"

if [ ! -f "$STATE_FILE" ]; then
  echo "[ENFORCER] missing policy state → FAIL SAFE BLOCK"
  exit 1
fi

DECISION=$(cat "$STATE_FILE" | grep decision | cut -d '"' -f4)

echo "[ENFORCER] decision=$DECISION"

# ----------------------------
# SAFE MODE ACTIONS
# ----------------------------

safe_cleanup() {
  echo "[ENFORCER] running SAFE cleanup (non-destructive)"

  # Only safe operations
  find ~/Agi-Suite ~/Stable -type f -name "*.log" -delete 2>/dev/null || true
  rm -rf ~/.cache/pnpm 2>/dev/null || true

  echo "[ENFORCER] safe cleanup complete"
}

# ----------------------------
# BLOCK MODE ACTIONS
# ----------------------------

block_execution() {
  echo "[ENFORCER] BLOCK triggered"
  echo "[ENFORCER] stopping execution pipeline"
  exit 1
}

# ----------------------------
# ALLOW MODE ACTIONS
# ----------------------------

allow_execution() {
  echo "[ENFORCER] system healthy → continuing pipeline"
  return 0
}

# ----------------------------
# DECISION ROUTER
# ----------------------------

case "$DECISION" in
  "ALLOW")
    allow_execution
    ;;

  "WARN")
    safe_cleanup
    ;;

  "BLOCK")
    block_execution
    ;;

  *)
    echo "[ENFORCER] UNKNOWN STATE → FAIL SAFE BLOCK"
    exit 1
    ;;
esac

# ----------------------------
# PIPELINE CONTINUATION HOOK
# ----------------------------

echo "[ENFORCER] kernel completed successfully"

exit 0
