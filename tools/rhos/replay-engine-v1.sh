#!/usr/bin/env bash

set -euo pipefail

echo "======================================"
echo "🧠 RHOS TIME-TRAVEL REPLAY ENGINE v1"
echo "======================================"

EVENT_LOG="$HOME/.rhos_state/event-log.jsonl"
SNAP_DIR="$HOME/.rhos_state/snapshots"

mkdir -p "$SNAP_DIR"
touch "$EVENT_LOG"

MODE="${1:-latest}"

# ----------------------------
# LOG EVENT
# ----------------------------
log_event() {
  local type=$1
  local data=$2

  echo "{\"ts\":$(date +%s),\"type\":\"$type\",\"data\":\"$data\"}" >> "$EVENT_LOG"
}

# ----------------------------
# REPLAY EVENTS
# ----------------------------
replay() {
  echo "[REPLAY] mode=$MODE"

  while read -r line; do
    TYPE=$(echo "$line" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
    DATA=$(echo "$line" | grep -o '"data":"[^"]*"' | cut -d'"' -f4)

    echo "[REPLAY] $TYPE → $DATA"

    case "$TYPE" in
      "disk")
        echo "[SIM] disk evaluation replayed"
        ;;

      "policy")
        echo "[SIM] policy decision replayed"
        ;;

      "enforce")
        echo "[SIM] enforcement action replayed"
        ;;

      "transaction")
        echo "[SIM] transaction boundary replayed"
        ;;
    esac

  done < "$EVENT_LOG"
}

# ----------------------------
# FORK SIMULATION MODE
# ----------------------------
fork_simulation() {
  echo "[FORK] creating simulated branch state"

  SIM_ID=$(date +%s)
  mkdir -p "$SNAP_DIR/fork-$SIM_ID"

  cp "$EVENT_LOG" "$SNAP_DIR/fork-$SIM_ID/event-log.jsonl"

  echo "[FORK] simulation ready: fork-$SIM_ID"
}

# ----------------------------
# MAIN
# ----------------------------
case "$MODE" in
  "replay")
    replay
    ;;

  "fork")
    fork_simulation
    ;;

  "latest")
    echo "[ENGINE] no mode selected, showing last events"
    tail -n 20 "$EVENT_LOG"
    ;;

  *)
    echo "[ENGINE] unknown mode"
    exit 1
    ;;
esac
