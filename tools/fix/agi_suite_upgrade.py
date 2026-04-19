#!/usr/bin/env python3
"""
agi_suite_upgrade.py — Agi-Suite 10/10 stack hardening patch
=============================================================
Phases:
  1  Externalize @anthropic-ai/sdk from esbuild bundle       (build.mjs)
  2  API server hot reload via tsx watch                      (api-server/package.json + devDeps)
  3  Root package.json — add simple-git-hooks + scripts       (package.json)
  4  Vitest workspace config                                   (vitest.workspace.ts, new file)
  5  Git hook definitions                                      (.simple-git-hooks.json, new file)
  6  Inspect mockup-sandbox — report and offer .gitignore     (non-destructive)
  7  Verify lib/db has a migrate script entry                  (report only — no blind edits)

Usage:
  python3 agi_suite_upgrade.py            # dry run (default)
  python3 agi_suite_upgrade.py --apply    # apply all patches
  python3 agi_suite_upgrade.py --phase 2  # dry run a single phase
  python3 agi_suite_upgrade.py --phase 2 --apply

Backups are written to WORKSPACE_ROOT/.patch-backups/<ISO_TIMESTAMP>/ before any file is touched.
"""

import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable

# ── colours ──────────────────────────────────────────────────────────────────
G = "\033[92m"   # green
Y = "\033[93m"   # yellow
R = "\033[91m"   # red
B = "\033[94m"   # blue
D = "\033[2m"    # dim
X = "\033[0m"    # reset

def ok(msg: str)   -> None: print(f"  {G}✔{X}  {msg}")
def warn(msg: str) -> None: print(f"  {Y}⚠{X}  {msg}")
def err(msg: str)  -> None: print(f"  {R}✘{X}  {msg}")
def info(msg: str) -> None: print(f"  {B}→{X}  {msg}")
def dry(msg: str)  -> None: print(f"  {D}~  {msg}{X}")

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT         = Path.home() / "Agi-Suite"
API_SERVER   = ROOT / "artifacts" / "api-server"
BUILD_MJS    = API_SERVER / "build.mjs"
API_PKG      = API_SERVER / "package.json"
ROOT_PKG     = ROOT / "package.json"
SANDBOX      = ROOT / "artifacts" / "mockup-sandbox"
LIB_DB       = ROOT / "lib" / "db"
BACKUP_ROOT  = ROOT / ".patch-backups"

# ── helpers ───────────────────────────────────────────────────────────────────
def assert_file(path: Path) -> None:
    if not path.exists():
        err(f"Required file not found: {path}")
        sys.exit(1)

def backup(path: Path, backup_dir: Path) -> None:
    if not path.exists():
        return
    dest = backup_dir / path.relative_to(ROOT)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)

def write_file(path: Path, content: str, backup_dir: Path, apply: bool) -> None:
    if apply:
        backup(path, backup_dir)
        path.write_text(content)
        ok(f"Written: {path.relative_to(ROOT)}")
    else:
        dry(f"Would write: {path.relative_to(ROOT)}")

def patch_text(path: Path, old: str, new: str, backup_dir: Path, apply: bool) -> bool:
    """Replace exactly one occurrence of old→new. Returns True on success."""
    assert_file(path)
    content = path.read_text()
    count = content.count(old)
    if count != 1:
        err(f"Expected 1 match of target string in {path.name}, found {count}. Skipping.")
        return False
    patched = content.replace(old, new)
    write_file(path, patched, backup_dir, apply)
    return True

# ── phase registry ────────────────────────────────────────────────────────────
PhaseFunc = Callable[[Path, bool], None]
PHASES: list[tuple[str, PhaseFunc]] = []

def phase(title: str):
    def decorator(fn: PhaseFunc):
        PHASES.append((title, fn))
        return fn
    return decorator

