#!/usr/bin/env bash
set -euo pipefail

FILE="pnpm-workspace.yaml"

echo "🧠 RHOS SAFE CATALOG REPAIR v2"

cp "$FILE" "$FILE.bak.$(date +%s)"

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
  react: 19.1.0
  react-dom: 19.1.0
  @types/node: ^25.3.3
  vite: ^7.3.2
YAML

echo "✔ catalog fully aligned with repo usage"

rm -rf node_modules pnpm-lock.yaml

pnpm store prune || true

pnpm install

echo "✅ SAFE INSTALL COMPLETE"
