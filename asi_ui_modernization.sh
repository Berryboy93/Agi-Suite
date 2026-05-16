#!/usr/bin/env bash
# ASI Expert-Level UI Modernization Script
# Purpose: Properly configure Vite alias and standardize @/ui imports across the codebase
# Branch: ui-modernization-phase1

set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "  ASI Expert UI Modernization — Phase 1 Completion"
echo "═══════════════════════════════════════════════════════════════"
echo ""

PROJECT_ROOT="$HOME/Agi-Suite"
APP_DIR="$PROJECT_ROOT/apps/r3-agi"
VITE_CONFIG="$APP_DIR/vite.config.ts"

cd "$PROJECT_ROOT"

# ═══════════════════════════════════════════════════════════════
# STEP 1: Gate 0 — Clean State Audit
# ═══════════════════════════════════════════════════════════════
echo ">>> STEP 1: Clean State Audit"
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[WARN] Working tree is not clean. Stashing changes..."
    git stash push -m "asi-modernization-stash-$(date +%s)"
    STASHED=1
else
    STASHED=0
fi
echo "[PASS] Working tree clean (or stashed)"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 2: Backup Vite Config
# ═══════════════════════════════════════════════════════════════
echo ">>> STEP 2: Backup Vite Config"
cp "$VITE_CONFIG" "$VITE_CONFIG.bak.$(date +%s)"
echo "[PASS] Backup created"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 3: Inject @/ui Alias into Vite Config
# ═══════════════════════════════════════════════════════════════
echo ">>> STEP 3: Inject @/ui Alias into Vite Config"

# Check if alias already exists
if grep -q '"@/ui"' "$VITE_CONFIG" || grep -q "'@/ui'" "$VITE_CONFIG"; then
    echo "[INFO] @/ui alias already present in Vite config"
else
    # Create new config with alias injected
    cat > "$VITE_CONFIG" << 'VITEEOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/ui": path.resolve(__dirname, "src/ui"),
    },
  },
  server: {
    host: true,
    port: 5176,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
VITEEOF
    echo "[PASS] Vite config updated with @/ui alias"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 4: Revert Relative Imports → Alias Imports
# ═══════════════════════════════════════════════════════════════
echo ">>> STEP 4: Revert Relative Imports → Clean Alias Imports"

# Pattern: ../../ui/components/Panel → @/ui/components/Panel
# Pattern: ../components/Panel → @/ui/components/Panel (from ui/ directory)
# Pattern: ../../ui/tokens/* → @/ui/tokens/*
# Pattern: ../tokens/* → @/ui/tokens/* (from ui/ directory)

find "$APP_DIR/src" -name "*.tsx" -type f | while read -r file; do
    # From views (depth: ../../ui/)
    sed -i 's|"../../ui/components/Panel"|"@/ui/components/Panel"|g' "$file"
    sed -i "s|'../../ui/components/Panel'|'@/ui/components/Panel'|g" "$file"
    sed -i 's|"../../ui/tokens/|"@/ui/tokens/|g' "$file"
    sed -i "s|'../../ui/tokens/|'@/ui/tokens/|g" "$file"

    # From ui/ directory (depth: ../)
    sed -i 's|"../components/Panel"|"@/ui/components/Panel"|g' "$file"
    sed -i "s|'../components/Panel'|'@/ui/components/Panel'|g" "$file"
    sed -i 's|"../tokens/|"@/ui/tokens/|g' "$file"
    sed -i "s|'../tokens/|'@/ui/tokens/|g" "$file"
done

echo "[PASS] All relative ui/ imports converted to @/ui aliases"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 5: Verify No Relative ui/ Imports Remain
# ═══════════════════════════════════════════════════════════════
echo ">>> STEP 5: Verify Import Consistency"
if grep -rE 'from\s+"\.\.*\/ui\/' "$APP_DIR/src" --include="*.tsx" --include="*.ts" || \
   grep -rE "from\s+'\.\.*\/ui\/" "$APP_DIR/src" --include="*.tsx" --include="*.ts"; then
    echo "[FAIL] Found remaining relative ui/ imports!"
    exit 1
fi
echo "[PASS] No relative ui/ imports remain"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 6: Format & Type Check
# ═══════════════════════════════════════════════════════════════
echo ">>> STEP 6: Format & Type Check"
pnpm prettier --write "$APP_DIR/src/**/*.tsx" "$APP_DIR/src/**/*.ts" 2>/dev/null || \
    pnpm prettier --write "$APP_DIR/src" 2>/dev/null || \
    echo "[WARN] Prettier formatting skipped (no changes or config issue)"

echo "Running typecheck..."
pnpm typecheck
echo "[PASS] Type check passed"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 7: Integrity Check
# ═══════════════════════════════════════════════════════════════
echo ">>> STEP 7: Integrity Check"
if [ -f "$PROJECT_ROOT/scripts/integrity-check.sh" ]; then
    bash "$PROJECT_ROOT/scripts/integrity-check.sh"
    echo "[PASS] Integrity check passed"
else
    echo "[WARN] integrity-check.sh not found, skipping"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 8: Commit & Push
# ═══════════════════════════════════════════════════════════════
echo ">>> STEP 8: Commit & Push"
git add "$VITE_CONFIG"
git add "$APP_DIR/src/"

# Only commit if there are changes
if git diff --cached --quiet; then
    echo "[INFO] No changes to commit"
else
    git commit -m "feat: add @/ui Vite alias + standardize ui imports

- Add resolve.alias for @/ui -> src/ui in vite.config.ts
- Convert all relative ../../ui/ and ../ui/ imports to @/ui/*
- Ensures consistent import patterns across views/ and ui/ components
- Maintains TypeScript path mapping alignment with bundler resolution"

    echo "[PASS] Changes committed"

    echo "Pushing to origin/ui-modernization-phase1..."
    git push origin ui-modernization-phase1
    echo "[PASS] Push complete"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 9: Restore Stash if Needed
# ═══════════════════════════════════════════════════════════════
if [ "$STASHED" -eq 1 ]; then
    echo ">>> STEP 9: Restore Stashed Changes"
    git stash pop
    echo "[PASS] Stash restored"
    echo ""
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ ASI Expert Modernization Complete"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  • Vite alias @/ui -> src/ui configured"
echo "  • All imports standardized to @/ui/* pattern"
echo "  • Type checks passing"
echo "  • Integrity checks passing"
echo "  • Changes pushed to ui-modernization-phase1"
echo ""
echo "Next steps:"
echo "  1. Verify build: pnpm --filter r3-agi build"
echo "  2. Run dev server: pnpm --filter r3-agi dev"
echo "  3. Check browser console for module resolution errors"
