#!/usr/bin/env python3
"""
fix_r3_agi_deps.py — restore full dep manifest for apps/r3-agi
Adds all packages the restored src imports but package.json doesn't declare.
Usage:
  python3 fix_r3_agi_deps.py          # dry run
  python3 fix_r3_agi_deps.py --apply  # write files

Bugs fixed vs v1:
  - tailwind-merge moved from catalog: to explicit version (not in current catalog)
  - @tailwindcss/vite moved to devDependencies (build plugin, not runtime)
  - lucide-react bumped to ^0.545.0 (matches original workspace)
  - VITE_PATH existence guard added
  - App.tsx.bak-scaffold deleted from src/ (would cause TS compile error)
  - index.css Tailwind v3→v4 directive check + fix
"""
import argparse, json, re, shutil, sys
from datetime import datetime
from pathlib import Path

ROOT      = Path.home() / "Agi-Suite"
PKG_PATH  = ROOT / "apps/r3-agi/package.json"
VITE_PATH = ROOT / "apps/r3-agi/vite.config.ts"
SRC_DIR   = ROOT / "apps/r3-agi/src"
CSS_PATH  = SRC_DIR / "index.css"
BAK_FILE  = SRC_DIR / "App.tsx.bak-scaffold"
BACKUP    = ROOT / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")

G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; R = "\033[91m"; X = "\033[0m"; D = "\033[2m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def warn(m): print(f"  {Y}⚠{X}  {m}")
def err(m):  print(f"  {R}✘{X}  {m}")
def dry(m):  print(f"  {D}~  {m}{X}")
def info(m): print(f"  {B}→{X}  {m}")

# ── Catalog packages (confirmed present in current pnpm-workspace.yaml) ───────
# Verified against: @tanstack/react-query, @types/node, @types/react,
# @types/react-dom, @vitejs/plugin-react, class-variance-authority, clsx,
# drizzle-orm, react, react-dom, tailwindcss, tsx, vite, zod
CATALOG_DEPS = [
    "class-variance-authority",
    "clsx",
    "tailwindcss",           # in catalog ✓
    "@tanstack/react-query", # in catalog ✓
    "zod",
]
# NOTE: tailwind-merge is NOT in the current catalog — using explicit version below.

CATALOG_DEV = [
    "@types/node",
]

# ── Runtime deps — explicit versions ─────────────────────────────────────────
RUNTIME_DEPS = {
    # Not in catalog — explicit versions required
    "tailwind-merge":               "^2.6.0",   # FIX: was wrongly set as catalog:
    # UI primitives
    "cmdk":                         "^1.0.4",
    "embla-carousel-react":         "^8.6.0",
    "input-otp":                    "^1.4.2",
    "lucide-react":                 "^0.545.0",  # FIX: bumped from 0.511.0
    "next-themes":                  "^0.4.6",
    "react-day-picker":             "^8.10.1",   # v8 — matches shadcn calendar API
    "react-resizable-panels":       "^2.1.7",
    "recharts":                     "^2.15.3",
    "sonner":                       "^2.0.3",
    "vaul":                         "^1.1.2",
    "zustand":                      "^5.0.4",
    # Radix UI primitives (all used by shadcn/ui components)
    "@radix-ui/react-accordion":    "^1.2.11",
    "@radix-ui/react-alert-dialog": "^1.1.14",
    "@radix-ui/react-aspect-ratio": "^1.1.7",
    "@radix-ui/react-avatar":       "^1.1.10",
    "@radix-ui/react-checkbox":     "^1.3.2",
    "@radix-ui/react-collapsible":  "^1.1.11",
    "@radix-ui/react-context-menu": "^2.2.15",
    "@radix-ui/react-dialog":       "^1.1.14",
    "@radix-ui/react-dropdown-menu":"^2.1.15",
    "@radix-ui/react-hover-card":   "^1.1.14",
    "@radix-ui/react-label":        "^2.1.7",
    "@radix-ui/react-menubar":      "^1.1.15",
    "@radix-ui/react-navigation-menu":"^1.2.13",
    "@radix-ui/react-popover":      "^1.1.14",
    "@radix-ui/react-progress":     "^1.1.7",
    "@radix-ui/react-radio-group":  "^1.3.7",
    "@radix-ui/react-scroll-area":  "^1.2.9",
    "@radix-ui/react-select":       "^2.2.5",
    "@radix-ui/react-separator":    "^1.1.7",
    "@radix-ui/react-slider":       "^1.3.5",
    "@radix-ui/react-slot":         "^1.2.3",
    "@radix-ui/react-switch":       "^1.2.5",
    "@radix-ui/react-tabs":         "^1.1.12",
    "@radix-ui/react-toast":        "^1.2.14",
    "@radix-ui/react-toggle":       "^1.1.9",
    "@radix-ui/react-toggle-group": "^1.1.9",
    "@radix-ui/react-tooltip":      "^1.2.7",
}

