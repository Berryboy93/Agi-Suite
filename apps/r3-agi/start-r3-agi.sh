#!/bin/bash
# ============================================================
# FIX: Start r3-agi with correct script
# ============================================================
set -euo pipefail

cd ~/Agi-Suite/apps/r3-agi

echo "🔧 STARTING R3-AGI"
echo "=================="

# Check available scripts
echo ""
echo "Available scripts:"
grep -E '"(dev|start|build|preview|serve)"' package.json

# Try to start with available scripts
echo ""
echo "Trying to start..."

# Try dev first (most common for Vite)
if grep -q '"dev"' package.json; then
    echo "   Starting with 'pnpm dev'..."
    pnpm dev &
    echo "   ✅ r3-agi dev started"
# Try start
elif grep -q '"start"' package.json; then
    echo "   Starting with 'pnpm start'..."
    pnpm start &
    echo "   ✅ r3-agi start started"
# Try serve
elif grep -q '"serve"' package.json; then
    echo "   Starting with 'pnpm serve'..."
    pnpm serve &
    echo "   ✅ r3-agi serve started"
else
    echo "   ⚠️  No dev/start/serve script found"
    echo "   Using vite directly..."
    npx vite --host &
    echo "   ✅ r3-agi started with vite"
fi

echo ""
echo "=================="
echo "✅ R3-AGI STARTED"