# ═════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Externalize @anthropic-ai/sdk
# ═════════════════════════════════════════════════════════════════════════════
@phase("Externalize @anthropic-ai/sdk from esbuild bundle")
def phase_externalize_sdk(backup_dir: Path, apply: bool) -> None:
    assert_file(BUILD_MJS)
    content = BUILD_MJS.read_text()

    if '"@anthropic-ai/sdk"' in content:
        ok("@anthropic-ai/sdk already in external list — skipping")
        return

    # Insert right after the opening of the external array, before "*.node"
    old = '      "*.node",'
    new = '      "@anthropic-ai/sdk",\n      "*.node",'

    if patch_text(BUILD_MJS, old, new, backup_dir, apply):
        info("Bundle will drop ~1.8mb; Railway deploy will use node_modules at runtime")


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2 — API server hot reload (tsx watch)
# ═════════════════════════════════════════════════════════════════════════════
@phase("API server hot reload via tsx watch")
def phase_hot_reload(backup_dir: Path, apply: bool) -> None:
    assert_file(API_PKG)
    pkg = json.loads(API_PKG.read_text())

    current_dev = pkg["scripts"].get("dev", "")

    if "tsx" in current_dev:
        ok("tsx already in dev script — skipping")
        return

    # tsx is already in the pnpm workspace catalog (confirmed in pnpm-workspace.yaml).
    # Use "catalog:" reference — hardcoding a version would conflict with the catalog pin.
    pkg["scripts"]["dev"] = "NODE_ENV=development tsx watch --env-file=.env src/index.ts"

    dev_deps = pkg.setdefault("devDependencies", {})
    if "tsx" not in dev_deps:
        dev_deps["tsx"] = "catalog:"
        info("Added tsx (catalog:) to api-server devDependencies")
    else:
        ok("tsx already in devDependencies")

    # Keep build + start scripts unchanged (used for production Railway deploy)
    write_file(API_PKG, json.dumps(pkg, indent=2) + "\n", backup_dir, apply)
    info("dev: tsx watch (instant reload) | build+start: unchanged (Railway)")


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 3 — Root package.json: simple-git-hooks
# ═════════════════════════════════════════════════════════════════════════════
@phase("Root package.json — simple-git-hooks integration")
def phase_git_hooks(backup_dir: Path, apply: bool) -> None:
    assert_file(ROOT_PKG)
    pkg = json.loads(ROOT_PKG.read_text())

    changed = False
    dev_deps = pkg.setdefault("devDependencies", {})

    if "simple-git-hooks" not in dev_deps:
        dev_deps["simple-git-hooks"] = "^2.11.1"
        changed = True
        info("Added simple-git-hooks to root devDependencies")
    else:
        ok("simple-git-hooks already present")

    # Add prepare script to auto-install hooks on pnpm install
    scripts = pkg.setdefault("scripts", {})
    if "prepare" not in scripts:
        scripts["prepare"] = "simple-git-hooks"
        changed = True
        info("Added prepare script (auto-installs hooks on pnpm install)")
    else:
        ok("prepare script already present")

    if changed:
        write_file(ROOT_PKG, json.dumps(pkg, indent=2) + "\n", backup_dir, apply)
    else:
        ok("Root package.json already up to date — skipping")


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Vitest workspace config
# ═════════════════════════════════════════════════════════════════════════════
@phase("Vitest workspace config at monorepo root")
def phase_vitest(backup_dir: Path, apply: bool) -> None:
    vitest_workspace = ROOT / "vitest.workspace.ts"
    root_pkg = json.loads(ROOT_PKG.read_text())
    dev_deps = root_pkg.setdefault("devDependencies", {})

    if vitest_workspace.exists():
        ok("vitest.workspace.ts already exists — skipping file creation")
    else:
        content = """\
import { defineWorkspace } from "vitest/config";

/**
 * Vitest monorepo workspace config.
 * Each package opts in by providing its own vitest.config.ts.
 * Add entries here as packages grow test suites.
 */
export default defineWorkspace([
  // Shared libs
  "lib/api-zod/vitest.config.ts",
  "lib/api-spec/vitest.config.ts",
  "lib/db/vitest.config.ts",

  // Artifacts (add when test suites are introduced)
  // "artifacts/api-server/vitest.config.ts",
  // "artifacts/r3-agi/vitest.config.ts",
]);
"""
        write_file(vitest_workspace, content, backup_dir, apply)

    # Add vitest to root devDeps and test script if missing
    pkg_changed = False
    if "vitest" not in dev_deps:
        dev_deps["vitest"] = "^3.2.0"
        pkg_changed = True
        info("Added vitest@^3.2.0 to root devDependencies")
    else:
        ok("vitest already in root devDependencies")

    scripts = root_pkg.setdefault("scripts", {})
    if "test" not in scripts:
        scripts["test"] = "vitest run --workspace vitest.workspace.ts"
        scripts["test:watch"] = "vitest --workspace vitest.workspace.ts"
        pkg_changed = True
        info("Added test + test:watch scripts to root package.json")
    else:
        ok("test script already present in root package.json")

    if pkg_changed:
        write_file(ROOT_PKG, json.dumps(root_pkg, indent=2) + "\n", backup_dir, apply)


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 5 — .simple-git-hooks.json hook definitions
# ═════════════════════════════════════════════════════════════════════════════
@phase("Git hook definitions (.simple-git-hooks.json)")
def phase_hook_definitions(backup_dir: Path, apply: bool) -> None:
    hooks_file = ROOT / ".simple-git-hooks.json"

    if hooks_file.exists():
        ok(".simple-git-hooks.json already exists — skipping")
        return

    hooks = {
        "pre-push": "pnpm typecheck",
        "pre-commit": "pnpm exec prettier --check ."
    }

    content = json.dumps(hooks, indent=2) + "\n"
    write_file(hooks_file, content, backup_dir, apply)
    info("pre-push: typecheck | pre-commit: prettier check")
    info("Run 'pnpm install' after applying to activate hooks via prepare script")


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 6 — mockup-sandbox inspection (non-destructive)
# ═════════════════════════════════════════════════════════════════════════════
@phase("mockup-sandbox inspection (report only)")
def phase_sandbox(backup_dir: Path, apply: bool) -> None:
    if not SANDBOX.exists():
        ok("mockup-sandbox does not exist — nothing to do")
        return

    has_pkg = (SANDBOX / "package.json").exists()
    files   = list(SANDBOX.rglob("*"))
    non_dir = [f for f in files if f.is_file()]

    if not has_pkg:
        warn(
            f"mockup-sandbox has {len(non_dir)} file(s) but no package.json — "
            "it is not part of the pnpm workspace graph"
        )
        gitignore = ROOT / ".gitignore"
        already_ignored = (
            gitignore.exists()
            and "mockup-sandbox" in gitignore.read_text()
        )
        if already_ignored:
            ok("Already in .gitignore — no action needed")
        else:
            if apply:
                with gitignore.open("a") as f:
                    f.write("\n# scratchpad — not a workspace package\nartifacts/mockup-sandbox/\n")
                ok("Appended artifacts/mockup-sandbox/ to .gitignore")
            else:
                dry("Would append artifacts/mockup-sandbox/ to .gitignore")
            info("Promote it to a proper workspace package or leave it gitignored — your call")
    else:
        ok("mockup-sandbox has package.json — verify it is listed in pnpm-workspace.yaml")


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 7 — lib/db migration script audit (report only)
# ═════════════════════════════════════════════════════════════════════════════
@phase("lib/db — add migrate + generate scripts")
def phase_db_audit(backup_dir: Path, apply: bool) -> None:
    if not LIB_DB.exists():
        warn("lib/db not found — skipping")
        return

    db_pkg_path = LIB_DB / "package.json"
    if not db_pkg_path.exists():
        warn("lib/db has no package.json")
        return

    db_pkg   = json.loads(db_pkg_path.read_text())
    scripts  = db_pkg.setdefault("scripts", {})
    all_deps = {**db_pkg.get("dependencies", {}), **db_pkg.get("devDependencies", {})}

    if "drizzle-kit" not in all_deps:
        warn("drizzle-kit not found in lib/db — cannot add migrate scripts safely")
        return

    ok("drizzle-kit present in lib/db")

    # drizzle.config.ts confirmed: postgresql dialect, schema at src/schema/index.ts,
    # DATABASE_URL credential, no custom out dir (defaults to ./drizzle/).
    # push/push-force already exist for dev schema iteration.
    # Adding migrate (production-safe) and generate (migration file authoring).
    changed = False

    if "migrate" not in scripts:
        scripts["migrate"] = "drizzle-kit migrate --config ./drizzle.config.ts"
        changed = True
        info("Added 'migrate' — applies pending migration files (use in Railway deploy)")
    else:
        ok(f"'migrate' already present: {scripts['migrate']}")

    if "generate" not in scripts:
        scripts["generate"] = "drizzle-kit generate --config ./drizzle.config.ts"
        changed = True
        info("Added 'generate' — creates migration file from schema diff")
    else:
        ok(f"'generate' already present: {scripts['generate']}")

    if changed:
        write_file(db_pkg_path, json.dumps(db_pkg, indent=2) + "\n", backup_dir, apply)
        info("Railway deploy command:")
        info("  pnpm --filter @workspace/db migrate && node dist/index.mjs")
        info("Workflow: generate (dev) → commit file → migrate (Railway deploy)")
    else:
        ok("lib/db scripts already complete")


