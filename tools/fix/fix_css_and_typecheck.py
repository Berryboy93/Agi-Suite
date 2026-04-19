#!/usr/bin/env python3
"""
fix_css_and_typecheck.py — two remaining gaps after restore:
  1. Swap @import order in index.css so Google Fonts precedes Tailwind
     expansion (PostCSS requires all @imports before any CSS statements)
  2. Add ./apps/** to root package.json typecheck filter so apps/r3-agi
     is covered by pnpm typecheck and the pre-push hook

Usage:
  python3 fix_css_and_typecheck.py          # dry run
  python3 fix_css_and_typecheck.py --apply  # write
"""
import argparse, json, shutil, sys
from datetime import datetime
from pathlib import Path

ROOT       = Path.home() / "Agi-Suite"
CSS_PATH   = ROOT / "apps/r3-agi/src/index.css"
ROOT_PKG   = ROOT / "package.json"
BACKUP     = ROOT / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")

G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; X = "\033[0m"; D = "\033[2m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def dry(m):  print(f"  {D}~  {m}{X}")
def info(m): print(f"  {B}→{X}  {m}")


def fix_css(apply: bool) -> None:
    """Swap the two @import lines so Google Fonts comes first."""
    print(f"{B}Phase 1{X}  Fix @import order in apps/r3-agi/src/index.css")
    assert CSS_PATH.exists(), f"Not found: {CSS_PATH}"

    lines = CSS_PATH.read_text().split("\n")

    assert lines[0] == '@import "tailwindcss";', \
        f"Line 0 unexpected — file may have changed:\n  {lines[0]!r}"
    assert lines[1].startswith('@import url("https://fonts.googleapis.com'), \
        f"Line 1 unexpected — file may have changed:\n  {lines[1]!r}"

    info("Before: line 1 = @import \"tailwindcss\"")
    info("        line 2 = @import url(fonts.googleapis.com...)")
    info("After:  line 1 = @import url(fonts.googleapis.com...)  ← stays before expansion")
    info("        line 2 = @import \"tailwindcss\"                  ← expanded inline after")

    # Swap — Google Fonts must precede @tailwindcss/vite expansion
    lines[0], lines[1] = lines[1], lines[0]
    fixed = "\n".join(lines)

    # Post-swap assertions before writing
    result_lines = fixed.split("\n")
    assert result_lines[0].startswith('@import url("https://fonts.googleapis.com'), \
        "Post-swap: line 0 is not the Google Fonts import"
    assert result_lines[1] == '@import "tailwindcss";', \
        "Post-swap: line 1 is not the Tailwind import"

    if apply:
        BACKUP.mkdir(parents=True, exist_ok=True)
        shutil.copy2(CSS_PATH, BACKUP / "index.css")
        CSS_PATH.write_text(fixed)
        # Verify write
        written = CSS_PATH.read_text().split("\n")
        assert written[0].startswith('@import url("https://fonts.googleapis.com'), \
            "Write verification failed"
        ok("Written and verified: apps/r3-agi/src/index.css")
        ok(f"  Line 1: {written[0][:60]}...")
        ok(f"  Line 2: {written[1]}")
    else:
        dry("Would swap lines 1 and 2 in apps/r3-agi/src/index.css")


def fix_typecheck(apply: bool) -> None:
    """Add ./apps/** to root package.json typecheck filter."""
    print(f"{B}Phase 2{X}  Add ./apps/** to root typecheck script")
    assert ROOT_PKG.exists(), f"Not found: {ROOT_PKG}"

    pkg = json.loads(ROOT_PKG.read_text())
    current = pkg["scripts"]["typecheck"]

    if "./apps/**" in current:
        ok("./apps/** already in typecheck script — skipping")
        return

    # Confirm exact anchor before replace
    old_filter = '--filter "./artifacts/**" --filter "./scripts"'
    assert current.count(old_filter) == 1, \
        f"Expected 1 match of anchor, got {current.count(old_filter)}"

    new_filter = '--filter "./apps/**" --filter "./artifacts/**" --filter "./scripts"'
    pkg["scripts"]["typecheck"] = current.replace(old_filter, new_filter)

    info(f"Before: {current}")
    info(f"After:  {pkg['scripts']['typecheck']}")

    if apply:
        shutil.copy2(ROOT_PKG, BACKUP / "package.json")
        ROOT_PKG.write_text(json.dumps(pkg, indent=2) + "\n")
        # Verify
        written = json.loads(ROOT_PKG.read_text())
        assert "./apps/**" in written["scripts"]["typecheck"], "Write verification failed"
        ok("Written and verified: package.json")
    else:
        dry("Would update typecheck script in package.json")


def run(apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    print(f"\n{B}fix_css_and_typecheck.py{X}  [{mode}]\n")

    for path, label in [(CSS_PATH, "index.css"), (ROOT_PKG, "package.json")]:
        if not path.exists():
            print(f"  \033[91m✘\033[0m  Not found: {path.relative_to(ROOT)}")
            sys.exit(1)

    fix_css(apply);       print()
    fix_typecheck(apply); print()

    if apply:
        print(f"{G}Done.{X}  Backups at: .patch-backups/{BACKUP.name}")
        print()
        print("Verification steps:")
        print("  pnpm dev          → PostCSS error should be gone")
        print("  pnpm typecheck    → must cover apps/r3-agi now")
        print("  open localhost:5173 → styles must be visible")
    else:
        print(f"{Y}Dry run — rerun with --apply to write.{X}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    run(p.parse_args().apply)
