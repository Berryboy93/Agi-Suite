#!/usr/bin/env python3
"""
fix_catalog_collision.py — fix two blocking issues after restore:
  1. Add missing catalog entries (@tailwindcss/vite, framer-motion,
     lucide-react, tailwind-merge) to pnpm-workspace.yaml
  2. Replace apps/r3-agi/package.json with the complete dep list
     from artifacts/r3-agi (which has the correct, complete deps)
  3. Rename artifacts/r3-agi to @workspace/r3-agi-legacy and strip
     its typecheck script to eliminate the duplicate-name collision

Usage:
  python3 fix_catalog_collision.py          # dry run
  python3 fix_catalog_collision.py --apply  # write
"""
import argparse, json, re, shutil, sys
from datetime import datetime
from pathlib import Path

ROOT          = Path.home() / "Agi-Suite"
WORKSPACE     = ROOT / "pnpm-workspace.yaml"
APPS_PKG      = ROOT / "apps/r3-agi/package.json"
ARTIFACTS_PKG = ROOT / "artifacts/r3-agi/package.json"
BACKUP        = ROOT / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")

G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; R = "\033[91m"; X = "\033[0m"; D = "\033[2m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def warn(m): print(f"  {Y}⚠{X}  {m}")
def dry(m):  print(f"  {D}~  {m}{X}")
def info(m): print(f"  {B}→{X}  {m}")

# ── New catalog entries to add ─────────────────────────────────────────────────
# These are used as "catalog:" in artifacts/r3-agi/package.json but missing
# from the catalog section. Confirmed by reading both files.
NEW_CATALOG_ENTRIES = {
    "@tailwindcss/vite": "^4.1.14",
    "framer-motion":     "^12.23.24",
    "lucide-react":      "^0.545.0",
    "tailwind-merge":    "^2.6.0",
}

# ── Correct apps/r3-agi/package.json ─────────────────────────────────────────
# Sourced directly from artifacts/r3-agi/package.json (the complete version)
# with name corrected to @workspace/r3-agi and scripts aligned to apps/ paths.
CORRECT_APPS_PKG = {
    "name": "@workspace/r3-agi",
    "version": "0.0.0",
    "private": True,
    "type": "module",
    "scripts": {
        "dev": "vite --host",
        "build": "vite build",
        "typecheck": "tsc --noEmit",
    },
    "devDependencies": {
        "@hookform/resolvers":          "^3.10.0",
        "@radix-ui/react-accordion":    "^1.2.4",
        "@radix-ui/react-alert-dialog": "^1.1.7",
        "@radix-ui/react-aspect-ratio": "^1.1.3",
        "@radix-ui/react-avatar":       "^1.1.4",
        "@radix-ui/react-checkbox":     "^1.1.5",
        "@radix-ui/react-collapsible":  "^1.1.4",
        "@radix-ui/react-context-menu": "^2.2.7",
        "@radix-ui/react-dialog":       "^1.1.7",
        "@radix-ui/react-dropdown-menu":"^2.1.7",
        "@radix-ui/react-hover-card":   "^1.1.7",
        "@radix-ui/react-label":        "^2.1.3",
        "@radix-ui/react-menubar":      "^1.1.7",
        "@radix-ui/react-navigation-menu": "^1.2.6",
        "@radix-ui/react-popover":      "^1.1.7",
        "@radix-ui/react-progress":     "^1.1.3",
        "@radix-ui/react-radio-group":  "^1.2.4",
        "@radix-ui/react-scroll-area":  "^1.2.4",
        "@radix-ui/react-select":       "^2.1.7",
        "@radix-ui/react-separator":    "^1.1.3",
        "@radix-ui/react-slider":       "^1.2.4",
        "@radix-ui/react-slot":         "^1.2.0",
        "@radix-ui/react-switch":       "^1.1.4",
        "@radix-ui/react-tabs":         "^1.1.4",
        "@radix-ui/react-toast":        "^1.2.7",
        "@radix-ui/react-toggle":       "^1.1.3",
        "@radix-ui/react-toggle-group": "^1.1.3",
        "@radix-ui/react-tooltip":      "^1.2.0",
        "@tailwindcss/typography":      "^0.5.15",
        "@tailwindcss/vite":            "catalog:",
        "@tanstack/react-query":        "catalog:",
        "@types/node":                  "catalog:",
        "@types/react":                 "catalog:",
        "@types/react-dom":             "catalog:",
        "@vitejs/plugin-react":         "catalog:",
        "@workspace/api-client-react":  "workspace:*",
        "class-variance-authority":     "catalog:",
        "clsx":                         "catalog:",
        "cmdk":                         "^1.1.1",
        "date-fns":                     "^3.6.0",
        "embla-carousel-react":         "^8.6.0",
        "framer-motion":                "catalog:",
        "input-otp":                    "^1.4.2",
        "lucide-react":                 "catalog:",
        "next-themes":                  "^0.4.6",
        "react":                        "catalog:",
        "react-day-picker":             "^9.11.1",
        "react-dom":                    "catalog:",
        "react-hook-form":              "^7.55.0",
        "react-icons":                  "^5.4.0",
        "react-resizable-panels":       "^2.1.7",
        "recharts":                     "^2.15.2",
        "sonner":                       "^2.0.7",
        "tailwind-merge":               "catalog:",
        "tailwindcss":                  "catalog:",
        "tw-animate-css":               "^1.4.0",
        "vaul":                         "^1.1.2",
        "vite":                         "catalog:",
        "wouter":                       "^3.3.5",
        "zod":                          "catalog:",
    },
    "dependencies": {
        "zustand": "^5.0.12",
    },
}


