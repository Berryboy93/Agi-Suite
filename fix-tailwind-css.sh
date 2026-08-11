#!/usr/bin/env bash
# fix-tailwind-css.sh — Auto-fix Tailwind CSS v4 syntax errors in index.css
# Usage: ./fix-tailwind-css.sh [path/to/index.css]

set -euo pipefail

CSS_FILE="${1:-/home/r3v/Agi-Suite/apps/r3-agi/src/index.css}"
BACKUP="${CSS_FILE}.bak.$(date +%s)"

if [[ ! -f "$CSS_FILE" ]]; then
    echo "❌ File not found: $CSS_FILE"
    echo "Usage: $0 [path/to/index.css]"
    exit 1
fi

echo "📄 Target: $CSS_FILE"
echo "💾 Backup: $BACKUP"
cp "$CSS_FILE" "$BACKUP"

echo ""
echo "🔍 Scanning for known issues..."

# ── Fix 1: Old Tailwind v3 directives ──────────────────────────────────────
HAS_V3=false
if grep -qE '^[[:space:]]*@tailwind[[:space:]]+(base|components|utilities);' "$CSS_FILE"; then
    echo "   ⚠️  Found old Tailwind v3 @tailwind directives"
    HAS_V3=true
fi

# ── Fix 2: Missing @import "tailwindcss" ─────────────────────────────────
HAS_IMPORT=false
if grep -qE '^[[:space:]]*@import[[:space:]]+["'\''']tailwindcss["'\''']' "$CSS_FILE"; then
    HAS_IMPORT=true
fi

if [[ "$HAS_IMPORT" == false ]]; then
    echo "   ⚠️  Missing @import \"tailwindcss\" (v4 entry point)"
fi

# ── Fix 3: Missing opening braces after @-rules ───────────────────────────
MISSING_BRACE=false
while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*@[a-zA-Z]+ ]]; then
        # This line starts with an @-rule
        # Check if the line itself ends with {
        if [[ ! "$line" =~ \{[[:space:]]*$ ]]; then
            # Read next non-empty line
            NEXT_LINE=""
            while IFS= read -r next || [[ -n "$next" ]]; do
                [[ "$next" =~ ^[[:space:]]*$ ]] && continue
                NEXT_LINE="$next"
                break
            done
            if [[ ! "$NEXT_LINE" =~ ^[[:space:]]*\{ ]]; then
                echo "   ⚠️  Found @-rule missing opening brace: $line"
                MISSING_BRACE=true
                break
            fi
        fi
    fi
done < "$CSS_FILE"

NEEDS_REBUILD=false
if [[ "$HAS_V3" == true ]] || [[ "$HAS_IMPORT" == false ]]; then
    NEEDS_REBUILD=true
fi

if [[ "$NEEDS_REBUILD" == false ]] && [[ "$MISSING_BRACE" == false ]]; then
    echo "✅ No obvious known issues detected."
    echo "   The error might be subtle. Showing file for manual inspection:"
    echo ""
    cat -n "$CSS_FILE"
    echo ""
    read -rp "Replace with a clean Tailwind v4 template? [y/N] " ans
    if [[ "$ans" =~ ^[Yy]$ ]]; then
        NEEDS_REBUILD=true
    else
        echo "👍 No changes made."
        exit 0
    fi
fi

echo ""
echo "🔧 Applying fixes..."

TMP=$(mktemp)

if [[ "$NEEDS_REBUILD" == true ]]; then
    echo "   → Replacing with Tailwind v4 baseline template"

    cat > "$TMP" << 'EOF'
@import "tailwindcss";

@theme {
  /* Add your custom theme tokens here, e.g.:
  --color-brand: #3b82f6;
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  */
}

@layer base {
  /* Base styles go here */
}

@layer components {
  /* Component styles go here */
}

@layer utilities {
  /* Utility styles go here */
}
EOF

    # Append any custom non-Tailwind CSS the user had
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^[[:space:]]*@tailwind[[:space:]]+(base|components|utilities) ]]; then
            continue
        fi
        if [[ "$line" =~ ^[[:space:]]*@import[[:space:]]+["'\''']tailwindcss["'\'''] ]]; then
            continue
        fi
        echo "$line"
    done < "$CSS_FILE" >> "$TMP"

    mv "$TMP" "$CSS_FILE"
    echo "✅ Replaced with v4 template + preserved existing custom rules"

elif [[ "$MISSING_BRACE" == true ]]; then
    echo "   → Attempting to fix missing braces..."

    while IFS= read -r line || [[ -n "$line" ]]; do
        echo "$line"
        if [[ "$line" =~ ^[[:space:]]*@[a-zA-Z]+ ]] && [[ ! "$line" =~ \{[[:space:]]*$ ]]; then
            # Peek at next non-empty line
            NEXT_LINE=""
            while IFS= read -r next || [[ -n "$next" ]]; do
                [[ "$next" =~ ^[[:space:]]*$ ]] && continue
                NEXT_LINE="$next"
                break
            done < <(tail -n +$(($(grep -n "$line" "$CSS_FILE" | head -1 | cut -d: -f1) + 1)) "$CSS_FILE")

            if [[ ! "$NEXT_LINE" =~ ^[[:space:]]*\{ ]]; then
                echo " {"
            fi
        fi
    done < "$CSS_FILE" > "$TMP"

    mv "$TMP" "$CSS_FILE"
    echo "✅ Missing-brace fix applied"
fi

echo ""
echo "📋 Result preview (first 30 lines):"
echo "────────────────────────────────────"
head -n 30 "$CSS_FILE"
echo "────────────────────────────────────"
echo ""
echo "🚀 Done. Restart your dev server:"
echo "   pnpm run dev"
echo ""
echo "💡 If it still breaks, restore the backup:"
echo "   cp \"$BACKUP\" \"$CSS_FILE\""
