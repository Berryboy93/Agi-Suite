#!/usr/bin/env bash
set -euo pipefail

echo "🧠 Restoring pnpm catalog (fixing missing catalog.default)"

FILE="pnpm-workspace.yaml"

if [ ! -f "$FILE" ]; then
  echo "❌ pnpm-workspace.yaml not found"
  exit 1
fi

# Backup
cp "$FILE" "$FILE.bak.$(date +%s)"

# Append catalog block ONLY if missing
if ! grep -q "^catalog:" "$FILE"; then
  cat >> "$FILE" << 'YAML'

catalog:
  @tanstack/react-query: ^5.90.21
  zod: ^3.25.76
  drizzle-orm: ^0.45.2
  tsx: ^4.21.0
YAML
fi

echo "✔ catalog block ensured"

rm -rf node_modules pnpm-lock.yaml

echo "🧹 cleaned install state"

pnpm store prune || true

echo "📦 reinstalling..."
pnpm install

echo "✅ catalog restore complete"
