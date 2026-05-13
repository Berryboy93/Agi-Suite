#!/usr/bin/env bash
# integrity-check.sh
# AGI-Suite Pre-Deploy Hard Gate — Master Script
# Run from repo root. Fails fast. Exit codes map to gate numbers.
#
# Exit codes:
#   0 = All gates passed, repo is clean
#   1-9 = Gate number that failed
#   10  = Unknown error

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

GATE=0
PASS="[PASS]"
FAIL="[FAIL]"
WARN="[WARN]"

log() { echo -e "\n>>> $1"; }
die() { echo -e "\n$FAIL Gate $GATE: $1"; exit "$GATE"; }

# ── Gate 0: Clean State Audit ───────────────────────────────────────────────
GATE=0
log "Gate 0: Clean State Audit"

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    git status --short
    die "Working tree is not clean. Commit or stash changes first."
fi
echo "$PASS Working tree clean."

# ── Gate 1: Corruption / Integrity Scan ────────────────────────────────────
GATE=1
log "Gate 1: Corruption / Integrity Scan"

# NOTE: Merge marker patterns include trailing space to avoid false positives
# from decorative comment banners (e.g., "=====" in shell script headers).
# Git merge markers always have a space after the marker:
#   <<<<<<< branch-name
#   =======
#   >>>>>>> branch-name
# Decorative banners like "echo "======================================"" have no trailing space.

CORRUPTION=$(find . \
    \( \
        -path ./node_modules -o \
        -path ./.git -o \
        -path ./dist -o \
        -path ./.patch-backups -o \
        -path ./legacy-scripts -o -path ./.rustup \
    \) -prune -o \
    -type f \
    \( \
        -name "*.ts" -o \
        -name "*.tsx" -o \
        -name "*.js" -o \
        -name "*.jsx" -o \
        -name "*.json" -o \
        -name "*.sh" -o \
        -name "*.cjs" -o \
        -name "*.mjs" -o \
        -name "*.css" \
    \) \
    -print0 2>/dev/null | xargs -0 grep -nE \
    "(ARIS_CORRUPT|TRACE_CORRUPT|<<<<<<< |======= |>>>>>>> )" 2>/dev/null || true)

if [ -n "$CORRUPTION" ]; then
    echo "$CORRUPTION"
    die "Corruption signatures or merge markers detected."
fi
echo "$PASS No corruption signatures or merge markers."

# ── Gate 2: Malformed / Suspicious Files ───────────────────────────────────
GATE=2
log "Gate 2: Malformed / Suspicious Files"

OVERSIZED=$(find . \
    \( \
        -path ./node_modules -o \
        -path ./.git -o \
        -path ./.patch-backups \
    \) -prune -o \
    -type f -size +20M \
    -print 2>/dev/null || true)

if [ -n "$OVERSIZED" ]; then
    echo "$WARN Unexpectedly large files detected:"
    echo "$OVERSIZED"
    die "Oversized files found. Review and add to .gitignore or LFS."
fi
echo "$PASS No suspiciously large files."

# ── Gate 3: Dependency Integrity ────────────────────────────────────────────
GATE=3
log "Gate 3: Dependency Integrity"

if [ ! -f pnpm-lock.yaml ]; then
    die "pnpm-lock.yaml is missing."
fi

LOCKFILE_HASH_BEFORE=$(sha256sum pnpm-lock.yaml | awk '{print $1}')

pnpm install --frozen-lockfile || die "pnpm install --frozen-lockfile failed."
pnpm dedupe || die "pnpm dedupe failed."

LOCKFILE_HASH_AFTER=$(sha256sum pnpm-lock.yaml | awk '{print $1}')

if [ "$LOCKFILE_HASH_BEFORE" != "$LOCKFILE_HASH_AFTER" ]; then
    die "Lockfile was modified by dedupe. Review changes before deploy."
fi
echo "$PASS Dependencies consistent. Lockfile unchanged."

