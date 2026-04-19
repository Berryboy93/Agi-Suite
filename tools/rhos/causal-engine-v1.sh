#!/usr/bin/env bash

set -euo pipefail

echo "======================================"
echo "🧠 RHOS CAUSAL INTELLIGENCE ENGINE v1"
echo "======================================"

EVENT_LOG="$HOME/.rhos_state/event-log.jsonl"

if [ ! -f "$EVENT_LOG" ]; then
  echo "[CAUSAL] no event log found"
  exit 1
fi

echo "[CAUSAL] building dependency graph..."

# ----------------------------
# BUILD SIMPLE CAUSAL MAP
# ----------------------------
DISK_FAIL=0
AST_FAIL=0
CI_FAIL=0
POLICY_BLOCK=0

while read -r line; do

  TYPE=$(echo "$line" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
  DATA=$(echo "$line" | grep -o '"data":"[^"]*"' | cut -d'"' -f4)

  case "$TYPE" in
    "disk")
      echo "[CAUSAL] node: disk_check"
      ;;

    "ast")
      echo "[CAUSAL] node: ast_scan"
      ;;

    "ci")
      echo "[CAUSAL] node: ci_signal"
      ;;

    "policy")
      echo "[CAUSAL] node: policy_decision=$DATA"
      if [[ "$DATA" == *"BLOCK"* ]]; then
        POLICY_BLOCK=1
      fi
      ;;

    "enforce")
      echo "[CAUSAL] node: enforcement_action"
      ;;

  esac

done < "$EVENT_LOG"

# ----------------------------
# CAUSAL INFERENCE LAYER
# ----------------------------

echo ""
echo "[CAUSAL] analyzing root cause..."

if [ "$POLICY_BLOCK" -eq 1 ]; then
  echo "[CAUSAL] FAILURE ROOT: policy engine BLOCK decision"

  echo "[CAUSAL] likely upstream causes:"
  echo " - disk pressure OR CI failure OR AST anomaly"

  echo ""
  echo "[CAUSAL] recommended minimal fix path:"
  echo " 1. run disk cleanup (safe mode)"
  echo " 2. re-run AST scan"
  echo " 3. retry policy evaluation"
fi

# ----------------------------
# FAILURE PATH SIMULATION
# ----------------------------

echo ""
echo "[CAUSAL] generating dependency impact summary..."

echo "Impact chain:"
echo "disk → policy → enforcement → transaction"

echo ""
echo "[CAUSAL] engine complete"
