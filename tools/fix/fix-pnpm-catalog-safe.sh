#!/usr/bin/env bash
set -euo pipefail

FILE="pnpm-workspace.yaml"

echo "🧠 SAFE PNPM CATALOG REPAIR"

if [ ! -f "$FILE" ]; then
  echo "❌ Missing pnpm-workspace.yaml"
  exit 1
fi

cp "$FILE" "$FILE.bak.safe.$(date +%s)"

echo "📦 Rewriting clean workspace file..."

cat > "$FILE" << 'YAML'
packages:
  - "apps/*"
  - "lib/*"
  - "lib/integrations/*"
  - "scripts"
  - "artifacts/*"

catalog:
  @tanstack/react-query: ^5.90.21
  zod: ^3.25.76
  drizzle-orm: ^0.45.2
  tsx: ^4.21.0
YAML

echo "✔ YAML structure fixed"

rm -rf node_modules pnpm-lock.yaml

pnpm store prune || true

echo "📦 reinstalling..."
pnpm install

echo "✅ DONE"
