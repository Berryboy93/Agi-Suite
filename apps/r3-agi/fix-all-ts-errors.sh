#!/usr/bin/env bash
set -euo pipefail

# Script: fix-all-ts-errors.sh
# Fixes all remaining TypeScript errors in the r3-agi project

PROJECT_DIR="${1:-$HOME/Agi-Suite/apps/r3-agi}"

echo "[+] Target project: $PROJECT_DIR"
cd "$PROJECT_DIR"

# ============================================================================
# FIX 1: AgentSuitePanel.tsx - msgCount possibly undefined
# ============================================================================
FILE1="src/components/AgentSuitePanel.tsx"
if [ -f "$FILE1" ]; then
    echo "[+] Patching $FILE1 ..."
    # msgCount > 0  ->  (msgCount ?? 0) > 0
    sed -i 's/{msgCount > 0 && (/{(msgCount ?? 0) > 0 \&\& (/g' "$FILE1"
    echo "[+] $FILE1 patched."
else
    echo "[!] $FILE1 not found, skipping."
fi

# ============================================================================
# FIX 2: ASIView.tsx - seq[i]() possibly undefined
# ============================================================================
FILE2="src/components/views/ASIView.tsx"
if [ -f "$FILE2" ]; then
    echo "[+] Patching $FILE2 ..."
    # seq[i]();  ->  seq[i]?.();
    sed -i 's/seq\[i\]();/seq[i]?.();/g' "$FILE2"
    echo "[+] $FILE2 patched."
else
    echo "[!] $FILE2 not found, skipping."
fi

# ============================================================================
# FIX 3: useAGI.ts - unreachable right operand of ??
# ============================================================================
FILE3="src/store/useAGI.ts"
if [ -f "$FILE3" ]; then
    echo "[+] Patching $FILE3 ..."
    # !p?.done ?? false  ->  !(p?.done ?? false)
    sed -i 's/!p?\.done ?? false/!(p?.done ?? false)/g' "$FILE3"
    echo "[+] $FILE3 patched."
else
    echo "[!] $FILE3 not found, skipping."
fi

# ============================================================================
# VERIFY
# ============================================================================
echo ""
echo "[+] Running TypeScript check..."
if npx tsc --noEmit 2>&1; then
    echo "[+] ALL TypeScript checks passed. Zero errors."
else
    echo "[-] Some TypeScript errors remain (see above)."
    exit 1
fi

echo ""
echo "[+] Done. All files are type-safe."
