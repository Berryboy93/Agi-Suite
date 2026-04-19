#!/usr/bin/env python3
"""
restore_api_server.py — restore full api-server from git + fix vitest configs

Phase 1: Restore apps/api-server from git commit 21c3d611
         (same pattern as the r3-agi restore)
Phase 2: Write vitest.config.ts stubs for lib packages that vitest.workspace.ts
         references but that don't exist yet

Usage:
  python3 restore_api_server.py          # dry run
  python3 restore_api_server.py --apply  # write

After applying:
  pnpm approve-builds   # approve esbuild binary (required for production build)
  pnpm install          # pick up new api-server deps
  pnpm typecheck        # must be zero errors
  pnpm dev              # both services with full routing
"""
import argparse, json, shutil, subprocess, sys
from datetime import datetime
from pathlib import Path

ROOT         = Path.home() / "Agi-Suite"
APPS_API     = ROOT / "apps/api-server"
BACKUP       = ROOT / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")
GIT_COMMIT   = "21c3d611"
GIT_PREFIX   = "artifacts/api-server"

G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; R = "\033[91m"; X = "\033[0m"; D = "\033[2m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def warn(m): print(f"  {Y}⚠{X}  {m}")
def dry(m):  print(f"  {D}~  {m}{X}")
def info(m): print(f"  {B}→{X}  {m}")
def fail(m): print(f"  {R}✘{X}  {m}"); sys.exit(1)

# ── Files to restore from git ─────────────────────────────────────────────────
# Confirmed present via: git ls-tree -r 21c3d611 --name-only | grep artifacts/api-server/src
GIT_FILES = [
    "src/app.ts",
    "src/index.ts",
    "src/lib/logger.ts",
    "src/routes/agent.ts",
    "src/routes/health.ts",
    "src/routes/index.ts",
    "src/routes/metrics.ts",
]

# build.mjs and package.json from git — confirmed complete with:
# - esbuild + @anthropic-ai/sdk external
# - pino, pino-http, cookie-parser, cors, express 5
# - tsx watch dev script with --env-file=.env
# - PORT via process.env
RESTORE_ROOT_FILES = [
    "package.json",
    "build.mjs",
]

# tsconfig.json not present in git at that commit (confirmed: git show returned nothing)
# Will write a minimal one that matches the workspace base config
TSCONFIG = """\
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": false,
    "noEmit": false,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
"""

# ── vitest.config.ts stubs ────────────────────────────────────────────────────
# vitest.workspace.ts references these — they must exist or pnpm test crashes.
# Each lib package that has tests opts in with its own config.
# These stubs make the runner happy while test suites are still being written.
VITEST_STUB = """\
import {{ defineConfig }} from "vitest/config";

export default defineConfig({{
  test: {{
    environment: "node",
    include: ["src/**/*.test.ts"],
  }},
}});
"""

VITEST_TARGETS = [
    ROOT / "lib/api-zod/vitest.config.ts",
    ROOT / "lib/api-spec/vitest.config.ts",
    ROOT / "lib/db/vitest.config.ts",
]


def git_show(path: str) -> bytes:
    """Read a file from git history."""
    result = subprocess.run(
        ["git", "show", f"{GIT_COMMIT}:{GIT_PREFIX}/{path}"],
        cwd=ROOT,
        capture_output=True,
    )
    if result.returncode != 0:
        fail(f"git show failed for {path}: {result.stderr.decode()}")
    return result.stdout


