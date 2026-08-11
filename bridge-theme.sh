#!/usr/bin/env bash
set -e

cd ~/Agi-Suite
FILE="apps/r3-agi/src/index.css"
BACKUP="$FILE.bak.$(date +%s)"
cp "$FILE" "$BACKUP"

START=$(grep -n '@theme {' "$FILE" | head -1 | cut -d: -f1)
END=$(awk '/@theme \{/{start=NR} start && /^}/{print NR; exit}' "$FILE")

echo "Found @theme block: lines $START-$END"
echo "Backup: $BACKUP"

cat > /tmp/theme-bridge.css << 'EOF'

  /* ── BRIDGE: Legacy CSS custom properties → Tailwind v4 ── */
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-sur2: var(--sur2);
  --color-border-default: var(--border);
  --color-border-subtle: var(--bor2);
  --color-accent: var(--accent);
  --color-acid: var(--acid);
  --color-red: var(--red);
  --color-violet: var(--violet);
  --color-dim: var(--dim);
  --color-text: var(--text);
  --color-text2: var(--text2);
  --color-warn: var(--warn);
  --color-good: var(--good);
  --color-bad: var(--bad);
  --color-done: var(--done);
EOF

sed -i "${END}r /tmp/theme-bridge.css" "$FILE"
echo "Bridge injected."