def patch_workspace_yaml(apply: bool) -> None:
    """Add missing catalog entries to pnpm-workspace.yaml."""
    print(f"{B}Phase 1{X}  Add missing catalog entries to pnpm-workspace.yaml")
    assert WORKSPACE.exists(), f"Not found: {WORKSPACE}"
    content = WORKSPACE.read_text()

    # Verify catalog section exists
    assert "^catalog:" in content or "catalog:" in content, "No catalog section found"

    already = {k for k in NEW_CATALOG_ENTRIES if f'"{k}"' in content or f'\n  {k}:' in content}
    to_add  = {k: v for k, v in NEW_CATALOG_ENTRIES.items() if k not in already}

    if not to_add:
        ok("All catalog entries already present — skipping")
        return

    for pkg, ver in to_add.items():
        info(f"Adding to catalog: {pkg}: {ver}")

    # Insert new entries alphabetically just before 'zod:' (last catalog entry)
    # Anchor: "  zod:" appears exactly once in the catalog section
    anchor = "  zod:"
    count  = content.count(anchor)
    assert count == 1, f"Expected 1 occurrence of '{anchor}', found {count}"

    insertion = "".join(
        f'  "{k}": {v}\n' if k.startswith("@") else f"  {k}: {v}\n"
        for k, v in sorted(to_add.items())
    )
    new_content = content.replace(anchor, insertion + anchor)

    if apply:
        BACKUP.mkdir(parents=True, exist_ok=True)
        shutil.copy2(WORKSPACE, BACKUP / "pnpm-workspace.yaml")
        WORKSPACE.write_text(new_content)
        ok("Written: pnpm-workspace.yaml")
    else:
        dry("Would write: pnpm-workspace.yaml")


def patch_apps_pkg(apply: bool) -> None:
    """Replace apps/r3-agi/package.json with the complete dep list."""
    print(f"{B}Phase 2{X}  Replace apps/r3-agi/package.json with complete dep list")
    assert APPS_PKG.exists(), f"Not found: {APPS_PKG}"

    current = json.loads(APPS_PKG.read_text())
    current_count = len({
        **current.get("dependencies", {}),
        **current.get("devDependencies", {}),
    })
    new_count = len({
        **CORRECT_APPS_PKG.get("dependencies", {}),
        **CORRECT_APPS_PKG.get("devDependencies", {}),
    })
    info(f"Current deps: {current_count}  →  Correct deps: {new_count}")

    if apply:
        shutil.copy2(APPS_PKG, BACKUP / "apps_r3-agi_package.json")
        APPS_PKG.write_text(json.dumps(CORRECT_APPS_PKG, indent=2) + "\n")
        ok("Written: apps/r3-agi/package.json")
    else:
        dry("Would write: apps/r3-agi/package.json")


def patch_artifacts_pkg(apply: bool) -> None:
    """Rename artifacts/r3-agi to @workspace/r3-agi-legacy and remove typecheck."""
    print(f"{B}Phase 3{X}  Defuse artifacts/r3-agi name collision")
    assert ARTIFACTS_PKG.exists(), f"Not found: {ARTIFACTS_PKG}"

    pkg = json.loads(ARTIFACTS_PKG.read_text())

    if pkg.get("name") == "@workspace/r3-agi-legacy":
        ok("artifacts/r3-agi already renamed to r3-agi-legacy — skipping")
        return

    assert pkg.get("name") == "@workspace/r3-agi", \
        f"Unexpected package name: {pkg.get('name')}"

    pkg["name"] = "@workspace/r3-agi-legacy"
    # Remove typecheck script so it doesn't run on pnpm typecheck --filter
    if "typecheck" in pkg.get("scripts", {}):
        del pkg["scripts"]["typecheck"]
        info("Removed typecheck script from artifacts/r3-agi")
    info("Renamed to @workspace/r3-agi-legacy")

    if apply:
        shutil.copy2(ARTIFACTS_PKG, BACKUP / "artifacts_r3-agi_package.json")
        ARTIFACTS_PKG.write_text(json.dumps(pkg, indent=2) + "\n")
        ok("Written: artifacts/r3-agi/package.json (name: @workspace/r3-agi-legacy)")
    else:
        dry("Would write: artifacts/r3-agi/package.json")


def run(apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    print(f"\n{B}fix_catalog_collision.py{X}  [{mode}]\n")

    for path, label in [
        (WORKSPACE,     "pnpm-workspace.yaml"),
        (APPS_PKG,      "apps/r3-agi/package.json"),
        (ARTIFACTS_PKG, "artifacts/r3-agi/package.json"),
    ]:
        if not path.exists():
            print(f"  {R}✘{X}  Required file not found: {path.relative_to(ROOT)}")
            sys.exit(1)

    patch_workspace_yaml(apply); print()
    patch_apps_pkg(apply);       print()
    patch_artifacts_pkg(apply);  print()

    if apply:
        print(f"{G}All phases applied.{X}  Backups at: .patch-backups/{BACKUP.name}")
        print()
        print("Next steps:")
        print("  1.  pnpm install")
        print("  2.  pnpm typecheck")
        print("  3.  pnpm dev")
    else:
        print(f"{Y}Dry run — rerun with --apply to write.{X}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    run(p.parse_args().apply)
