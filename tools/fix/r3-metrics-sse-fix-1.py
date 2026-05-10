#!/usr/bin/env python3
"""
r3-metrics-sse-fix-1.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wire.txt §14 compliant patch script — R3 AGI Suite / api-server

PURPOSE
  Two real-time data bugs in apps/api-server/src/routes/metrics.ts:

  FIX-1 · Initial SSE payload omits r3Metrics
    Root cause : /metrics/stream sends only { activeUsers, totalSubscribers }
                 on connect; broadcast() correctly spreads ...r3Metrics but
                 the initial write does not. Result: totalSessions = 0 on
                 connect → Header hides the SAVED/SESSIONS block permanently
                 until a heartbeat or prune fires.
    Fix        : Spread ...r3Metrics into the initial res.write() payload.
    Surface    : apps/api-server/src/routes/metrics.ts — GET /metrics/stream
    Regression : No new logic; only adds already-computed fields to one write.

  FIX-2 · fetchR3Metrics() refreshes r3Metrics but never broadcasts
    Root cause : After fetching updated time-savings from R3, r3Metrics is
                 reassigned but broadcast() is never called. SSE clients only
                 see updated values when a heartbeat or prune coincidentally
                 fires (up to 45 s lag or never during a quiet session).
    Fix        : Call broadcast() immediately after a successful r3Metrics
                 refresh so all connected clients receive the update within
                 the 30 s polling interval.
    Surface    : apps/api-server/src/routes/metrics.ts — fetchR3Metrics()
    Regression : broadcast() is already safe to call with 0 clients (iterates
                 empty Set). No new state; no new side-effects.

  FIX-3 · GET /metrics also omits r3Metrics
    Root cause : The REST snapshot endpoint GET /metrics returns only
                 { activeUsers, totalSubscribers }, making it inconsistent
                 with SSE payloads. Any polling client, reconnect fallback,
                 or health-check consumer would never see time savings data.
    Fix        : Spread ...r3Metrics into the res.json() call.
    Surface    : apps/api-server/src/routes/metrics.ts — GET /metrics
    Regression : r3Metrics is already in scope; no new state.

WIRE.TXT §14 GUARANTEES
  ✓ --dry-run is the DEFAULT  (--apply required to write)
  ✓ Timestamped .bak written BEFORE any destructive write
  ✓ assert count == 1 on every anchor before replacement
  ✓ Post-write content verified against expected patch
  ✓ pnpm tsc --noEmit executed as final step
  ✓ Non-zero exit on any failure — never silently continues

USAGE
  python3 r3-metrics-sse-fix-1.py           # dry-run (safe, default)
  python3 r3-metrics-sse-fix-1.py --apply   # write changes + run tsc

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import sys
import os
import shutil
import subprocess
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────────────

APPLY = "--apply" in sys.argv

# Resolve target relative to this script's location OR cwd.
# Script is expected to live in ~/Agi-Suite (or be run from there).
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_REL  = "apps/api-server/src/routes/metrics.ts"

# Try script dir first, then cwd (handles being placed in project root).
for base in [SCRIPT_DIR, os.getcwd()]:
    candidate = os.path.join(base, TARGET_REL)
    if os.path.isfile(candidate):
        TARGET = candidate
        REPO_ROOT = base
        break
else:
    print(f"[FATAL] Cannot locate {TARGET_REL}")
    print(f"        Tried: {SCRIPT_DIR}")
    print(f"        Tried: {os.getcwd()}")
    print("        Run this script from ~/Agi-Suite or place it there.")
    sys.exit(1)

# ─── Patch definitions ────────────────────────────────────────────────────────

PATCHES = [
    {
        "id": "FIX-1",
        "description": "Include r3Metrics in initial SSE stream payload",
        # Exact anchor — unique in file (only one initial res.write in the
        # /metrics/stream handler; broadcast uses a different variable path).
        "old": (
            '  res.write(\n'
            '    `data: ${JSON.stringify({ activeUsers: activeSessions.size, totalSubscribers })}\\n\\n`,\n'
            '  );'
        ),
        "new": (
            '  res.write(\n'
            '    `data: ${JSON.stringify({ activeUsers: activeSessions.size, totalSubscribers, ...r3Metrics })}\\n\\n`,\n'
            '  );'
        ),
    },
    {
        "id": "FIX-2",
        "description": "Broadcast updated r3Metrics to SSE clients after fetch",
        # Anchor: the entire if (res.ok) block inside fetchR3Metrics().
        # Only one occurrence in the file — confirmed by grep before patch.
        "old": (
            '    if (res.ok) {\n'
            '      r3Metrics = (await res.json()) as R3TimeSavings;\n'
            '    }'
        ),
        "new": (
            '    if (res.ok) {\n'
            '      r3Metrics = (await res.json()) as R3TimeSavings;\n'
            '      broadcast();\n'
            '    }'
        ),
    },
    {
        "id": "FIX-3",
        "description": "Include r3Metrics in GET /metrics JSON response",
        # Root cause: GET /metrics is a polling fallback and REST snapshot endpoint.
        # It returns { activeUsers, totalSubscribers } but omits r3Metrics entirely,
        # making it inconsistent with SSE payloads. Any client polling this route
        # (e.g. reconnect fallback, health check) would never see time savings data.
        # Anchor is unique: only one res.json call in the file returns this exact shape.
        "old": (
            'router.get("/metrics", (_req, res) => {\n'
            '  pruneStale();\n'
            '  res.json({ activeUsers: activeSessions.size, totalSubscribers });\n'
            '});'
        ),
        "new": (
            'router.get("/metrics", (_req, res) => {\n'
            '  pruneStale();\n'
            '  res.json({ activeUsers: activeSessions.size, totalSubscribers, ...r3Metrics });\n'
            '});'
        ),
    },
]

# ─── Helpers ─────────────────────────────────────────────────────────────────

def banner(msg: str) -> None:
    print(f"\n{'─' * 70}")
    print(f"  {msg}")
    print(f"{'─' * 70}")

def ok(msg: str)    -> None: print(f"  ✓  {msg}")
def warn(msg: str)  -> None: print(f"  ⚠  {msg}")
def fail(msg: str)  -> None: print(f"  ✗  {msg}")

def abort(msg: str) -> None:
    fail(msg)
    sys.exit(1)

def count_ts_errors(output: str) -> int:
    """Count TypeScript error lines in tsc output."""
    return sum(1 for line in output.splitlines() if "error TS" in line)

def diff_lines(old: str, new: str) -> None:
    """Print a simple line-diff of the two strings."""
    old_lines = old.splitlines()
    new_lines = new.splitlines()
    for line in old_lines:
        if line not in new_lines:
            print(f"      - {line}")
    for line in new_lines:
        if line not in old_lines:
            print(f"      + {line}")

# ─── Phase 1 — Read & confirm ────────────────────────────────────────────────

banner("PHASE 1 · READ")
print(f"  target : {TARGET}")
print(f"  mode   : {'APPLY' if APPLY else 'DRY-RUN'}")

try:
    with open(TARGET, "r", encoding="utf-8") as fh:
        original_content = fh.read()
except OSError as exc:
    abort(f"Cannot read target: {exc}")

ok(f"Read {len(original_content):,} bytes ({original_content.count(chr(10))} lines)")

# ─── Phase 2 — Anchor verification (count == 1 guard) ───────────────────────

banner("PHASE 2 · ANCHOR VERIFICATION")

for patch in PATCHES:
    count = original_content.count(patch["old"])
    if count == 0:
        fail(f"{patch['id']} — anchor NOT FOUND in file.")
        print()
        print("  Expected anchor:")
        for line in patch["old"].splitlines():
            print(f"    {repr(line)}")
        print()
        print("  Hint: The file may have already been patched, or whitespace")
        print("        differs. Run `cat -A` on the file to inspect.")
        abort("Aborting — anchor missing.")
    if count > 1:
        abort(
            f"{patch['id']} — anchor appears {count} times (expected exactly 1). "
            "Patch is unsafe to apply automatically."
        )
    ok(f"{patch['id']} — anchor found exactly once ✓")

# ─── Phase 3 — Dry-run diff ──────────────────────────────────────────────────

banner("PHASE 3 · PLANNED CHANGES")

patched_content = original_content
for patch in PATCHES:
    patched_content = patched_content.replace(patch["old"], patch["new"], 1)
    print(f"\n  [{patch['id']}] {patch['description']}")
    diff_lines(patch["old"], patch["new"])

if patched_content == original_content:
    abort("Patched content is identical to original — nothing would change.")

ok(f"Net delta: {len(patched_content) - len(original_content):+d} bytes")

# ─── Phase 4 — Post-patch anchor sanity check ────────────────────────────────

banner("PHASE 4 · POST-PATCH SANITY CHECK")

for patch in PATCHES:
    # The OLD anchor must be gone.
    remaining = patched_content.count(patch["old"])
    if remaining != 0:
        abort(f"{patch['id']} — old anchor still present after patch ({remaining}x). Logic error.")
    ok(f"{patch['id']} — old anchor removed ✓")

    # The NEW anchor must appear exactly once.
    inserted = patched_content.count(patch["new"])
    if inserted != 1:
        abort(f"{patch['id']} — new anchor appears {inserted}x (expected 1). Logic error.")
    ok(f"{patch['id']} — new anchor present exactly once ✓")

# ─── Dry-run exit ────────────────────────────────────────────────────────────

if not APPLY:
    banner("DRY-RUN COMPLETE — no files written")
    print("  Run with --apply to write changes and execute tsc.\n")
    sys.exit(0)

# ─── Phase 5 — TSC Baseline (pre-patch) ─────────────────────────────────────

banner("PHASE 5 · TSC BASELINE (pre-patch)")
print(f"  Capturing existing error count before any write…")
print(f"  cwd : {REPO_ROOT}")

baseline_result = subprocess.run(
    ["pnpm", "tsc", "--noEmit"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
)

baseline_errors = count_ts_errors(baseline_result.stdout + baseline_result.stderr)
ok(f"Pre-patch TSC: {baseline_errors} existing error(s) (exit {baseline_result.returncode})")
print(f"  (These will be used to detect regressions introduced by this patch)")

# ─── Phase 6 — Backup ────────────────────────────────────────────────────────

banner("PHASE 6 · BACKUP")

ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
bak = TARGET + f".bak-{ts}"

try:
    shutil.copy2(TARGET, bak)
except OSError as exc:
    abort(f"Cannot write backup: {exc}")

ok(f"Backup written → {bak}")

# Verify backup is byte-for-byte identical to what we read.
try:
    with open(bak, "r", encoding="utf-8") as fh:
        bak_content = fh.read()
except OSError as exc:
    abort(f"Cannot verify backup: {exc}")

if bak_content != original_content:
    abort("Backup content does not match original — filesystem issue. Aborting.")

ok("Backup verified ✓")

# ─── Phase 7 — Write ─────────────────────────────────────────────────────────

banner("PHASE 7 · WRITE")

try:
    with open(TARGET, "w", encoding="utf-8") as fh:
        fh.write(patched_content)
except OSError as exc:
    # Attempt to restore from backup before aborting.
    warn(f"Write failed: {exc}")
    warn("Attempting restore from backup...")
    try:
        shutil.copy2(bak, TARGET)
        ok("Backup restored successfully.")
    except OSError as restore_exc:
        fail(f"Restore also failed: {restore_exc}")
        fail(f"Manual recovery: cp '{bak}' '{TARGET}'")
    abort("Write failed — original restored from backup.")

ok(f"Wrote {len(patched_content):,} bytes to {TARGET}")

# ─── Phase 8 — Post-write verification ──────────────────────────────────────

banner("PHASE 8 · POST-WRITE VERIFICATION")

try:
    with open(TARGET, "r", encoding="utf-8") as fh:
        written_content = fh.read()
except OSError as exc:
    abort(f"Cannot re-read written file: {exc}")

if written_content != patched_content:
    abort("Written content does not match expected patched content. Filesystem issue.")

ok("Written content verified byte-for-byte ✓")

for patch in PATCHES:
    if patch["new"] not in written_content:
        abort(f"{patch['id']} — new anchor NOT found in written file. Critical error.")
    if patch["old"] in written_content:
        abort(f"{patch['id']} — old anchor still present in written file. Critical error.")
    ok(f"{patch['id']} — patch confirmed in written file ✓")

# ─── Phase 9 — TypeScript regression check ───────────────────────────────────

banner("PHASE 9 · pnpm tsc --noEmit (regression check)")
print(f"  cwd      : {REPO_ROOT}")
print(f"  baseline : {baseline_errors} pre-existing error(s)")

result = subprocess.run(
    ["pnpm", "tsc", "--noEmit"],
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
)

post_errors = count_ts_errors(result.stdout + result.stderr)
new_errors  = post_errors - baseline_errors

if result.stdout.strip():
    print()
    for line in result.stdout.strip().splitlines():
        print(f"  {line}")

if result.stderr.strip():
    print()
    for line in result.stderr.strip().splitlines():
        print(f"  {line}")

if new_errors > 0:
    # Patch introduced new errors — hard fail.
    fail(f"tsc: {new_errors} NEW error(s) introduced by this patch (total: {post_errors})")
    warn(f"To restore: cp '{bak}' '{TARGET}'")
    sys.exit(1)
elif result.returncode != 0 and new_errors == 0:
    # Pre-existing errors only — patch is clean, warn but don't fail.
    warn(f"tsc: {post_errors} error(s) present — all pre-existing, NONE introduced by this patch ✓")
    warn("Pre-existing errors must be resolved separately (see priorities queue).")
else:
    ok(f"pnpm tsc --noEmit: 0 errors ✓")

# ─── Done ────────────────────────────────────────────────────────────────────

banner("PATCH COMPLETE")
print(f"  FIX-1 : Initial SSE payload now includes ...r3Metrics")
print(f"  FIX-2 : broadcast() called after fetchR3Metrics() succeeds")
print(f"  FIX-3 : GET /metrics REST snapshot now includes ...r3Metrics")
print(f"  Backup: {bak}")
print(f"  Target: {TARGET}")
print()
