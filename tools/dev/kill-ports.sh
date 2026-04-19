#!/usr/bin/env bash
set -euo pipefail

PORTS=(3001 5173 5174 5175)

echo "🔪 Bulletproof port cleanup..."

for PORT in "${PORTS[@]}"; do
  PIDS=$(ss -lptn "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true)

  if [ -n "${PIDS:-}" ]; then
    echo "Killing port $PORT -> $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
  else
    echo "✔ port $PORT clean"
  fi
done

# extra safety net
pkill -f tsx || true
pkill -f vite || true
pkill -f "pnpm.*dev" || true
pkill -f node || true

echo "✅ Process layer cleaned"
