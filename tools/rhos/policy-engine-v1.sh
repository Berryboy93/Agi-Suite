#!/usr/bin/env bash

set -euo pipefail

echo "[RHOS-POLICY] evaluating system signals..."

# ----------------------------
# LOAD GATES
# ----------------------------

DISK_OUTPUT=$("$HOME/Agi-Suite/tools/disk-governor-core-v2.1.sh" || true)
DISK_CODE=$?

HEALTH_OUTPUT=$("$HOME/Agi-Suite/tools/root-health-check.sh" || true)
HEALTH_CODE=$?

AST_OUTPUT=$("$HOME/Agi-Suite/tools/ris/scan.js" 2>/dev/null || true)
AST_CODE=$?

CI_CODE=${CI_STATUS:-0}

# ----------------------------
# DEFAULT WEIGHTS
# ----------------------------

DECISION="ALLOW"
RISK_SCORE=0

# ----------------------------
# DISK RULES
# ----------------------------
if [ "$DISK_CODE" -eq 1 ]; then
  RISK_SCORE=$((RISK_SCORE + 100))
elif [ "$DISK_CODE" -eq 2 ]; then
  RISK_SCORE=$((RISK_SCORE + 30))
fi

# ----------------------------
# HEALTH RULES
# ----------------------------
if [ "$HEALTH_CODE" -ne 0 ]; then
  RISK_SCORE=$((RISK_SCORE + 40))
fi

# ----------------------------
# AST RULES
# ----------------------------
if [ "$AST_CODE" -ne 0 ]; then
  RISK_SCORE=$((RISK_SCORE + 20))
fi

# ----------------------------
# CI RULES
# ----------------------------
if [ "$CI_CODE" -ne 0 ]; then
  RISK_SCORE=$((RISK_SCORE + 60))
fi

# ----------------------------
# FINAL DECISION LOGIC
# ----------------------------

if [ "$RISK_SCORE" -ge 100 ]; then
  DECISION="BLOCK"
elif [ "$RISK_SCORE" -ge 40 ]; then
  DECISION="WARN"
else
  DECISION="ALLOW"
fi

# ----------------------------
# OUTPUT STATE
# ----------------------------

mkdir -p "$HOME/.rhos_state"

cat > "$HOME/.rhos_state/policy.json" <<EOF
{
  "decision": "$DECISION",
  "risk_score": $RISK_SCORE,
  "disk_code": $DISK_CODE,
  "health_code": $HEALTH_CODE,
  "ast_code": $AST_CODE,
  "ci_code": $CI_CODE
}
EOF

echo "[RHOS-POLICY] decision=$DECISION risk=$RISK_SCORE"

# ----------------------------
# ENFORCEMENT
# ----------------------------

if [ "$DECISION" = "BLOCK" ]; then
  echo "[RHOS-POLICY] EXECUTION BLOCKED"
  exit 1
fi

if [ "$DECISION" = "WARN" ]; then
  echo "[RHOS-POLICY] WARNING MODE (degraded system)"
fi

exit 0
