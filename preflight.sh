#!/usr/bin/env bash
set -e

ROOT="apps/r3-agi/src"
OUT="ui-preflight-report.txt"

echo "=== VERIFIED UI PREFLIGHT (R3-AGI) ===" > "$OUT"
echo "Generated: $(date -Iseconds)" >> "$OUT"
echo "" >> "$OUT"

TARGETS=(
  "$ROOT/App.tsx"
  "$ROOT/index.css"
  "$ROOT/components/Sidebar.tsx"
  "$ROOT/components/Header.tsx"
  "$ROOT/components/RightPanel.tsx"
  "$ROOT/lib/utils.ts"
)

for f in "${TARGETS[@]}"; do
  echo "------------------------" >> "$OUT"
  echo "$f" >> "$OUT"
  if [ -f "$f" ]; then
    echo "SIZE: $(wc -c < "$f") bytes" >> "$OUT"
    echo "" >> "$OUT"
    sed -n '1,160p' "$f" >> "$OUT"
  else
    echo "MISSING FILE (SAFE TO SKIP)" >> "$OUT"
  fi
done

echo "" >> "$OUT"
echo "TREE:" >> "$OUT"
tree "$ROOT" -L 4 >> "$OUT" 2>/dev/null || find "$ROOT" -maxdepth 4 | head -60 >> "$OUT"

echo "DONE"
