#!/usr/bin/env bash

# deploy-kernel.sh — Distributed Plugin Execution Kernel v1 (fixed)
# Fixes applied per WIRE.txt v2.0, ARCHITECTURE.md, SKILLS.md §A1–A9

set -euo pipefail

echo "=================================================="
echo "🧠 Distributed Plugin Execution Kernel v1"
echo "=================================================="

# --------------------------------------------------
# 1. ROOT + SNAPSHOT LAYER
# --------------------------------------------------
# BUG FIX: was "$(dirname "$0")/.." — that ascends above the script's directory.
# Correct only if the script lives in scripts/. This script lives at the repo
# root (~/Agi-Suite/), so /.. resolved to /home/r3v, causing tar to attempt
# archiving the entire home directory, failing silently under set -e before
# the ERR trap was even registered.
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
echo "→ ROOT: $ROOT"

SNAPSHOT_DIR="$ROOT/.repo_snapshots"
mkdir -p "$SNAPSHOT_DIR"

SNAPSHOT_ID="$(date +%Y%m%d_%H%M%S)"
SNAPSHOT_PATH="$SNAPSHOT_DIR/$SNAPSHOT_ID.tar.gz"

echo "→ Snapshot: $SNAPSHOT_ID"

# --------------------------------------------------
# ROLLBACK HELPER + ERR TRAP
# Defined before ANY failable command — nothing can exit silently.
# Pre-snapshot trap: archive not yet valid, just report and abort.
# --------------------------------------------------

rollback () {
  local reason="${1:-unknown}"
  echo ""
  echo "❌ ROLLBACK TRIGGERED: $reason"
  echo "→ Restoring from snapshot $SNAPSHOT_ID ..."
  tar -xzf "$SNAPSHOT_PATH" -C "$ROOT"
  echo "→ Rollback complete."
}

trap 'echo "❌ Fatal error before snapshot ready — no writes made"; exit 1' ERR

