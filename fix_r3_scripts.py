#!/usr/bin/env python3
"""
fix_r3_scripts.py — fix two bugs in the r3.sh boot sequence:
  1. r3.sh references wrong filenames for all three tool scripts
  2. doctor.sh dep fix list references morgan/helmet/dotenv which are
     not in the full api-server stack

Usage:
  python3 fix_r3_scripts.py          # dry run
  python3 fix_r3_scripts.py --apply  # write
"""
import argparse, shutil, sys
from datetime import datetime
from pathlib import Path

ROOT       = Path.home() / "Agi-Suite"
R3_SH      = ROOT / "r3.sh"
DOCTOR_SH  = ROOT / "tools/dev/doctor.sh"
BACKUP     = ROOT / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")

G = "\033[92m"; Y = "\033[93m"; B = "\033[94m"; X = "\033[0m"; D = "\033[2m"
def ok(m):   print(f"  {G}✔{X}  {m}")
def dry(m):  print(f"  {D}~  {m}{X}")
def info(m): print(f"  {B}→{X}  {m}")
def fail(m): print(f"  \033[91m✘\033[0m  {m}"); sys.exit(1)


# ── Correct r3.sh ─────────────────────────────────────────────────────────────
CORRECT_R3 = """\
#!/usr/bin/env bash
set -euo pipefail
echo "🔥 R3 SYSTEM BOOT SEQUENCE"
~/Agi-Suite/tools/dev/kill-ports.sh
~/Agi-Suite/tools/dev/doctor.sh
~/Agi-Suite/tools/dev/dev-kernel.sh
echo "🚀 SYSTEM ONLINE"
"""

# ── Correct doctor.sh ─────────────────────────────────────────────────────────
# Original checked for express and tried to add morgan/helmet/dotenv
# which are not in the full api-server stack.
# Correct check: verify @anthropic-ai/sdk (the key dep that proves full server).
# Correct fix: reinstall rather than add individual packages.
CORRECT_DOCTOR = """\
#!/usr/bin/env bash
set -euo pipefail
echo "🧠 Dependency health check..."
cd ~/Agi-Suite

# Check for @anthropic-ai/sdk — presence confirms full api-server is installed.
# If missing, node_modules is stale or corrupt — reinstall cleanly.
if ! [ -d "apps/api-server/node_modules/@anthropic-ai" ]; then
  echo "⚠️ api-server node_modules stale or missing — reinstalling..."
  pnpm install --silent
fi

echo "✅ Dependencies OK"
"""


def fix_r3_sh(apply: bool) -> None:
    print(f"{B}Phase 1{X}  Fix r3.sh — wrong script filenames")
    assert R3_SH.exists(), f"Not found: {R3_SH}"

    current = R3_SH.read_text()
    # Verify exact wrong names are present (triple-check before write)
    wrong = ["port-kill.sh", "r3-doctor.sh", "r3-dev.sh"]
    missing = [w for w in wrong if w not in current]
    if missing:
        info(f"Wrong names not found (already fixed?): {missing}")
        ok("r3.sh appears already correct — skipping")
        return

    info("port-kill.sh  → kill-ports.sh")
    info("r3-doctor.sh  → doctor.sh")
    info("r3-dev.sh     → dev-kernel.sh")

    assert current.count("port-kill.sh") == 1
    assert current.count("r3-doctor.sh") == 1
    assert current.count("r3-dev.sh")    == 1

    if apply:
        BACKUP.mkdir(parents=True, exist_ok=True)
        shutil.copy2(R3_SH, BACKUP / "r3.sh")
        R3_SH.write_text(CORRECT_R3)
        # Verify
        written = R3_SH.read_text()
        assert "kill-ports.sh" in written
        assert "doctor.sh" in written
        assert "dev-kernel.sh" in written
        assert "port-kill.sh" not in written
        ok("Written and verified: r3.sh")
    else:
        dry("Would rewrite r3.sh with correct filenames")


def fix_doctor_sh(apply: bool) -> None:
    print(f"{B}Phase 2{X}  Fix doctor.sh — wrong dep check and fix list")
    assert DOCTOR_SH.exists(), f"Not found: {DOCTOR_SH}"

    current = DOCTOR_SH.read_text()
    info("Original: checks for 'express', tries to add morgan/helmet/dotenv")
    info("Fixed:    checks for @anthropic-ai/sdk node_modules (full server marker)")
    info("Fixed:    runs pnpm install on failure instead of adding wrong packages")

    if apply:
        shutil.copy2(DOCTOR_SH, BACKUP / "doctor.sh")
        DOCTOR_SH.write_text(CORRECT_DOCTOR)
        written = DOCTOR_SH.read_text()
        assert "@anthropic-ai" in written
        assert "pnpm install" in written
        assert "morgan" not in written
        ok("Written and verified: tools/dev/doctor.sh")
    else:
        dry("Would rewrite tools/dev/doctor.sh with correct health check")


def run(apply: bool) -> None:
    mode = f"{G}APPLY{X}" if apply else f"{Y}DRY RUN{X}"
    print(f"\n{B}fix_r3_scripts.py{X}  [{mode}]\n")

    for path in [R3_SH, DOCTOR_SH]:
        if not path.exists():
            fail(f"Required file not found: {path.relative_to(ROOT)}")

    fix_r3_sh(apply);     print()
    fix_doctor_sh(apply); print()

    if apply:
        print(f"{G}Done.{X}  Backups at: .patch-backups/{BACKUP.name}")
        print()
        print("Verify:")
        print("  bash ~/Agi-Suite/r3.sh   # should boot cleanly")
        print("  # or use pnpm dev (canonical)")
    else:
        print(f"{Y}Dry run — rerun with --apply to write.{X}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    run(p.parse_args().apply)
