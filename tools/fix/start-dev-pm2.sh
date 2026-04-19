#!/usr/bin/env bash
set -euo pipefail

echo "🧠 Starting AGI-Suite via PM2 (SAFE MODE)"

cd ~/Agi-Suite

pm2 delete all || true

pm2 start "pnpm --filter @workspace/api-server dev" --name api
pm2 start "pnpm --filter @workspace/r3-agi dev" --name ui

pm2 save

echo "✅ Running:"
pm2 status