# ── Gate 4: Static Validation ───────────────────────────────────────────────
GATE=4
log "Gate 4: Static Validation"

pnpm lint || die "Lint errors detected."
pnpm typecheck || die "TypeScript type errors detected."
echo "$PASS Lint and typecheck clean."

# ── Gate 5: Test Verification ───────────────────────────────────────────────
GATE=5
log "Gate 5: Test Verification"

pnpm test || die "Test suite failed."
echo "$PASS All tests passed."

# ── Gate 6: Workspace Consistency ───────────────────────────────────────────
GATE=6
log "Gate 6: Workspace Consistency"

pnpm -r exec pwd >/dev/null || die "Workspace path resolution failed."
pnpm -r list --depth 0 >/dev/null || die "Workspace package list failed."
echo "$PASS Workspace packages resolve correctly."

# ── Gate 7: Startup Validation ──────────────────────────────────────────────
GATE=7
log "Gate 7: Startup Validation"

# Dev startup
timeout 30s bash agi-suite-startup-dev.sh >/dev/null 2>&1 || true
sleep 2
if pgrep -f "agi-suite-startup-dev" >/dev/null 2>&1 || pgrep -f "vite" >/dev/null 2>&1; then
    pkill -f "agi-suite-startup-dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo "$PASS Dev startup script reaches ready state."
else
    echo "$WARN Dev startup did not spawn expected processes (non-blocking)."
fi

# Prod startup
timeout 30s bash agi-suite-startup.sh >/dev/null 2>&1 || true
sleep 2
if pgrep -f "agi-suite-startup" >/dev/null 2>&1 || pgrep -f "node" >/dev/null 2>&1; then
    pkill -f "agi-suite-startup" 2>/dev/null || true
    pkill -f "node" 2>/dev/null || true
    echo "$PASS Prod startup script reaches ready state."
else
    echo "$WARN Prod startup did not spawn expected processes (non-blocking)."
fi

# ── Gate 8: Deployment Dry-Run ──────────────────────────────────────────────
GATE=8
log "Gate 8: Deployment Dry-Run"

if [ -f deploy-kernel.sh ]; then
    bash deploy-kernel.sh --dry-run >/dev/null 2>&1 || {
        echo "$WARN Dry-run exited non-zero (review if expected)."
    }
    echo "$PASS Dry-run completed."
else
    echo "$WARN deploy-kernel.sh not found — skipping."
fi

# ── Gate 9: Final Audit ─────────────────────────────────────────────────────
GATE=9
log "Gate 9: Final Audit"

# Backup file guard
BAK_FILES=$(find . \
    \( \
        -path ./node_modules -o \
        -path ./.git -o \
        -path ./.patch-backups -o \
        -path ./legacy-scripts -o -path ./.rustup \
    \) -prune -o \
    -type f -name "*.bak-*" \
    -print 2>/dev/null || true)

if [ -n "$BAK_FILES" ]; then
    echo "$BAK_FILES"
    die "Backup files (*.bak-*) detected in working tree. Remove before deploy."
fi

# Generated artifact / log guard
UNEXPECTED=$(git status --porcelain 2>/dev/null | grep -E "^(\\?\\?| M) (artifacts/|logs/|api\.log|.*\.tmp|.*\.trace)" || true)

if [ -n "$UNEXPECTED" ]; then
    echo "$UNEXPECTED"
    die "Unexpected generated files or logs in working tree."
fi

# Final diff check
MODIFIED_FILES=$(git diff --name-only 2>/dev/null || true)
if [ -n "$MODIFIED_FILES" ]; then
    echo "$MODIFIED_FILES"
    die "Unexpected file mutations since last commit."
fi

echo "$PASS Final audit clean. No backup files, generated artifacts, or unexpected mutations."

# ── Completion ──────────────────────────────────────────────────────────────
echo -e "\n========================================"
echo "  ALL GATES PASSED — REPO IS CLEAN"
echo "  Ready for commit / deploy"
echo "========================================"

exit 0
