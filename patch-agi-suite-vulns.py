#!/usr/bin/env python3
"""
Patch Agi-Suite package.json with pnpm.overrides to remediate npm vulnerabilities.
Supports dry-run mode (default) and --apply to commit changes.

Usage:
    python3 patch-agi-suite-vulns.py /path/to/Agi-Suite/package.json
    python3 patch-agi-suite-vulns.py /path/to/Agi-Suite/package.json --apply
"""

import json
import sys
import os
from pathlib import Path
from copy import deepcopy

VULNERABLE_OVERRIDES = {
    "shell-quote": "^1.8.1",
    "linkify-it": "^5.0.0",
    "brace-expansion": "^2.0.1",
    "postcss": "^8.4.31",
    "js-yaml": "^4.1.0",
    "fast-uri": "^3.0.0",
    "body-parser": "^1.20.2",
}

def read_package_json(path):
    """Read and return package.json as dict."""
    with open(path, 'r') as f:
        return json.load(f)

def apply_overrides(pkg_dict):
    """Apply pnpm.overrides to package.json dict."""
    if "pnpm" not in pkg_dict:
        pkg_dict["pnpm"] = {}
    
    if "overrides" not in pkg_dict["pnpm"]:
        pkg_dict["pnpm"]["overrides"] = {}
    
    # Merge new overrides
    pkg_dict["pnpm"]["overrides"].update(VULNERABLE_OVERRIDES)
    
    return pkg_dict

def write_package_json(path, pkg_dict):
    """Write package.json with 2-space indent and trailing newline."""
    with open(path, 'w') as f:
        json.dump(pkg_dict, f, indent=2)
        f.write('\n')

def show_diff(original, patched):
    """Display what changed in pnpm.overrides."""
    print("\n" + "="*70)
    print("PATCH SUMMARY: pnpm.overrides changes")
    print("="*70)
    
    orig_overrides = original.get("pnpm", {}).get("overrides", {})
    new_overrides = patched.get("pnpm", {}).get("overrides", {})
    
    added = {}
    updated = {}
    
    for pkg, version in VULNERABLE_OVERRIDES.items():
        if pkg not in orig_overrides:
            added[pkg] = version
        elif orig_overrides[pkg] != version:
            updated[pkg] = (orig_overrides[pkg], version)
    
    if added:
        print("\n✓ ADDED OVERRIDES:")
        for pkg, version in sorted(added.items()):
            print(f"  {pkg}: {version}")
    
    if updated:
        print("\n→ UPDATED OVERRIDES:")
        for pkg, (old, new) in sorted(updated.items()):
            print(f"  {pkg}: {old} → {new}")
    
    if not added and not updated:
        print("\n✓ All overrides already present (no changes needed)")
    
    print("\n" + "="*70)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 patch-agi-suite-vulns.py /path/to/package.json [--apply]")
        sys.exit(1)
    
    pkg_path = Path(sys.argv[1])
    apply_mode = "--apply" in sys.argv
    
    # Validate path
    if not pkg_path.exists():
        print(f"ERROR: {pkg_path} not found", file=sys.stderr)
        sys.exit(1)
    
    # Read original
    try:
        original = read_package_json(pkg_path)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {pkg_path}: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Create patched version
    patched = deepcopy(original)
    patched = apply_overrides(patched)
    
    # Show diff
    show_diff(original, patched)
    
    # Apply or dry-run
    if apply_mode:
        try:
            write_package_json(pkg_path, patched)
            print(f"\n✓ Applied. Updated {pkg_path}")
            print("\nNext steps:")
            print("  1. pnpm install")
            print("  2. pnpm run build && pnpm run test")
            print("  3. git add package.json pnpm-lock.yaml")
            print("  4. git commit -m 'chore: remediate Dependabot vulnerabilities via pnpm.overrides'")
        except Exception as e:
            print(f"ERROR: Failed to write {pkg_path}: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"\nDRY-RUN MODE (no changes applied)")
        print(f"To apply: python3 patch-agi-suite-vulns.py {pkg_path} --apply")

if __name__ == "__main__":
    main()