# --------------------------------------------------
# SNAPSHOT PRUNING — run before writing new snapshot.
# Old snapshots accumulate on the same filesystem and consume the space
# needed to write the next one. Keep the 2 most recent; delete the rest.
# Pruning first means freed space is available for the new archive.
# --------------------------------------------------
echo "→ Pruning old snapshots (keeping 2)..."
EXISTING_SNAPSHOTS=( $(ls -t "$SNAPSHOT_DIR"/*.tar.gz 2>/dev/null) )
KEEP=2
if [ "${#EXISTING_SNAPSHOTS[@]}" -gt "$KEEP" ]; then
  for old_snap in "${EXISTING_SNAPSHOTS[@]:$KEEP}"; do
    echo "   Removing: $(basename "$old_snap")"
    rm -f "$old_snap"
  done
fi

# --------------------------------------------------
# PRE-FLIGHT DISK SPACE CHECK
# Abort before creating a zero-byte archive if there is insufficient space.
# Threshold: 200MB. A source-only snapshot of a typical monorepo (no
# node_modules, no .git) is well under 50MB; 200MB gives 4× headroom.
# --------------------------------------------------
REQUIRED_KB=204800  # 200 MB
AVAILABLE_KB=$(df -k "$ROOT" | awk 'NR==2 {print $4}')
echo "→ Disk: ${AVAILABLE_KB}KB available, ${REQUIRED_KB}KB required"
if [ "$AVAILABLE_KB" -lt "$REQUIRED_KB" ]; then
  echo "❌ Insufficient disk space for snapshot."
  echo "   Available : ${AVAILABLE_KB}KB"
  echo "   Required  : ${REQUIRED_KB}KB"
  echo "   Free space and retry, or remove files from the Penguin container:"
  echo "     df -h $ROOT"
  echo "     du -sh $ROOT/* | sort -rh | head -20"
  trap - ERR
  exit 1
fi

# WIRE.txt §Backup Protocol: timestamped backup before any destructive operation.
#
# || true is intentional: tar exits 1 for warnings (files changing mid-read,
# long paths) even when the archive is successfully written. set -e treats
# exit 1 and exit 2 identically — without || true the script exits silently
# before the file-existence check runs. stderr captured to tmpfile so the
# error message is shown on failure instead of being discarded.
TAR_ERR="$(mktemp)"
tar -czf "$SNAPSHOT_PATH" \
  --exclude=".repo_snapshots" \
  --exclude="node_modules" \
  --exclude=".git" \
  . 2>"$TAR_ERR" || true

if [ ! -f "$SNAPSHOT_PATH" ] || [ ! -s "$SNAPSHOT_PATH" ]; then
  echo "❌ Snapshot archive missing or empty after tar run."
  echo "   Available disk (post-attempt): $(df -k "$ROOT" | awk 'NR==2 {print $4}')KB"
  echo "   tar stderr:"
  cat "$TAR_ERR"
  rm -f "$TAR_ERR"
  trap - ERR
  exit 1
fi
rm -f "$TAR_ERR"

echo "→ Snapshot confirmed: $SNAPSHOT_PATH ($(du -h "$SNAPSHOT_PATH" | cut -f1))"

# Snapshot valid — upgrade to full rollback trap for everything that follows.
trap 'rollback "unexpected exit (set -e triggered)"' ERR

# --------------------------------------------------
# 2. STAGE RESOLUTION
# --------------------------------------------------
echo ""
echo "=============================="
echo "🧭 STAGE RESOLUTION"
echo "=============================="

CANDIDATES=(
  "$HOME/Downloads/phase2"
  "$HOME/Downloads"
  "$HOME/Agi-Suite/phase2-staging"
)

STAGE=""

for dir in "${CANDIDATES[@]}"; do
  # ls glob is wrapped in a subshell so a no-match non-zero exit
  # does not trigger set -e here; the outer if handles falsy.
  if [ -d "$dir" ] && ls "$dir"/*.{ts,yaml,sh} >/dev/null 2>&1; then
    STAGE="$dir"
    break
  fi
done

if [ -z "$STAGE" ]; then
  echo "❌ No staging directory found containing .ts/.yaml/.sh files"
  # Disable trap before clean exit — no files were written, no rollback needed.
  trap - ERR
  exit 1
fi

STAGE="$(realpath "$STAGE")"
echo "→ STAGE: $STAGE"

# --------------------------------------------------
# 3. PLUGIN SYSTEM
# --------------------------------------------------
PLUGIN_DIR=".plugins"
mkdir -p "$PLUGIN_DIR"

# FIX 7: Truncate registry before each run to prevent duplicate accumulation.
# Running the kernel twice would otherwise double-register every plugin.
> "$PLUGIN_DIR/registry.list"

register_plugin () {
  echo "$1" >> "$PLUGIN_DIR/registry.list"
}

# --------------------------------------------------
# 4. JOB QUEUE (DISK-BASED)
# --------------------------------------------------
QUEUE_FILE=".job_queue.log"
> "$QUEUE_FILE"

enqueue () {
  echo "$1" >> "$QUEUE_FILE"
}

dequeue () {
  head -n 1 "$QUEUE_FILE"
  # FIX 4: Use mktemp instead of the hardcoded "tmp" literal.
  # "tmp" resolves to $ROOT/tmp — dirtying the monorepo root on every call.
  # mktemp writes to /tmp and is invisible to git.
  local tmpfile
  tmpfile="$(mktemp)"
  tail -n +2 "$QUEUE_FILE" > "$tmpfile" && mv "$tmpfile" "$QUEUE_FILE"
}

# --------------------------------------------------
# 5. PLUGINS (EXECUTION UNITS)
# --------------------------------------------------

plugin_api () {
  mkdir -p lib/api-spec apps/api-server/src/middlewares
  cp "$STAGE/openapi.yaml"  lib/api-spec/openapi.yaml
  cp "$STAGE/auth.ts"       apps/api-server/src/middlewares/auth.ts
  cp "$STAGE/app.ts"        apps/api-server/src/app.ts

  # FIX 1: Run the code generator immediately after openapi.yaml is updated.
  # WIRE.txt §API contract discipline step 2: "Run the code generator to update
  # lib/api-zod and lib/api-client-react." WIRE.txt explicit rule: "Never write
  # a Zod schema or React Query hook by hand for an API endpoint. If the generator
  # is not run, the contract will drift."
  # ARCHITECTURE.md: lib/api-spec is the single source of truth; everything
  # downstream (Zod validators, React Query hooks) is generated from it.
  echo "→ Running code generator (lib/api-zod + lib/api-client-react)..."
  pnpm --filter @workspace/api-spec generate
}

plugin_routes () {
  mkdir -p apps/api-server/src/routes
  cp "$STAGE/routes-index.ts" apps/api-server/src/routes/index.ts
}

plugin_db () {
  mkdir -p lib/db/src/schema
  cp "$STAGE/db-schema.ts" lib/db/src/schema/index.ts

  # GAP FIX: Generate a migration file after every schema write.
  # WIRE.txt §Database migration discipline: "Before any production change:
  # pnpm --filter @workspace/db generate". Verification checklist:
  # [ ] Schema changes have a generated migration file committed.
  # [ ] push was not used in production.
  #
  # Without this, lib/db/src/schema/index.ts and the drizzle migration
  # history diverge silently. pnpm typecheck passes (TS has no knowledge of
  # migration state), so this gap is invisible to every other check.
  #
  # Package name confirmed from live lib/db/package.json: @workspace/db
  # lib/db/src/index.ts: export * from "./schema" — the copy target is correct.
  echo "→ Generating DB migration (pnpm --filter @workspace/db generate)..."
  pnpm --filter @workspace/db generate
}

plugin_ui () {
  mkdir -p apps/r3-agi/src
  cp "$STAGE/main.tsx" apps/r3-agi/src/main.tsx
}

plugin_ci () {
  mkdir -p .github/workflows
  cp "$STAGE/ci.yml" .github/workflows/ci.yml
}

# register plugins (registry cleared above — no duplicates)
register_plugin "api"
register_plugin "routes"
register_plugin "db"
register_plugin "ui"
register_plugin "ci"

# --------------------------------------------------
# 6. JOB GENERATION (PLANNER → QUEUE)
# --------------------------------------------------
echo ""
echo "=============================="
echo "🧭 JOB PLANNER"
echo "=============================="

enqueue "api"
enqueue "routes"
enqueue "db"
enqueue "ui"
enqueue "ci"

echo "→ Jobs queued"

# --------------------------------------------------
# 7. WORKER POOL
# --------------------------------------------------
# FIX 8: WORKERS is retained but clarified. Sequential worker_loop calls mean
# the first loop drains the queue; subsequent loops are no-ops. True parallel
# workers would require backgrounding (&) and an atomic dequeue (file locking).
# That is deferred — parallelism is not safe with the current cp-based plugins
# (mkdir -p races). Sequential execution is correct and intentional here.
WORKERS=1  # Was: 2 — changed to reflect actual behaviour; no false parallelism

run_job () {
  local JOB=$1
  echo "→ EXECUTING JOB: $JOB"

  case "$JOB" in
    api)    plugin_api    ;;
    routes) plugin_routes ;;
    db)     plugin_db     ;;
    ui)     plugin_ui     ;;
    ci)     plugin_ci     ;;
    *)      echo "❌ Unknown job: $JOB"; exit 1 ;;
  esac
}

worker_loop () {
  while [ -s "$QUEUE_FILE" ]; do
    local JOB
    JOB=$(dequeue)
    [ -z "$JOB" ] && continue
    run_job "$JOB"
  done
}

echo ""
echo "=============================="
echo "⚙️  WORKER POOL START"
echo "=============================="

for i in $(seq 1 $WORKERS); do
  worker_loop
done

# --------------------------------------------------
# 8. TYPECHECK  (WIRE.txt §After Every Write — mandatory)
# --------------------------------------------------
# FIX 2: WIRE.txt §After Every Write rule 1: "Run pnpm typecheck — must be zero
# errors across all packages." §Protocol Violations: "Claiming a fix is complete
# without running pnpm typecheck" is an explicit violation.
# Five TypeScript files were written across four packages (api-server, r3-agi,
# lib/db, lib/api-spec). The generated files from step FIX 1 must also typecheck.
# Run from workspace root to cover all 9 workspace projects.
echo ""
echo "=============================="
echo "🔷 TYPECHECK (workspace root)"
echo "=============================="

pnpm typecheck

echo "✔ pnpm typecheck → 0 errors"

# --------------------------------------------------
# 9. HEALTH VERIFIER
# --------------------------------------------------
echo ""
echo "=============================="
echo "🔍 SYSTEM VERIFICATION"
echo "=============================="

# FIX 6: Verify all plugin outputs — was missing routes, db, ci, and auth.
# Original array checked 3 of the 8 files written by the 5 plugins.
# A failed plugin_routes, plugin_db, or plugin_ci would pass the old check.
FILES=(
  "lib/api-spec/openapi.yaml"
  "apps/api-server/src/middlewares/auth.ts"
  "apps/api-server/src/app.ts"
  "apps/api-server/src/routes/index.ts"
  "lib/db/src/schema/index.ts"
  "apps/r3-agi/src/main.tsx"
  ".github/workflows/ci.yml"
)

VERIFY_OK=true

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ Missing: $f"
    VERIFY_OK=false
  else
    echo "✔ Present: $f"
  fi
done

if [ "$VERIFY_OK" = false ]; then
  # Disable ERR trap — we are handling this explicitly.
  trap - ERR
  rollback "health verification failed — one or more output files missing"
  exit 1
fi

echo "✔ SYSTEM HEALTH OK"

# All checks passed — disable ERR trap, clean run.
trap - ERR

# --------------------------------------------------
# 10. DISTRIBUTED REPORT
# --------------------------------------------------
echo ""
echo "=============================="
echo "📊 KERNEL REPORT"
echo "=============================="

cat > distributed-kernel-report.json <<EOF
{
  "status": "success",
  "mode": "distributed-plugin-execution-kernel-v1",
  "workers": $WORKERS,
  "stage": "$STAGE",
  "snapshot": "$SNAPSHOT_ID",
  "typecheckPassed": true,
  "generatorRun": true,
  "filesVerified": ${#FILES[@]},
  "timestamp": "$(date -Iseconds)"
}
EOF

echo "=================================================="
echo "✅ DISTRIBUTED KERNEL COMPLETE"
echo "📄 Report: distributed-kernel-report.json"
echo "📦 Snapshot: $SNAPSHOT_PATH"
echo "=================================================="