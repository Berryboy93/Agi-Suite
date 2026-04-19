#!/usr/bin/env python3
"""
fix_docs.py — update DEVELOPMENT.md, API.md, ARCHITECTURE.md
to reflect workspace restructure: artifacts/ → apps/, port 8080 → 3001

Usage:
  python3 fix_docs.py          # dry run (shows all changes)
  python3 fix_docs.py --apply  # write
"""
import argparse, re, shutil, sys
from datetime import datetime
from pathlib import Path

ROOT   = Path.home() / "Agi-Suite" / "docs"
BACKUP = Path.home() / "Agi-Suite" / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")

G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; X = "\033[0m"; D = "\033[2m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def dry(m):  print(f"  {D}~  {m}{X}")
def info(m): print(f"  {B}→{X}  {m}")
def fail(m): print(f"  \033[91m✘\033[0m  {m}"); sys.exit(1)


def patch(content: str, old: str, new: str, label: str, apply: bool, counts: dict) -> str:
    n = content.count(old)
    if n == 0:
        info(f"SKIP (not found — already fixed?): {label}")
        return content
    counts["total"] += n
    if apply:
        counts["applied"] += n
    info(f"{'APPLY' if apply else 'WOULD':5}  ({n}×)  {label}")
    return content.replace(old, new)


def fix_development_md(apply: bool) -> None:
    path = ROOT / "DEVELOPMENT.md"
    assert path.exists(), f"Not found: {path}"
    content = path.read_text()
    counts = {"total": 0, "applied": 0}

    print(f"{B}Phase 1{X}  DEVELOPMENT.md")

    replacements = [
        # .env path
        ("Create `artifacts/api-server/.env`:",
         "Create `apps/api-server/.env`:",
         ".env path"),
        # PORT in .env example
        ("PORT=8080",
         "PORT=3001",
         "PORT in .env example"),
        # dev server description port + path
        ("port 8080. Restarts instantly on any source change in `artifacts/api-server/src/`.",
         "port 3001. Restarts instantly on any source change in `apps/api-server/src/`.",
         "dev server description"),
        # api-server changes path
        ("Edit any file in `artifacts/api-server/src/`.",
         "Edit any file in `apps/api-server/src/`.",
         "api-server src path"),
        # r3-agi changes path
        ("Edit any file in `artifacts/r3-agi/src/`.",
         "Edit any file in `apps/r3-agi/src/`.",
         "r3-agi src path"),
        # endpoint route paths (×2 — both appear in the adding-endpoint steps)
        ("Implement the route in `artifacts/api-server/src/routes/`",
         "Implement the route in `apps/api-server/src/routes/`",
         "route implementation path"),
        ("Register it in `artifacts/api-server/src/routes/index.ts`",
         "Register it in `apps/api-server/src/routes/index.ts`",
         "route registration path"),
        # typecheck description
        ("Per-artifact `tsc --noEmit` — checks `artifacts/` and `scripts/` independently",
         "Per-package `tsc --noEmit` — checks `apps/` and `scripts/` independently",
         "typecheck description"),
        # log example port
        ("Server listening { port: 8080 }",
         "Server listening { port: 3001 }",
         "log example port"),
        # curl examples
        ("curl -N http://localhost:8080/api/metrics/stream",
         "curl -N http://localhost:3001/api/metrics/stream",
         "curl metrics stream"),
        ("curl -N -X POST http://localhost:8080/api/agent/chat",
         "curl -N -X POST http://localhost:3001/api/agent/chat",
         "curl agent chat"),
    ]

    for old, new, label in replacements:
        content = patch(content, old, new, label, apply, counts)

    # Remove the mockup sandbox section entirely — artifacts/mockup-sandbox is gone
    sandbox_section = (
        "## Mockup sandbox\n\n"
        "`artifacts/mockup-sandbox` is a Vite-powered component development environment. "
        "It contains the full shadcn/ui component library and a live preview of mockup components.\n\n"
        "Use it to prototype UI components in isolation before integrating them into `r3-agi`. "
        "It is a proper workspace package (has `package.json`) but is not part of the production build.\n\n"
        "---\n\n"
    )
    content = patch(content, sandbox_section, "", "mockup sandbox section (removed)", apply, counts)

    if apply:
        BACKUP.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, BACKUP / "DEVELOPMENT.md")
        path.write_text(content)
        ok(f"Written: docs/DEVELOPMENT.md ({counts['applied']} replacements)")
    else:
        dry(f"Would write: docs/DEVELOPMENT.md ({counts['total']} replacements)")


def fix_api_md(apply: bool) -> None:
    path = ROOT / "API.md"
    assert path.exists(), f"Not found: {path}"
    content = path.read_text()
    counts = {"total": 0, "applied": 0}

    print(f"{B}Phase 2{X}  API.md")

    replacements = [
        ("http://localhost:8080/api",
         "http://localhost:3001/api",
         "base URL port"),
    ]

    for old, new, label in replacements:
        content = patch(content, old, new, label, apply, counts)

    if apply:
        shutil.copy2(path, BACKUP / "API.md")
        path.write_text(content)
        ok(f"Written: docs/API.md ({counts['applied']} replacements)")
    else:
        dry(f"Would write: docs/API.md ({counts['total']} replacements)")


def fix_architecture_md(apply: bool) -> None:
    path = ROOT / "ARCHITECTURE.md"
    assert path.exists(), f"Not found: {path}"
    content = path.read_text()
    counts = {"total": 0, "applied": 0}

    print(f"{B}Phase 3{X}  ARCHITECTURE.md")

    replacements = [
        # Package graph — both path references
        ("artifacts/api-server",
         "apps/api-server",
         "artifacts/api-server → apps/api-server"),
        ("artifacts/r3-agi",
         "apps/r3-agi",
         "artifacts/r3-agi → apps/r3-agi"),
    ]

    for old, new, label in replacements:
        content = patch(content, old, new, label, apply, counts)

    if apply:
        shutil.copy2(path, BACKUP / "ARCHITECTURE.md")
        path.write_text(content)
        ok(f"Written: docs/ARCHITECTURE.md ({counts['applied']} replacements)")
    else:
        dry(f"Would write: docs/ARCHITECTURE.md ({counts['total']} replacements)")


def run(apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    print(f"\n{B}fix_docs.py{X}  [{mode}]\n")

    for name in ["DEVELOPMENT.md", "API.md", "ARCHITECTURE.md"]:
        if not (ROOT / name).exists():
            fail(f"Not found: docs/{name}")

    fix_development_md(apply); print()
    fix_api_md(apply);         print()
    fix_architecture_md(apply); print()

    if apply:
        print(f"{G}Done.{X}  Backups at: .patch-backups/{BACKUP.name}")
        print()
        print("Verify:")
        print("  grep -n '8080\\|artifacts/' ~/Agi-Suite/docs/*.md")
        print("  # Should return nothing except archived/historical references")
    else:
        print(f"{Y}Dry run — rerun with --apply to write.{X}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    run(p.parse_args().apply)
