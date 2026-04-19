#!/usr/bin/env bash
set -euo pipefail

ROOT=~/Agi-Suite

echo "🔥 R3 BULLETPROOF DEV KERNEL STARTING"

cd "$ROOT"

# enforce single runtime
~/Agi-Suite/tools/dev/mode-lock.sh

# cleanup everything first
~/Agi-Suite/tools/dev/kill-ports.sh

# fix dependencies before boot
~/Agi-Suite/tools/dev/doctor.sh

# ensure install integrity
pnpm install --silent

echo "🚀 Starting API..."
pnpm --filter @workspace/api-server dev &
API_PID=$!

echo "🚀 Starting UI..."
pnpm --filter @workspace/r3-agi dev &
UI_PID=$!

echo "🧠 Kernel Active"
echo "API PID: $API_PID"
echo "UI  PID: $UI_PID"

wait $API_PID $UI_PID
