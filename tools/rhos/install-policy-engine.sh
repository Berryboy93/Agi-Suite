#!/usr/bin/env bash

set -euo pipefail

echo "======================================"
echo "🧠 RHOS POLICY ENGINE INSTALL + RUNNER"
echo "======================================"

ROOT_DIR="$HOME/Agi-Suite"

# ----------------------------
# SAFETY SETUP
# ----------------------------
mkdir -p "$ROOT_DIR/tools/rhos"
mkdir -p "$HOME/.rhos_state"

POLICY_FILE="$ROOT_DIR/tools/rhos/policy-engine-v1.sh"

# ----------------------------
# CREATE POLICY ENGINE
# ----------------------------
cat > "$POLICY_FILE" <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

echo "[RHOS-POLICY] evaluating system signals..."

# ----------------------------
# DISK GATE
# ----------------------------
DISK_OUTPUT=$("$HOME/Agi-Suite/tools/disk-governor-core-v2.1.sh" || true)
DISK_CODE=$?

# ----------------------------
# HEALTH GATE
# ----------------------------
HEALTH_OUTPUT=$("$HOME/Agi-Suite/tools/root-health-check.sh" || true)
HEALTH_CODE=$?

# ----------------------------
# AST GATE (FIXED: NODE EXECUTION)
# ----------------------------
AST_OUTPUT=$(node "$HOME/Agi-Suite/tools/ris/scan.js" 2>/dev/null || true)
AST_CODE=$?

# ----------------------------
# CI SIGNAL (optional env hook)
# ----------------------------
CI_CODE=${CI_STATUS:-0}

# ----------------------------
# RISK MODEL
# ----------------------------
DECISION="ALLOW"
RISK_SCORE=0

# DISK scoring
if [ "$DISK_CODE" -eq 1 ]; then
  RISK_SCORE=$((RISK_SCORE + 100))
elif [ "$DISK_CODE" -eq 2 ]; then
  RISK_SCORE=$((RISK_SCORE + 30))
fi

# HEALTH scoring
if [ "$HEALTH_CODE" -ne 0 ]; then
  RISK_SCORE=$((RISK_SCORE + 40))
fi

# AST scoring
if [ "$AST_CODE" -ne 0 ]; then
  RISK_SCORE=$((RISK_SCORE + 20))
fi

# CI scoring
if [ "$CI_CODE" -ne 0 ]; then
  RISK_SCORE=$((RISK_SCORE + 60))
fi

# ----------------------------
# DECISION ENGINE
# ----------------------------
if [ "$RISK_SCORE" -ge 100 ]; then
  DECISION="BLOCK"
elif [ "$RISK_SCORE" -ge 40 ]; then
  DECISION="WARN"
else
  DECISION="ALLOW"
fi

# ----------------------------
# OUTPUT STATE (ATOMIC SAFE)
# ----------------------------
STATE_FILE="$HOME/.rhos_state/policy.json"
TMP_FILE="$STATE_FILE.tmp"

cat > "$TMP_FILE" <<EOFJSON
{
  "decision": "$DECISION",
  "risk_score": $RISK_SCORE,
  "disk_code": $DISK_CODE,
  "health_code": $HEALTH_CODE,
  "ast_code": $AST_CODE,
  "ci_code": $CI_CODE
}
EOFJSON

mv "$TMP_FILE" "$STATE_FILE"

# ----------------------------
# RESULT
# ----------------------------
echo "[RHOS-POLICY] decision=$DECISION risk=$RISK_SCORE"

if [ "$DECISION" = "BLOCK" ]; then
  echo "[RHOS-POLICY] EXECUTION BLOCKED"
  exit 1
fi

if [ "$DECISION" = "WARN" ]; then
  echo "[RHOS-POLICY] WARNING MODE"
fi

exit 0
EOF

chmod +x "$POLICY_FILE"

# ----------------------------
# RUN TEST
# ----------------------------
echo ""
echo "======================================"
echo "🧪 RUNNING POLICY ENGINE TEST"
echo "======================================"

bash "$POLICY_FILE"

EXIT_CODE=$?

echo ""
echo "======================================"

if [ $EXIT_CODE -eq 0 ]; then
  echo "🟢 RHOS POLICY ENGINE: OK / WARN"
elif [ $EXIT_CODE -eq 1 ]; then
  echo "🔴 RHOS POLICY ENGINE: BLOCKED"
else
  echo "⚠️ RHOS POLICY ENGINE: UNKNOWN STATE"
fi

echo "======================================"