# ── Dev deps — explicit versions ──────────────────────────────────────────────
DEV_ONLY_DEPS = {
    # FIX: @tailwindcss/vite is a build plugin → devDependencies, not dependencies
    "@tailwindcss/vite": "^4.1.14",
}

# ── Target package.json ──────────────────────────────────────────────────────
TARGET_PKG = {
    "name": "@workspace/r3-agi",
    "version": "0.0.0",
    "private": True,
    "type": "module",
    "scripts": {
        "dev": "vite --host",
        "build": "vite build",
        "typecheck": "tsc --noEmit",
    },
    "dependencies": {
        "react":     "catalog:",
        "react-dom": "catalog:",
        **{k: "catalog:" for k in CATALOG_DEPS},
        **RUNTIME_DEPS,
    },
    "devDependencies": {
        "@types/react":         "catalog:",
        "@types/react-dom":     "catalog:",
        "@vitejs/plugin-react": "catalog:",
        "vite":                 "catalog:",
        **{k: "catalog:" for k in CATALOG_DEV},
        **DEV_ONLY_DEPS,
    },
}

# ── Target vite.config.ts ─────────────────────────────────────────────────────
TARGET_VITE = """\
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
"""

# ── Tailwind v4 CSS directive ─────────────────────────────────────────────────
# Tailwind v4 with @tailwindcss/vite uses @import "tailwindcss"
# Tailwind v3 uses @tailwind base / @tailwind components / @tailwind utilities
# v3 directives are silently ignored by the v4 plugin → completely unstyled UI
CSS_V3_PATTERN = re.compile(r"@tailwind\s+(base|components|utilities)", re.MULTILINE)
CSS_V4_HEADER  = '@import "tailwindcss";\n'


