#!/usr/bin/env bash

set -euo pipefail

echo "======================================"
echo "🧠 RHOS TRANSACTIONAL KERNEL v1"
echo "======================================"

ROOT="$HOME/Agi-Suite"
SNAP_DIR="$HOME/.rhos_state/snapshots"

mkdir -p "$SNAP_DIR"

TX_ID=$(date +%s)

echo "[TX] starting transaction: $TX_ID"

# ----------------------------
# LOAD DECISION
# ----------------------------
POLICY_FILE="$HOME/.rhos_state/policy.json"

if [ ! -f "$POLICY_FILE" ]; then
  echo "[TX] missing policy → abort"
  exit 1
fi

DECISION=$(cat "$POLICY_FILE" | grep decision | cut -d '"' -f4)

echo "[TX] decision=$DECISION"

# ----------------------------
# SNAPSHOT (GIT + FILE STATE)
# ----------------------------
snapshot() {
  local name=$1

  echo "[TX] snapshot: $name"

  mkdir -p "$SNAP_DIR/$TX_ID"

  # git snapshot if repo exists
  if [ -d "$ROOT/.git" ]; then
    git -C "$ROOT" status > "$SNAP_DIR/$TX_ID/git-status.txt" || true
    git -C "$ROOT" diff > "$SNAP_DIR/$TX_ID/git-diff.txt" || true
  fi

  # file manifest (lightweight)
  find "$ROOT" -type f -maxdepth 3 2>/dev/null | head -2000 \
    > "$SNAP_DIR/$TX_ID/file-list.txt"
}

rollback() {
  echo "[TX] ROLLBACK TRIGGERED"

  if [ -d "$ROOT/.git" ]; then
    echo "[TX] restoring via git reset"
    git -C "$ROOT" reset --hard HEAD || true
    git -C "$ROOT" clean -fd || true
  fi

  echo "[TX] rollback complete"
}

safe_exec() {
  echo "[TX] executing SAFE operations"

  # safe cleanup only
  find "$ROOT" -type f -name "*.log" -delete 2>/dev/null || true
  rm -rf ~/.cache/pnpm 2>/dev/null || true
}

danger_exec() {
  echo "[TX] EXECUTION BLOCKED (no mutation allowed)"
  exit 1
}

# ----------------------------
# TRANSACTION FLOW
# ----------------------------
snapshot "pre-state"

case "$DECISION" in
  "ALLOW")
    echo "[TX] mode=ALLOW"
    safe_exec
    ;;

  "WARN")
    echo "[TX] mode=WARN"
    safe_exec
    ;;

  "BLOCK")
    echo "[TX] mode=BLOCK"
    rollback
    danger_exec
    ;;
esac

# ----------------------------
# COMMIT TRANSACTION STATE
# ----------------------------
echo "$DECISION" > "$SNAP_DIR/$TX_ID/decision.txt"

echo "[TX] transaction complete: $TX_ID"

exit 0
