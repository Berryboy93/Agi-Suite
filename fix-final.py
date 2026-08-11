#!/usr/bin/env python3
"""
Direct fixes for Agi-Suite build errors:
1. llpte.test.ts: Remove extra space before closing comment
2. index.css: Delete extra } on line 48
3. tsconfig.json: Remove non-existent src/ from include

Run from ~/Agi-Suite:
    python3 fix-final.py --apply
"""

import sys
import json
from pathlib import Path

def fix_llpte_test(apply=False):
    """Fix llpte.test.ts - the issue is likely an extra space or malformed comment"""
    test_file = Path("apps/r3-agi/src/services/llpte.test.ts")
    
    if not test_file.exists():
        print(f"✗ {test_file} not found")
        return False
    
    with open(test_file, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Find the problematic area around line 14-16
    # The error shows line 14 has ` */` and line 16 has the import
    # Line 15 is blank
    
    # Strategy: find any unclosed `/*` blocks before the import
    import_line_idx = None
    for i, line in enumerate(lines):
        if 'import {' in line and 'vitest' in line:
            import_line_idx = i
            break
    
    if import_line_idx is None:
        print(f"✗ Could not find vitest import in {test_file}")
        return False
    
    # Check content before import
    pre_content = '\n'.join(lines[:import_line_idx])
    open_blocks = pre_content.count('/*') - pre_content.count('*/')
    
    if open_blocks <= 0:
        print(f"✓ {test_file}: comments already balanced")
        return True
    
    if not apply:
        print(f"⚠ {test_file}: Found {open_blocks} unclosed block comment(s)")
        print(f"  Will add closing */ before line {import_line_idx + 1}")
        return True
    
    # Insert closing comment before import
    # Find the line to insert after (probably line 13 or 14, 0-indexed)
    insert_idx = import_line_idx - 1
    while insert_idx >= 0 and not lines[insert_idx].strip():
        insert_idx -= 1
    
    # Add */ after that line if it doesn't already have it
    if '*/' not in lines[insert_idx]:
        lines[insert_idx] = lines[insert_idx] + ' */'
    
    new_content = '\n'.join(lines)
    with open(test_file, 'w') as f:
        f.write(new_content)
    
    print(f"✓ Fixed {test_file}")
    return True

def fix_index_css(apply=False):
    """Fix index.css - remove extra } on line 48"""
    css_file = Path("apps/r3-agi/src/index.css")
    
    if not css_file.exists():
        print(f"✗ {css_file} not found")
        return False
    
    with open(css_file, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    if len(lines) < 50:
        print(f"✗ {css_file} too short")
        return False
    
    # Line 48 (0-indexed = 47) should be removed if it's just }
    line_48 = lines[47].strip()
    line_47 = lines[46].strip() if len(lines) > 46 else ""
    line_49 = lines[48].strip() if len(lines) > 48 else ""
    
    if line_48 == '}' and line_47.endswith(';'):
        # This is an extra closing brace
        if not apply:
            print(f"⚠ {css_file}: Found extra }} on line 48")
            print(f"  Line 47: {line_47[:50]}")
            print(f"  Line 48: {line_48}")
            print(f"  Line 49: {line_49[:50] if line_49 else '(blank)'}")
            return True
        
        # Remove the extra brace
        lines[47] = ''
        new_content = '\n'.join(lines)
        with open(css_file, 'w') as f:
            f.write(new_content)
        print(f"✓ Fixed {css_file}")
        return True
    
    print(f"✓ {css_file}: line 48 looks OK")
    return True

def fix_tsconfig(apply=False):
    """Fix tsconfig.json - remove non-existent src/ from include"""
    tsconfig = Path("tsconfig.json")
    
    if not tsconfig.exists():
        print(f"✗ {tsconfig} not found")
        return False
    
    with open(tsconfig, 'r') as f:
        content = f.read()
    
    try:
        config = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"✗ {tsconfig} invalid JSON: {e}")
        return False
    
    if 'include' not in config or config['include'] != ['src']:
        print(f"✓ {tsconfig}: include paths look OK")
        return True
    
    if not apply:
        print(f"⚠ {tsconfig}: Found 'include': ['src'] which doesn't exist")
        print(f"  Will remove this from the config")
        return True
    
    # Remove the include directive
    del config['include']
    
    # Write back with proper formatting
    new_content = json.dumps(config, indent=2) + '\n'
    with open(tsconfig, 'w') as f:
        f.write(new_content)
    
    print(f"✓ Fixed {tsconfig}")
    return True

def main():
    apply = "--apply" in sys.argv
    
    print("\n" + "="*70)
    print("FIXING AGI-SUITE BUILD ERRORS")
    print("="*70 + "\n")
    
    if not apply:
        print("DRY-RUN MODE")
        print("To apply fixes, run: python3 fix-final.py --apply\n")
    
    all_ok = True
    
    print("1. Checking llpte.test.ts (unclosed comment)...")
    if not fix_llpte_test(apply):
        all_ok = False
    
    print("2. Checking index.css (extra closing brace)...")
    if not fix_index_css(apply):
        all_ok = False
    
    print("3. Checking tsconfig.json (non-existent src/ path)...")
    if not fix_tsconfig(apply):
        all_ok = False
    
    print("\n" + "="*70)
    if apply and all_ok:
        print("✓ ALL FIXES APPLIED\n")
        print("Next steps:")
        print("  1. pnpm run build")
        print("  2. pnpm run test")
        print("  3. git add -A")
        print("  4. git commit -m 'fix: resolve build errors in llpte.test.ts, index.css, tsconfig.json'")
        print("  5. git push --set-upstream origin integration/orchestrator")
    elif apply:
        print("✗ Some fixes may need manual review")
    else:
        print("✓ Dry-run complete")
        print(f"  To apply all fixes: python3 fix-final.py --apply")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
