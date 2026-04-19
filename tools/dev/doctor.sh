#!/usr/bin/env bash
set -euo pipefail
echo "🧠 Dependency health check..."
cd ~/Agi-Suite

# Check for @anthropic-ai/sdk — presence confirms full api-server is installed.
# If missing, node_modules is stale or corrupt — reinstall cleanly.
if ! [ -d "apps/api-server/node_modules/@anthropic-ai" ]; then
  echo "⚠️ api-server node_modules stale or missing — reinstalling..."
  pnpm install --silent
fi

echo "✅ Dependencies OK"