def run(apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    print(f"\n{B}fix_r3_agi_deps.py{X}  [{mode}]\n")
    ok_count = 0; issue_count = 0

    # ── Pre-flight checks ─────────────────────────────────────────────────────
    for path, label in [(PKG_PATH, "package.json"), (VITE_PATH, "vite.config.ts")]:
        if not path.exists():
            err(f"Required file not found: {path.relative_to(ROOT)}")
            sys.exit(1)

    # ── Phase 1: delete bak-scaffold (causes TS compile error) ───────────────
    print(f"{B}Phase 1{X}  Remove App.tsx.bak-scaffold from src/")
    if BAK_FILE.exists():
        if apply:
            BAK_FILE.unlink()
            ok("Deleted apps/r3-agi/src/App.tsx.bak-scaffold")
        else:
            dry("Would delete: apps/r3-agi/src/App.tsx.bak-scaffold")
    else:
        ok("App.tsx.bak-scaffold not present — skipping")
    print()

    # ── Phase 2: package.json ─────────────────────────────────────────────────
    print(f"{B}Phase 2{X}  Update apps/r3-agi/package.json")
    current     = json.loads(PKG_PATH.read_text())
    current_all = {**current.get("dependencies", {}), **current.get("devDependencies", {})}
    new_all     = {**TARGET_PKG["dependencies"], **TARGET_PKG["devDependencies"]}
    added       = sorted(k for k in new_all if k not in current_all)
    info(f"Adding {len(added)} missing packages:")
    for pkg in added:
        print(f"        + {pkg}: {new_all[pkg]}")
    if apply:
        BACKUP.mkdir(parents=True, exist_ok=True)
        shutil.copy2(PKG_PATH, BACKUP / "package.json")
        PKG_PATH.write_text(json.dumps(TARGET_PKG, indent=2) + "\n")
        ok("Written: apps/r3-agi/package.json")
    else:
        dry("Would write: apps/r3-agi/package.json")
    print()

    # ── Phase 3: vite.config.ts ───────────────────────────────────────────────
    print(f"{B}Phase 3{X}  Update apps/r3-agi/vite.config.ts")
    current_vite = VITE_PATH.read_text()
    if "@tailwindcss/vite" in current_vite:
        ok("vite.config.ts already has tailwind plugin — skipping")
    else:
        if apply:
            shutil.copy2(VITE_PATH, BACKUP / "vite.config.ts")
            VITE_PATH.write_text(TARGET_VITE)
            ok("Written: apps/r3-agi/vite.config.ts (added @tailwindcss/vite)")
        else:
            dry("Would write: apps/r3-agi/vite.config.ts")
    print()

    # ── Phase 4: index.css — Tailwind v3 → v4 directive fix ──────────────────
    print(f"{B}Phase 4{X}  Check apps/r3-agi/src/index.css for Tailwind directives")
    if not CSS_PATH.exists():
        warn("index.css not found — skipping (will need to create it with @import \"tailwindcss\")")
    else:
        css = CSS_PATH.read_text()
        v3_matches = CSS_V3_PATTERN.findall(css)
        already_v4 = "@import" in css and "tailwindcss" in css

        if already_v4:
            ok("index.css already uses Tailwind v4 @import directive")
        elif v3_matches:
            warn(f"index.css uses Tailwind v3 directives: @tailwind {', '.join(v3_matches)}")
            info("With @tailwindcss/vite plugin, v3 directives are silently ignored → unstyled UI")
            # Replace v3 block with v4 import, keep the rest of the file
            fixed_css = CSS_V3_PATTERN.sub("", css)
            fixed_css = CSS_V4_HEADER + fixed_css.lstrip("\n")
            if apply:
                shutil.copy2(CSS_PATH, BACKUP / "index.css")
                CSS_PATH.write_text(fixed_css)
                ok("Written: apps/r3-agi/src/index.css (v3 directives → @import \"tailwindcss\")")
            else:
                dry("Would rewrite: apps/r3-agi/src/index.css (v3 → v4 directives)")
        else:
            warn("index.css has neither v3 directives nor v4 @import — Tailwind may not be active")
            info("Prepending @import \"tailwindcss\" to index.css")
            if apply:
                shutil.copy2(CSS_PATH, BACKUP / "index.css")
                CSS_PATH.write_text(CSS_V4_HEADER + css)
                ok("Written: apps/r3-agi/src/index.css (prepended @import \"tailwindcss\")")
            else:
                dry("Would prepend @import \"tailwindcss\" to index.css")
    print()

    # ── Summary ───────────────────────────────────────────────────────────────
    if apply:
        print(f"{G}All phases applied.{X}  Backups at: {BACKUP.relative_to(ROOT)}")
        print()
        print("Next steps:")
        print("  1.  pnpm install")
        print("      # installs all new deps")
        print()
        print("  2.  pnpm --filter @workspace/r3-agi typecheck")
        print("      # must be zero errors before proceeding")
        print()
        print("  3.  pnpm dev")
        print("      # both services start — verify UI loads with styles")
        print()
        warn("react-day-picker v8: if calendar.tsx shows type errors, check")
        print("       grep 'DayPicker' apps/r3-agi/src/components/ui/calendar.tsx | head -5")
    else:
        print(f"{Y}Dry run complete — rerun with --apply to write.{X}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="fix_r3_agi_deps — restore full dep manifest")
    p.add_argument("--apply", action="store_true", help="Write changes to disk")
    run(p.parse_args().apply)