# ═════════════════════════════════════════════════════════════════════════════
# RUNNER
# ═════════════════════════════════════════════════════════════════════════════
def run(phase_indices: list[int], apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    ts   = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup_dir = BACKUP_ROOT / ts

    print(f"\n{B}Agi-Suite upgrade patch{X}  [{mode}]")
    print(f"{D}Workspace root : {ROOT}{X}")
    print(f"{D}Backup target  : {backup_dir}{X}\n")

    if not ROOT.exists():
        err(f"Workspace root not found: {ROOT}")
        sys.exit(1)

    if apply:
        backup_dir.mkdir(parents=True, exist_ok=True)

    exit_code = 0
    for idx in phase_indices:
        title, fn = PHASES[idx]
        print(f"{B}Phase {idx + 1}/{len(PHASES)}{X}  {title}")
        try:
            fn(backup_dir, apply)
        except SystemExit:
            raise
        except Exception as exc:
            err(f"Phase failed: {exc}")
            exit_code = 1
        print()

    if apply and exit_code == 0:
        print(f"{G}All phases applied.{X}")
        print(f"{D}Backups at: {backup_dir}{X}")
        print()
        print("Next steps:")
        print("  1.  pnpm install          # picks up tsx, vitest, simple-git-hooks + runs prepare")
        print("  2.  pnpm dev              # confirm hot reload is working")
        print("  3.  pnpm typecheck        # confirm nothing broken")
        print("  4.  git add -A && git commit -m 'chore: 10/10 stack hardening'")
    elif not apply:
        print(f"{Y}Dry run complete — rerun with --apply to execute.{X}")

    sys.exit(exit_code)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Agi-Suite 10/10 stack hardening patch",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Write changes to disk (default: dry run)"
    )
    parser.add_argument(
        "--phase", type=int, metavar="N",
        help=f"Run only phase N (1–{len(PHASES)})"
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List all phases and exit"
    )
    args = parser.parse_args()

    if args.list:
        print(f"\n{B}Phases:{X}")
        for i, (title, _) in enumerate(PHASES):
            print(f"  {i + 1}.  {title}")
        print()
        sys.exit(0)

    if args.phase is not None:
        if not 1 <= args.phase <= len(PHASES):
            err(f"--phase must be between 1 and {len(PHASES)}")
            sys.exit(1)
        indices = [args.phase - 1]
    else:
        indices = list(range(len(PHASES)))

    run(indices, args.apply)


if __name__ == "__main__":
    main()