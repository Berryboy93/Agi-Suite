#!/usr/bin/env python3
"""
fix_docs_remaining.py — fix stale artifacts/ paths and port 8080 in
docs/README.md, docs/PRD.md, and docs/SKILLS.md

Usage:
  python3 fix_docs_remaining.py          # dry run
  python3 fix_docs_remaining.py --apply  # write
"""
import argparse, shutil, sys
from datetime import datetime
from pathlib import Path

ROOT   = Path.home() / "Agi-Suite" / "docs"
BACKUP = Path.home() / "Agi-Suite" / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")

G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; X = "\033[0m"; D = "\033[2m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def dry(m):  print(f"  {D}~  {m}{X}")
def info(m): print(f"  {B}→{X}  {m}")
def fail(m): print(f"  \033[91m✘\033[0m  {m}"); sys.exit(1)


REPLACEMENTS = {
    "README.md": [
        (
            "Create `.env` in `artifacts/api-server/`:",
            "Create `.env` in `apps/api-server/`:",
            ".env path",
        ),
        (
            "PORT=8080",
            "PORT=3001",
            "PORT in .env example",
        ),
        (
            "| API server (tsx watch) | http://localhost:8080 |",
            "| API server (tsx watch) | http://localhost:3001 |",
            "quick-start table port",
        ),
        (
            "├── artifacts/\n│   ├── api-server/         # Express backend\n│   ├── r3-agi/             # React 19 frontend\n│   └── mockup-sandbox/     # UI component development sandbox",
            "├── apps/\n│   ├── api-server/         # Express backend\n│   └── r3-agi/             # React 19 frontend",
            "workspace layout tree",
        ),
    ],
    "PRD.md": [
        (
            "**Frontend (`artifacts/r3-agi`)**",
            "**Frontend (`apps/r3-agi`)**",
            "frontend section label",
        ),
        (
            "**Backend (`artifacts/api-server`)**",
            "**Backend (`apps/api-server`)**",
            "backend section label",
        ),
        (
            "| `artifacts/api-server` | Integration — route handlers with supertest                     | P2       |",
            "| `apps/api-server` | Integration — route handlers with supertest                     | P2       |",
            "test coverage table",
        ),
        (
            "- `lib/` packages do not import from `artifacts/`\n- `artifacts/` packages may import from `lib/`",
            "- `lib/` packages do not import from `apps/`\n- `apps/` packages may import from `lib/`",
            "package boundary rules",
        ),
    ],
    "SKILLS.md": [
        (
            "Replace the dev script in `artifacts/api-server/package.json`:",
            "Replace the dev script in `apps/api-server/package.json`:",
            "A3 dev script path",
        ),
        (
            "artifacts/mockup-sandbox/src/.generated/\n",
            "",
            "remove stale mockup-sandbox .prettierignore entry",
        ),
        (
            "curl -N http://localhost:8080/api/metrics/stream",
            "curl -N http://localhost:3001/api/metrics/stream",
            "A7 metrics stream curl port",
        ),
        (
            "curl -N -X POST http://localhost:8080/api/agent/chat",
            "curl -N -X POST http://localhost:3001/api/agent/chat",
            "A7 agent chat curl port",
        ),
        (
            "curl -X POST http://localhost:8080/api/metrics/heartbeat",
            "curl -X POST http://localhost:3001/api/metrics/heartbeat",
            "A7 heartbeat curl port",
        ),
        (
            'path = Path("/home/r3v/Agi-Suite/artifacts/api-server/src/routes/agent.ts")',
            'path = Path("/home/r3v/Agi-Suite/apps/api-server/src/routes/agent.ts")',
            "A8 Python example absolute path",
        ),
    ],
}


def fix_file(name: str, apply: bool) -> int:
    path = ROOT / name
    if not path.exists():
        fail(f"Not found: docs/{name}")

    content = path.read_text()
    total_applied = 0

    for old, new, label in REPLACEMENTS[name]:
        count = content.count(old)
        if count == 0:
            info(f"SKIP (not found — already fixed?): {label}")
            continue
        if count > 1:
            fail(f"Anchor appears {count}× in {name} — expected 1: {repr(label)[:60]}")
        info(f"{'APPLY' if apply else 'WOULD'}  {label}")
        content = content.replace(old, new)
        total_applied += 1

    if total_applied == 0:
        ok(f"docs/{name} already up to date")
        return 0

    if apply:
        BACKUP.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, BACKUP / name)
        path.write_text(content)
        ok(f"Written: docs/{name} ({total_applied} replacements)")
    else:
        dry(f"Would write: docs/{name} ({total_applied} replacements)")

    return total_applied


def run(apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    print(f"\n{B}fix_docs_remaining.py{X}  [{mode}]\n")

    grand_total = 0
    for i, name in enumerate(REPLACEMENTS, 1):
        print(f"{B}Phase {i}{X}  docs/{name}")
        grand_total += fix_file(name, apply)
        print()

    if apply and grand_total > 0:
        print(f"{G}Done.{X}  {grand_total} replacements applied.")
        print(f"Backups at: .patch-backups/{BACKUP.name}")
        print()
        print("Verify:")
        print("  grep -n \"8080\\|artifacts/\" ~/Agi-Suite/docs/*.md")
        print("  # Only PRD.md §SKILLS.md historical/contextual mentions should remain")
    elif not apply:
        print(f"{Y}Dry run — rerun with --apply to write.{X}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    run(p.parse_args().apply)