def phase1_restore_api_server(apply: bool) -> None:
    print(f"{B}Phase 1{X}  Restore apps/api-server from git {GIT_COMMIT}")

    # Pre-flight: verify commit exists
    result = subprocess.run(
        ["git", "cat-file", "-e", GIT_COMMIT],
        cwd=ROOT, capture_output=True
    )
    if result.returncode != 0:
        fail(f"Commit {GIT_COMMIT} not found in git history")
    ok(f"Commit {GIT_COMMIT} confirmed in git history")

    # Backup current apps/api-server
    if apply:
        BACKUP.mkdir(parents=True, exist_ok=True)
        api_backup = BACKUP / "apps-api-server"
        if APPS_API.exists():
            shutil.copytree(APPS_API, api_backup)
            ok(f"Backed up current apps/api-server → {api_backup.relative_to(ROOT)}")

    # Restore src files from git
    info(f"Restoring {len(GIT_FILES)} source files from git:")
    for rel in GIT_FILES:
        target = APPS_API / rel
        content = git_show(rel)
        if apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            ok(f"  {rel}")
        else:
            dry(f"  Would restore: {rel} ({len(content)} bytes)")

    # Restore package.json and build.mjs from git
    info("Restoring package.json and build.mjs from git:")
    for rel in RESTORE_ROOT_FILES:
        target = APPS_API / rel
        content = git_show(rel)
        if apply:
            target.write_bytes(content)
            ok(f"  {rel}")
        else:
            dry(f"  Would restore: {rel}")

    # Write tsconfig.json (not in git — write fresh)
    tsconfig_path = APPS_API / "tsconfig.json"
    if apply:
        tsconfig_path.write_text(TSCONFIG)
        ok("  tsconfig.json (written fresh — not in git)")
    else:
        dry("  Would write: tsconfig.json")

    # Create required directories with .gitkeep
    for empty_dir in ["src/lib", "src/middlewares"]:
        gitkeep = APPS_API / empty_dir / ".gitkeep"
        if apply:
            gitkeep.parent.mkdir(parents=True, exist_ok=True)
            if not gitkeep.exists():
                gitkeep.touch()
        else:
            dry(f"  Would ensure: {empty_dir}/.gitkeep")

    # Verify key files after write
    if apply:
        pkg = json.loads((APPS_API / "package.json").read_text())
        assert pkg["name"] == "@workspace/api-server", "package.json name mismatch"
        assert "@anthropic-ai/sdk" in pkg["dependencies"], "SDK missing from deps"
        assert "--env-file=.env" in pkg["scripts"]["dev"], "dev script missing --env-file"
        assert pkg["scripts"]["typecheck"] == "tsc -p tsconfig.json --noEmit"
        ok("package.json verified: name, SDK dep, dev script, typecheck script")

        routes = [f.name for f in (APPS_API / "src/routes").iterdir() if f.suffix == ".ts"]
        assert "agent.ts" in routes, "agent.ts missing"
        assert "metrics.ts" in routes, "metrics.ts missing"
        assert "health.ts" in routes, "health.ts missing"
        ok(f"Routes verified: {sorted(routes)}")


def phase2_vitest_stubs(apply: bool) -> None:
    print(f"{B}Phase 2{X}  Write vitest.config.ts stubs for lib packages")
    info("vitest.workspace.ts references these — they must exist for pnpm test to run")

    for target in VITEST_TARGETS:
        pkg_name = target.parent.name
        if target.exists():
            ok(f"Already exists: {target.relative_to(ROOT)}")
            continue
        stub = VITEST_STUB.format()  # no format vars but keeps the pattern
        if apply:
            target.write_text(stub)
            ok(f"Written: {target.relative_to(ROOT)}")
        else:
            dry(f"Would write: {target.relative_to(ROOT)}")


def run(apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    print(f"\n{B}restore_api_server.py{X}  [{mode}]\n")

    if not ROOT.exists():
        fail(f"Workspace root not found: {ROOT}")

    phase1_restore_api_server(apply)
    print()
    phase2_vitest_stubs(apply)
    print()

    if apply:
        print(f"{G}Done.{X}  Backups at: .patch-backups/{BACKUP.name}")
        print()
        print("Required next steps (in order):")
        print()
        print("  1.  pnpm approve-builds")
        print("      # Select esbuild — required for production build.mjs")
        print()
        print("  2.  pnpm install")
        print("      # Installs @anthropic-ai/sdk, pino, pino-http, esbuild, etc.")
        print()
        print("  3.  Create apps/api-server/.env:")
        print("      PORT=3001")
        print("      ANTHROPIC_API_KEY=sk-ant-...")
        print("      DATABASE_URL=postgresql://...")
        print("      NODE_ENV=development")
        print()
        print("  4.  pnpm typecheck")
        print("      # Must be zero errors before proceeding")
        print()
        print("  5.  pnpm dev")
        print("      # Verify [api] starts with pino logging, not bare console.log")
        print("      # Verify [agi] loads at localhost:5173 with full dashboard")
        print()
        warn("esbuild allowBuilds is false — run pnpm approve-builds BEFORE pnpm install")
    else:
        print(f"{Y}Dry run — rerun with --apply to write.{X}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    run(p.parse_args().apply)
