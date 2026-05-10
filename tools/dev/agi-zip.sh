#!/usr/bin/env bash
# agi-zip.sh — Agi-Suite project archive script
# Mirrors r3zip.sh pattern from ~/Stable.
# Excludes: node_modules, dist, build, .env files, archives, secrets, coverage.
# Safe to run from any machine — never includes secrets.
#
# Usage:
#   ./agi-zip.sh          # create archive in ./archives/
#   ./agi-zip.sh --verify # create + verify contents after

set -euo pipefail

VERIFY=false
[[ "${1:-}" == "--verify" ]] && VERIFY=true

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="agi-suite"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_DIR="${PROJECT_ROOT}/archives"
ARCHIVE_NAME="${PROJECT_NAME}_source_${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${ARCHIVE_DIR}/${ARCHIVE_NAME}"

mkdir -p "${ARCHIVE_DIR}"

echo "══════════════════════════════════════════════════════"
echo "  agi-zip.sh — Agi-Suite Archive"
echo "  Output: archives/${ARCHIVE_NAME}"
echo "══════════════════════════════════════════════════════"

# ── Exclude patterns ──────────────────────────────────────────────────────────
EXCLUDES=(
  # dependencies — always reinstallable
  "--exclude=*/node_modules"
  "--exclude=.pnpm-store"
  "--exclude=.pnpm"

  # build outputs
  "--exclude=*/dist"
  "--exclude=*/build"
  "--exclude=*/.next"
  "--exclude=*/.turbo"
  "--exclude=*/out"
  "--exclude=*/.vite"

  # secrets — never archive
  "--exclude=.env"
  "--exclude=.env.local"
  "--exclude=.env.production"
  "--exclude=.env.*.local"
  "--exclude=secrets"

  # archives themselves — prevent inception
  "--exclude=archives"

  # coverage + test artifacts
  "--exclude=*/coverage"
  "--exclude=*/.nyc_output"

  # editor + OS noise
  "--exclude=.DS_Store"
  "--exclude=*.swp"
  "--exclude=*.swo"
  "--exclude=.idea"
  "--exclude=.vscode"

  # logs
  "--exclude=*.log"
  "--exclude=logs"

  # backups from patch scripts
  "--exclude=.r3_neon_backups"
  "--exclude=.r3_theme_backups"
  "--exclude=asi-upgrade-backup-*"

  # git objects (keep .git for ref, comment out to include)
  "--exclude=.git"
)

echo "[INFO] Creating archive …"
tar -czf "${ARCHIVE_PATH}" "${EXCLUDES[@]}" -C "$(dirname "${PROJECT_ROOT}")" \
  "$(basename "${PROJECT_ROOT}")"

SIZE="$(du -sh "${ARCHIVE_PATH}" | cut -f1)"
echo "[  OK] Archive created: ${ARCHIVE_PATH}"
echo "[  OK] Size: ${SIZE}"

# ── Verify ────────────────────────────────────────────────────────────────────
if [[ "${VERIFY}" == true ]]; then
  echo ""
  echo "[INFO] Verifying archive contents …"
  echo ""
  echo "── Top-level structure:"
  tar -tzf "${ARCHIVE_PATH}" | awk -F/ 'NF<=3' | sort -u | head -40
  echo ""
  echo "── Confirming no node_modules leaked:"
  LEAK=$(tar -tzf "${ARCHIVE_PATH}" | grep "node_modules" | wc -l)
  if [[ "${LEAK}" -eq 0 ]]; then
    echo "[  OK] No node_modules in archive ✅"
  else
    echo "[WARN] ${LEAK} node_modules paths found — check excludes"
  fi
  echo ""
  echo "── Confirming no .env files leaked:"
  ENV_LEAK=$(tar -tzf "${ARCHIVE_PATH}" | grep -E "\.env($|\.|\.production|\.local)" | wc -l)
  if [[ "${ENV_LEAK}" -eq 0 ]]; then
    echo "[  OK] No .env files in archive ✅"
  else
    echo "[WARN] .env files found in archive — remove before transferring:"
    tar -tzf "${ARCHIVE_PATH}" | grep -E "\.env"
  fi
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Done. Transfer the archive to the admin PC:"
echo "  ${ARCHIVE_PATH}"
echo ""
echo "  On the target VM, extract with:"
echo "    tar -xzf ${ARCHIVE_NAME}"
echo "    cd agi-suite"
echo "    pnpm install --frozen-lockfile"
echo "    pnpm tsc --noEmit"
echo "══════════════════════════════════════════════════════"
