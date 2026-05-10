#!/usr/bin/env bash
# Agi-Suite — tools/disk-governor-core-v2.1.sh
# Monitors Penguin/Crostini disk usage; purges safe caches at thresholds.
# Idempotent. DRYRUN=1 or --dry-run for no-op inspection.
# Usage: bash tools/disk-governor-core-v2.1.sh [--dry-run]

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly LOG_FILE="${REPO_ROOT}/.disk-governor.log"
readonly WARN_PCT=75
readonly PURGE_PCT=85
readonly CRITICAL_PCT=92
readonly KEEP_BACKUPS=5

DRYRUN=0
[[ "${1:-}" == "--dry-run" || "${DRYRUN:-0}" == "1" ]] && DRYRUN=1

ts()   { date '+%Y-%m-%dT%H:%M:%S'; }
log()  { echo "[$(ts)] [INFO]  $*" | tee -a "$LOG_FILE"; }
warn() { echo "[$(ts)] [WARN]  $*" | tee -a "$LOG_FILE" >&2; }
err()  { echo "[$(ts)] [ERROR] $*" | tee -a "$LOG_FILE" >&2; }
die()  { err "$*"; exit 1; }

run() {
  if [[ $DRYRUN -eq 1 ]]; then
    echo "[DRYRUN] would run: $*"
  else
    eval "$@"
  fi
}

disk_pct() { df --output=pcent / | tail -1 | tr -d ' %'; }
dir_mb()   { du -sm "${1}" 2>/dev/null | cut -f1 || echo 0; }

# Safe purge targets — never source, never .git, never node_modules root
declare -a PURGE_DIST=(
  "apps/api-server/dist"
  "apps/r3-agi/dist"
  "lib/db/dist"
  "lib/api-zod/dist"
  "lib/api-client-react/dist"
  "lib/api-spec/dist"
)

purge_dist_all() {
  local freed=0
  for rel in "${PURGE_DIST[@]}"; do
    local abs="${REPO_ROOT}/${rel}"
    if [[ -d "$abs" ]]; then
      local mb
      mb=$(dir_mb "$abs")
      log "  purge $rel (${mb}MB)"
      run "rm -rf '$abs'"
      freed=$((freed + mb))
    fi
  done
  log "  dist purge freed ~${freed}MB"
}

purge_turbo() {
  local p="${REPO_ROOT}/.turbo"
  [[ -d "$p" ]] || { log "  .turbo not present"; return; }
  local mb; mb=$(dir_mb "$p")
  log "  purge .turbo (${mb}MB)"
  run "rm -rf '$p'"
}

purge_backups() {
  local bak="${REPO_ROOT}/.patch-backups"
  [[ -d "$bak" ]] || return 0
  local dirs
  dirs=$(find "$bak" -maxdepth 1 -mindepth 1 -type d | sort)
  local count
  count=$(echo "$dirs" | grep -c . || true)
  if [[ $count -gt $KEEP_BACKUPS ]]; then
    local excess=$(( count - KEEP_BACKUPS ))
    log "  rotating $excess old backup dirs (keeping ${KEEP_BACKUPS})"
    run "echo '$dirs' | head -n $excess | xargs rm -rf"
  fi
}

main() {
  log "=== disk-governor v2.1 START repo=${REPO_ROOT} dryrun=${DRYRUN} ==="

  local pct; pct=$(disk_pct)
  log "Disk: ${pct}% used"

  if [[ $pct -lt $WARN_PCT ]]; then
    log "OK — ${pct}% < ${WARN_PCT}% warn threshold. Nothing to do."
    log "=== disk-governor DONE ==="
    return 0
  fi

  if [[ $pct -ge $CRITICAL_PCT ]]; then
    err "CRITICAL ${pct}% ≥ ${CRITICAL_PCT}% — full purge"
    purge_dist_all
    purge_turbo
    purge_backups
    local after; after=$(disk_pct)
    log "Post-purge: ${after}%"
    [[ $after -ge $CRITICAL_PCT ]] && \
      die "Still at ${after}% after full purge — manual intervention required"
    log "=== disk-governor DONE (recovered to ${after}%) ==="
    return 0
  fi

  if [[ $pct -ge $PURGE_PCT ]]; then
    warn "HIGH ${pct}% ≥ ${PURGE_PCT}% — purging dist + turbo"
    purge_dist_all
    purge_turbo
    purge_backups
    local after; after=$(disk_pct)
    log "Post-purge: ${after}%"
    log "=== disk-governor DONE ==="
    return 0
  fi

  # WARN zone only — log, no purge
  warn "WARN ${pct}% ≥ ${WARN_PCT}% — approaching threshold. Run again at ${PURGE_PCT}%."
  log "=== disk-governor DONE ==="
}

main "$@"
