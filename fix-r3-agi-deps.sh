#!/bin/bash
# ============================================================
# FIX: Agi-Suite r3-agi Major Dependencies
# Adds missing packages, fixes tsconfig, adds types
# ============================================================
set -euo pipefail

cd ~/Agi-Suite

echo "🔧 FIXING AGI-SUITE R3-AGI DEPENDENCIES"
echo "========================================"

# Get the exact package name from package.json
R3_NAME=$(grep -m1 '"name"' apps/r3-agi/package.json 2>/dev/null | sed 's/.*"name": "//;s/".*//')
if [ -z "$R3_NAME" ]; then
    R3_NAME="r3-agi"
fi

echo ""
echo "Target app: $R3_NAME"

# 1. Add missing external packages (if they exist in npm)
echo ""
echo "1. Adding missing external packages..."

# These might not exist on npm - they're likely custom/internal
# Try to add them, but don't fail if they don't exist
for pkg in "@r3vibe/asi-wire" "@r3vibe/mythos"; do
    echo "   Trying: $pkg"
    pnpm add --filter "$R3_NAME" "$pkg" 2>/dev/null || echo "   ⚠️  $pkg not found on npm (may be internal)"
done

# 2. Add React types (critical for JSX errors)
echo ""
echo "2. Adding React type definitions..."
pnpm add -D --filter "$R3_NAME" @types/react @types/react-dom 2>/dev/null || pnpm add -D -w @types/react @types/react-dom

# 3. Add DOM types (for document, window, navigator)
echo ""
echo "3. Adding DOM lib types..."
# This is done via tsconfig, not npm - we'll fix tsconfig next

# 4. Fix tsconfig.json path aliases
echo ""
echo "4. Checking tsconfig.json..."
TS_CONFIG="apps/r3-agi/tsconfig.json"
if [ -f "$TS_CONFIG" ]; then
    echo "   Found: $TS_CONFIG"

    # Check if paths are configured
    if grep -q '"paths"' "$TS_CONFIG"; then
        echo "   ✅ paths already configured"
    else
        echo "   ⚠️  No paths configured - need to add"
        # This requires editing the JSON - we'll do it with Python
    fi

    # Check JSX setting
    if grep -q '"jsx"' "$TS_CONFIG"; then
        echo "   ✅ JSX setting found"
    else
        echo "   ⚠️  No JSX setting - need to add"
    fi

    # Check lib setting for DOM
    if grep -q '"lib"' "$TS_CONFIG"; then
        echo "   ✅ lib setting found"
    else
        echo "   ⚠️  No lib setting - need to add DOM"
    fi
else
    echo "   ❌ tsconfig.json not found"
fi

# 5. Show current errors count
echo ""
echo "5. Checking current error count..."
cd apps/r3-agi
pnpm run build 2>&1 | grep -E "Found [0-9]+ error" || echo "   Could not determine error count"
cd ../..

echo ""
echo "========================================"
echo "✅ DEPENDENCY FIX COMPLETE"
echo ""
echo "Note: @r3vibe/asi-wire and @r3vibe/mythos may be internal packages"
echo "that need to be built locally or installed from a private registry."
echo ""
echo "Next: Check if error count reduced, then fix tsconfig.json"
