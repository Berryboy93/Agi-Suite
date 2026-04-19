#!/usr/bin/env bash
set -euo pipefail

FILE="pnpm-workspace.yaml"

echo "🧠 SAFE catalog patch (non-destructive)"

cp "$FILE" "$FILE.bak.$(date +%s)"

# ensure catalog exists (append if missing)
if ! grep -q "^catalog:" "$FILE"; then
  cat >> "$FILE" << 'YAML'

catalog:
  @tanstack/react-query: 5.90.21
  zod: 3.25.76
  drizzle-orm: 0.45.2
  tsx: 4.21.0
  react: 19.1.0
  react-dom: 19.1.0
YAML
fi

echo "✔ done"

pnpm install --frozen-lockfile