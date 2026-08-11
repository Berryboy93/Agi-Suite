#!/usr/bin/env python3
# fix-tailwind-css.py — Auto-fix Tailwind CSS v4 syntax errors in index.css
# Usage: python3 fix-tailwind-css.py [path/to/index.css]

import sys
import shutil
from pathlib import Path
import time

css_file = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/home/r3v/Agi-Suite/apps/r3-agi/src/index.css")

if not css_file.exists():
    print(f"❌ File not found: {css_file}")
    print(f"Usage: {sys.argv[0]} [path/to/index.css]")
    sys.exit(1)

backup = css_file.parent / f"{css_file.name}.bak.{int(time.time())}"
shutil.copy2(css_file, backup)
print(f"📄 Target: {css_file}")
print(f"💾 Backup: {backup}")

content = css_file.read_text()

# ── Detect issues ──────────────────────────────────────────────────────────
has_v3 = any(line.strip().startswith("@tailwind") for line in content.splitlines())
has_v4_import = any(
    "tailwindcss" in line and line.strip().startswith("@import")
    for line in content.splitlines()
)

print("
🔍 Scanning for known issues...")

if has_v3:
    print("   ⚠️  Found old Tailwind v3 @tailwind directives")
if not has_v4_import:
    print("   ⚠️  Missing @import \"tailwindcss\" (v4 entry point)")

needs_rebuild = has_v3 or not has_v4_import

if not needs_rebuild:
    print("✅ No obvious known issues detected.")
    print("   Showing first 25 lines for manual inspection:
")
    print("─" * 44)
    for i, line in enumerate(content.splitlines()[:25], 1):
        print(f"{i:3}: {line}")
    print("─" * 44)
    ans = input("
Replace with a clean Tailwind v4 template? [y/N] ")
    if ans.lower().strip() != "y":
        print("👍 No changes made.")
        sys.exit(0)
    needs_rebuild = True

# ── Rebuild ──────────────────────────────────────────────────────────────────
print("
🔧 Applying fixes...")

# Strip old tailwind boilerplate, keep everything else
custom_lines = []
for line in content.splitlines():
    stripped = line.strip()
    if stripped.startswith("@tailwind"):
        continue
    if stripped.startswith("@import") and "tailwindcss" in stripped:
        continue
    custom_lines.append(line)

custom_css = "
".join(custom_lines).strip()

new_content = '''@import "tailwindcss";

@theme {
  /* Add custom theme tokens here, e.g.:
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
'''

if custom_css:
    new_content += "
/* ── Preserved custom CSS ── */
" + custom_css + "
"

css_file.write_text(new_content)

print("✅ Replaced with v4 template + preserved existing custom rules")
print("
📋 Result preview (first 30 lines):")
print("─" * 44)
for i, line in enumerate(new_content.splitlines()[:30], 1):
    print(f"{i:3}: {line}")
print("─" * 44)

print("
🚀 Done. Restart your dev server:")
print("   pnpm run dev")
print(f"
💡 If it still breaks, restore the backup:")
print(f"   cp \"{backup}\" \"{css_file}\"")
