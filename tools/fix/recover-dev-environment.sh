#!/usr/bin/env bash
set -euo pipefail

echo "🧠 AGI-SUITE CLEAN RECOVERY START (ROBUST MODE)"

kill_port() {
  PORT=$1
  echo "🔪 Killing processes on port $PORT"

  PIDS=$(ss -lptn "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true)

  if [ -n "${PIDS:-}" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
  else
    echo "✔ No process found on port $PORT"
  fi
}

kill_port 3001
kill_port 5173

echo "🧹 Killing stale node/vite processes..."
pkill -f "tsx watch" || true
pkill -f vite || true
pkill -f node || true

sleep 2

echo "🚀 Starting API server..."
cd ~/Agi-Suite/apps/api-server
nohup pnpm dev > api.log 2>&1 &

echo "🚀 Starting frontend..."
cd ~/Agi-Suite/apps/r3-agi
nohup pnpm dev > vite.log 2>&1 &

echo "✅ RECOVERY COMPLETE"
echo "API: http://localhost:3001"
echo "UI:  http://localhost:5173"
