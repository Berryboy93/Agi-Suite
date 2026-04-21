#!/usr/bin/env bash
# =============================================================================
# apply-doc-patches.sh  v1.1.0
# Agi-Suite documentation defect remediation
#
# Applies: D-1 (new file), D-2, D-3, D-4a/b/c, D-5, D-6, O-1, O-2
# Source:  agi-content.md audit + triple-check pass (2026-04-18)
#
# Usage:
#   ./apply-doc-patches.sh [OPTIONS]
#
# Options:
#   --docs-dir PATH   Path to Agi-Suite docs/ directory  [default: ./docs]
#   --dry-run         Validate every patch without writing any file
#   --rollback        Restore all target files from most recent backup
#   --verbose         Print old/new content on FAIL
#   --help            Print this help
#
# Exit codes:
#   0  All patches applied or already present (clean run)
#   1  One or more patches FAILED
#   2  Pre-flight error (missing dependency or file)
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

SCRIPT_VERSION="1.1.0"
SCRIPT_NAME="$(basename "$0")"

# ---------------------------------------------------------------------------
# Argument defaults
# ---------------------------------------------------------------------------
DRY_RUN=false
VERBOSE=false
ROLLBACK=false
DOCS_DIR="$(pwd)/docs"

# ---------------------------------------------------------------------------
# Colors — suppressed when stdout is not a terminal
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RED='\033[0;31m' C_GRN='\033[0;32m' C_YLW='\033[1;33m'
  C_BLU='\033[0;34m' C_CYN='\033[0;36m' C_BLD='\033[1m' C_RST='\033[0m'
  C_DIM='\033[2m'
else
  C_RED='' C_GRN='' C_YLW='' C_BLU='' C_CYN='' C_BLD='' C_RST='' C_DIM=''
fi

# ---------------------------------------------------------------------------
# Counters (avoid set -e issues with arithmetic on zero)
# ---------------------------------------------------------------------------
CNT_PASS=0; CNT_SKIP=0; CNT_FAIL=0; CNT_DRY=0

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
header()    { echo; echo -e "${C_BLD}── $* ──${C_RST}"; }
log_info()  { echo -e "   ${C_BLU}→${C_RST} $*"; }
log_pass()  { echo -e "   ${C_GRN}✔ PASS${C_RST}  ${C_BLD}[$1]${C_RST} $2"; CNT_PASS=$((CNT_PASS + 1)); }
log_skip()  { echo -e "   ${C_CYN}⊘ SKIP${C_RST}  ${C_BLD}[$1]${C_RST} $2 ${C_DIM}— $3${C_RST}"; CNT_SKIP=$((CNT_SKIP + 1)); }
log_fail()  { echo -e "   ${C_RED}✘ FAIL${C_RST}  ${C_BLD}[$1]${C_RST} $2 ${C_DIM}— $3${C_RST}"; CNT_FAIL=$((CNT_FAIL + 1)); }
log_dry()   { echo -e "   ${C_YLW}○ DRY${C_RST}   ${C_BLD}[$1]${C_RST} $2 ${C_DIM}(would modify)${C_RST}"; CNT_DRY=$((CNT_DRY + 1)); }
log_drynop(){ echo -e "   ${C_YLW}○ DRY${C_RST}   ${C_BLD}[$1]${C_RST} $2 ${C_DIM}(already applied — no-op)${C_RST}"; CNT_SKIP=$((CNT_SKIP + 1)); }
die()       { echo -e "\n${C_RED}FATAL: $*${C_RST}" >&2; exit 2; }

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
${C_BLD}${SCRIPT_NAME}${C_RST} v${SCRIPT_VERSION}

Applies all Agi-Suite documentation defect fixes (D-1..D-6, O-1, O-2).
Idempotent: safe to run multiple times. Creates timestamped backups before
any write operation.

${C_BLD}Usage:${C_RST}
  $SCRIPT_NAME [OPTIONS]

${C_BLD}Options:${C_RST}
  --docs-dir PATH   Path to docs/ directory  [default: ./docs]
  --dry-run         Validate without writing any file
  --rollback        Restore files from most recent backup then exit
  --verbose         Print old/new content on FAIL
  --help            Print this help

${C_BLD}Patches applied:${C_RST}
  D-1   docs/DEPLOYMENT.md        New file (Railway deployment guide)
  D-2   docs/PRD.md               Mark v2.0 as SUPERSEDED
  D-3   docs/PRD.md               Replace draft stub in §12
  D-4a  docs/ROADMAP.md           Description: metrics → metrics_kv
  D-4b  docs/ROADMAP.md           Schema definition: metrics → metricsKv/metrics_kv
  D-4c  docs/ROADMAP.md           Runtime code: metrics → metricsKv
  D-5   docs/DEVELOPMENT.md       Fix misleading git hooks comment
  D-6   docs/ARCHITECTURE.md      Add api-client-react current-state callout
  O-1   docs/DEVELOPMENT.md       Fix cd path after git clone
  O-2   README.md (repo root)     Update DEPLOYMENT.md description

${C_BLD}Exit codes:${C_RST}
  0  All patches applied or already present
  1  One or more patches FAILED
  2  Pre-flight / fatal error
EOF
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --docs-dir) DOCS_DIR="${2:?'--docs-dir requires a PATH argument'}"; shift 2 ;;
    --dry-run)  DRY_RUN=true;  shift ;;
    --verbose)  VERBOSE=true;  shift ;;
    --rollback) ROLLBACK=true; shift ;;
    --help|-h)  usage; exit 0 ;;
    *) die "Unknown argument: '$1'  (run with --help)" ;;
  esac
done

DOCS_DIR="${DOCS_DIR%/}"          # strip trailing slash
REPO_ROOT="$(dirname "$DOCS_DIR")"

# ---------------------------------------------------------------------------
# File paths
# ---------------------------------------------------------------------------
F_PRD="$DOCS_DIR/PRD.md"
F_ROADMAP="$DOCS_DIR/ROADMAP.md"
F_DEV="$DOCS_DIR/DEVELOPMENT.md"
F_ARCH="$DOCS_DIR/ARCHITECTURE.md"
F_README="$REPO_ROOT/README.md"
F_DEPLOY="$DOCS_DIR/DEPLOYMENT.md"

declare -a TARGET_FILES=("$F_PRD" "$F_ROADMAP" "$F_DEV" "$F_ARCH" "$F_README")

# ---------------------------------------------------------------------------
# Backup directory (stable path per day so --rollback finds the right one)
# ---------------------------------------------------------------------------
BACKUP_TS="$(date '+%Y%m%d_%H%M%S')"
BACKUP_BASE="${TMPDIR:-/tmp}/agi-doc-patches"
BACKUP_DIR="${BACKUP_BASE}/${BACKUP_TS}"

# ---------------------------------------------------------------------------
# Rollback: restore from most recent backup session
# ---------------------------------------------------------------------------
do_rollback() {
  header "Rollback"
  if [[ ! -d "$BACKUP_BASE" ]]; then
    die "No backup directory found at $BACKUP_BASE — nothing to roll back"
  fi

  # Find most recent timestamped backup dir
  local latest
  latest="$(ls -1dt "${BACKUP_BASE}"/2* 2>/dev/null | head -1)"
  [[ -n "$latest" ]] || die "No backup sessions found under $BACKUP_BASE"

  log_info "Restoring from: $latest"

  local restored=0
  while IFS= read -r -d '' bak; do
    local fname
    fname="$(basename "$bak")"
    # Find the matching target file by name
    local target=""
    for t in "${TARGET_FILES[@]}"; do
      if [[ "$(basename "$t")" == "$fname" ]]; then
        target="$t"
        break
      fi
    done
    # Also check DEPLOYMENT.md
    if [[ "$fname" == "DEPLOYMENT.md" ]]; then
      target="$F_DEPLOY"
    fi

    if [[ -n "$target" ]]; then
      cp "$bak" "$target"
      log_info "Restored: $target"
      restored=$((restored + 1))
    fi
  done < <(find "$latest" -maxdepth 1 -type f -print0)

  echo
  echo -e "${C_GRN}Rollback complete — restored ${restored} file(s)${C_RST}"
  exit 0
}

[[ "$ROLLBACK" == true ]] && do_rollback

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
header "Pre-flight"

command -v python3 &>/dev/null || die "python3 is required but not found in PATH"
[[ -d "$DOCS_DIR" ]]           || die "docs/ directory not found: $DOCS_DIR"
[[ -d "$REPO_ROOT" ]]          || die "repo root not found: $REPO_ROOT"

log_info "docs dir  : $DOCS_DIR"
log_info "repo root : $REPO_ROOT"
log_info "dry run   : $DRY_RUN"
log_info "python3   : $(python3 --version 2>&1)"

PREFLIGHT_OK=true
for f in "${TARGET_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    log_info "found     : $f"
  else
    echo -e "   ${C_RED}✘ MISSING${C_RST} $f"
    PREFLIGHT_OK=false
  fi
done

[[ "$PREFLIGHT_OK" == true ]] || die "Pre-flight failed — resolve missing files before re-running"

# ---------------------------------------------------------------------------
# Backup (skip in dry-run)
# ---------------------------------------------------------------------------
if [[ "$DRY_RUN" != true ]]; then
  mkdir -p "$BACKUP_DIR"
  for f in "${TARGET_FILES[@]}"; do
    cp "$f" "$BACKUP_DIR/$(basename "$f")"
  done
  # Also back up DEPLOYMENT.md if it already exists
  [[ -f "$F_DEPLOY" ]] && cp "$F_DEPLOY" "$BACKUP_DIR/DEPLOYMENT.md"
  log_info "backups   : $BACKUP_DIR"
  log_info "           (restore with: $SCRIPT_NAME --docs-dir $DOCS_DIR --rollback)"
fi

# ---------------------------------------------------------------------------
# Python patcher (embedded, called per-patch via temp files)
#
# Invoked as:
#   python3 "$PATCHER" FILE OLD_FILE NEW_FILE
#
# Exit codes from patcher:
#   0   success
#   2   old string not found (exact or whitespace-normalized)
#   3   old string is ambiguous (multiple matches)
# ---------------------------------------------------------------------------
PATCHER="$(mktemp /tmp/agi-patcher-XXXXXX.py)"
trap 'rm -f "$PATCHER"' EXIT

cat > "$PATCHER" << 'PYEOF'
#!/usr/bin/env python3
"""
Atomic string-replacement patcher for Agi-Suite doc patches.

Tries exact match first. Falls back to trailing-whitespace-normalized match
to handle Markdown hard-break lines (trailing double-space) that may have
been stripped by editors or git hooks.
"""
import sys, os, shutil, tempfile

def rstrip_lines(s):
    """Strip trailing whitespace from every line, preserving newline structure."""
    return '\n'.join(line.rstrip() for line in s.split('\n'))

def main():
    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} FILE OLD_FILE NEW_FILE", file=sys.stderr)
        sys.exit(1)

    file_path, old_path, new_path = sys.argv[1], sys.argv[2], sys.argv[3]

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    with open(old_path, 'r', encoding='utf-8') as f:
        old_str = f.read()
    with open(new_path, 'r', encoding='utf-8') as f:
        new_str = f.read()

    # Pass 1: exact match
    count = content.count(old_str)

    if count == 0:
        # Pass 2: trailing-whitespace-normalized match
        c_norm = rstrip_lines(content)
        o_norm = rstrip_lines(old_str)
        n_norm = rstrip_lines(new_str)
        count_norm = c_norm.count(o_norm)
        if count_norm == 0:
            sys.exit(2)   # not found — old string absent in file
        if count_norm > 1:
            sys.exit(3)   # ambiguous — multiple matches
        new_content = c_norm.replace(o_norm, n_norm, 1)
    elif count > 1:
        sys.exit(3)       # ambiguous — multiple matches
    else:
        new_content = content.replace(old_str, new_str, 1)

    # Atomic write: temp file in same directory then rename
    abs_path = os.path.abspath(file_path)
    dir_name = os.path.dirname(abs_path)
    with tempfile.NamedTemporaryFile(
        mode='w', encoding='utf-8',
        dir=dir_name, delete=False, suffix='.patch_tmp'
    ) as tmp:
        tmp.write(new_content)
        tmp_name = tmp.name

    shutil.move(tmp_name, abs_path)
    sys.exit(0)

if __name__ == '__main__':
    main()
PYEOF

# ---------------------------------------------------------------------------
# run_patch ID FILE OLD_VARNAME NEW_VARNAME VERIFY_TOKEN
#
# VERIFY_TOKEN: a unique string present in NEW_STR (not in OLD_STR).
#               Used for idempotency check (skip if already applied)
#               and post-write verification.
# ---------------------------------------------------------------------------
run_patch() {
  local id="$1"
  local file="$2"
  local -n _OLD="$3"   # nameref — requires bash 4.3+
  local -n _NEW="$4"   # nameref
  local verify="$5"
  local rel_file
  rel_file="$(basename "$file")"

  # Idempotency: if verify token is already in file, patch is already applied
  if grep -qF -- "$verify" "$file" 2>/dev/null; then
    log_skip "$id" "$rel_file" "already applied"
    return 0
  fi

  # Write old/new to temp files (safe for arbitrary content including backticks, quotes)
  local tmp_old tmp_new
  tmp_old="$(mktemp /tmp/agi-patch-old-XXXXXX)"
  tmp_new="$(mktemp /tmp/agi-patch-new-XXXXXX)"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp_old' '$tmp_new' '$PATCHER'" EXIT
  printf '%s' "$_OLD" > "$tmp_old"
  printf '%s' "$_NEW" > "$tmp_new"

  if [[ "$DRY_RUN" == true ]]; then
    # In dry-run: just confirm old string is findable
    local dry_rc=0
    python3 - "$file" "$tmp_old" <<'PYCHECK' || dry_rc=$?
import sys
def rstrip_lines(s): return '\n'.join(l.rstrip() for l in s.split('\n'))
with open(sys.argv[1], 'r', encoding='utf-8') as f: c = f.read()
with open(sys.argv[2], 'r', encoding='utf-8') as f: o = f.read()
found = o in c or rstrip_lines(o) in rstrip_lines(c)
sys.exit(0 if found else 2)
PYCHECK
    rm -f "$tmp_old" "$tmp_new"
    if [[ "$dry_rc" -eq 0 ]]; then
      log_dry "$id" "$rel_file"
    else
      log_fail "$id" "$rel_file" "old string not found — patch cannot be applied"
      if [[ "$VERBOSE" == true ]]; then
        echo -e "   ${C_DIM}OLD expected:${C_RST}"
        echo "$_OLD" | head -5 | sed 's/^/     /'
      fi
    fi
    return 0
  fi

  # Apply patch
  local rc=0
  python3 "$PATCHER" "$file" "$tmp_old" "$tmp_new" || rc=$?
  rm -f "$tmp_old" "$tmp_new"

  case "$rc" in
    0) ;;  # continue to verify
    2) log_fail "$id" "$rel_file" "old string not found in file (may have changed)"; return 0 ;;
    3) log_fail "$id" "$rel_file" "old string is ambiguous — multiple matches"; return 0 ;;
    *) log_fail "$id" "$rel_file" "patcher exited with unexpected code $rc"; return 0 ;;
  esac

  # Post-write verification: confirm new content is present
  if grep -qF -- "$verify" "$file" 2>/dev/null; then
    log_pass "$id" "$rel_file"
  else
    log_fail "$id" "$rel_file" "verify token absent after write — inspect file manually"
  fi
}

# =============================================================================
# D-1 — Create docs/DEPLOYMENT.md (new file)
# =============================================================================
header "D-1  docs/DEPLOYMENT.md (new file)"

apply_deployment_md() {
  if [[ -f "$F_DEPLOY" ]] && grep -q "apply-doc-patches" "$F_DEPLOY" 2>/dev/null; then
    # generated by this script — already present
    log_skip "D-1" "DEPLOYMENT.md" "file already exists (generated by this script)"
    return 0
  fi
  if [[ -f "$F_DEPLOY" ]]; then
    log_skip "D-1" "DEPLOYMENT.md" "file already exists (not overwriting)"
    return 0
  fi
  if [[ "$DRY_RUN" == true ]]; then
    log_dry "D-1" "DEPLOYMENT.md"
    return 0
  fi

  cat > "$F_DEPLOY" << 'DEPLOYMENT_EOF'
# Deployment

<!-- generated by apply-doc-patches.sh — do not edit this comment -->

**Target platform:** Railway
**Services:** `api-server` (Node 22) + PostgreSQL (Railway plugin)
**Frontend:** Static build served via Railway or a separate CDN (Vercel/Cloudflare Pages)

---

## Railway project layout

```
Railway project
├── api-server service    ← Node 22, builds from Agi-Suite root
└── PostgreSQL plugin     ← attached, DATABASE_URL injected automatically
```

The frontend (`r3-agi`) is a static Vite build. Options:
- Deploy to Vercel / Cloudflare Pages pointing at `apps/r3-agi/dist/`
- Serve from the api-server via `express.static` (not currently implemented)

---

## Environment variables

Set on the Railway `api-server` service. Never commit these to the repository.

| Variable            | Required | Description                                                   |
| ------------------- | -------- | ------------------------------------------------------------- |
| `PORT`              | No       | Railway injects this automatically. Default `3001` if absent. |
| `ANTHROPIC_API_KEY` | Yes      | `sk-ant-api03-...` from console.anthropic.com                 |
| `DATABASE_URL`      | Yes      | Injected automatically by the Railway PostgreSQL plugin       |
| `NODE_ENV`          | Yes      | Set to `production`                                           |
| `LOG_LEVEL`         | No       | Defaults to `info`. Set to `debug` for incident investigation |

Frontend environment variables (Vite):

> **Current state:** No `VITE_` variables are defined. The frontend uses relative fetch paths
> (`/api/...`) and relies on the same-origin assumption. If the frontend is ever deployed to a
> separate domain (e.g. Vercel), an API base URL variable will be needed — define it at that time.

| Variable          | Status          | Description                                                       |
| ----------------- | --------------- | ----------------------------------------------------------------- |
| `VITE_API_SECRET` | Future (FR-016) | Bearer token for API auth. Not needed until FR-016 is implemented |

---

## Build command

Railway auto-detects pnpm workspaces. Set the following in the Railway service settings
or `railway.toml`:

```toml
# railway.toml (place at Agi-Suite/ workspace root)
[build]
builder = "nixpacks"
buildCommand = "pnpm install --frozen-lockfile && pnpm build"

[deploy]
startCommand = "node apps/api-server/dist/index.mjs"
healthcheckPath = "/api/healthz"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

`pnpm build` runs typecheck across all packages then produces the esbuild bundle at
`apps/api-server/dist/index.mjs`.

---

## Database setup

On first deploy, run migrations via Railway's shell or a one-off command:

```bash
# In Railway shell or via `railway run`
pnpm --filter @workspace/db migrate
```

Never use `pnpm --filter @workspace/db push` in production. `push` bypasses migration history.

### Schema seed (metrics_kv)

> **Prerequisite:** This step only applies after FR-021 is implemented and the `metrics_kv`
> table exists in the schema. Skip on current deployments — the table does not exist yet.

Once FR-021 ships, insert the seed row as part of the migration or run once via Railway shell:

```sql
INSERT INTO metrics_kv (key, value)
VALUES ('totalSubscribers', 147)
ON CONFLICT DO NOTHING;
```

---

## Health check

Railway uses `GET /api/healthz` to determine deploy success. The endpoint returns immediately
with no DB or external calls:

```json
{ "status": "ok" }
```

A deploy is marked healthy once this returns `200`. Configure the timeout to at least 30 seconds
to allow Node startup + DB connection.

---

## First-deploy checklist

- [ ] `ANTHROPIC_API_KEY` set in Railway service variables
- [ ] `NODE_ENV=production` set
- [ ] PostgreSQL plugin attached to the service
- [ ] `DATABASE_URL` visible in service variables (Railway injects automatically)
- [ ] Build command set to `pnpm install --frozen-lockfile && pnpm build`
- [ ] Start command set to `node apps/api-server/dist/index.mjs`
- [ ] Health check path set to `/api/healthz`
- [ ] Migrations applied (`pnpm --filter @workspace/db migrate`)
- [ ] `metrics_kv` seed row inserted *(only after FR-021 is implemented — table does not exist yet)*

---

## Redeployment

Railway redeploys automatically on push to the connected branch. The build sequence is:

1. `pnpm install --frozen-lockfile`
2. `pnpm build` (typecheck → esbuild bundle)
3. Railway health check on `/api/healthz`
4. Traffic switches on healthy response

If the health check fails, Railway holds the previous deployment active.

---

## Logs

Railway streams pino JSON logs in the service dashboard. In production, logs are raw JSON —
pipe through `pino-pretty` locally if needed:

```bash
railway logs | pino-pretty
```

Auth headers (`Authorization`, `Cookie`) are redacted from all log output.

---

## Ephemeral filesystem note

Railway uses an ephemeral filesystem. Do not write persistent state to disk. Specifically:

- `/tmp/r3-metrics.json` (legacy totalSubscribers persistence) **will reset on every deploy**
- FR-021 (metrics_kv in PostgreSQL) resolves this — implement before relying on totalSubscribers accuracy

---

## Rollback

Railway maintains the previous successful deployment. To roll back:

1. Railway dashboard → Deployments tab
2. Select the last successful deployment
3. Click "Redeploy"

For database rollbacks: there is no automated rollback. Drizzle migrations are append-only.
If a migration must be undone, write a compensating migration and deploy it.

---

_Last updated: 2026-04-18_
DEPLOYMENT_EOF

  if [[ -f "$F_DEPLOY" ]] && grep -q "apply-doc-patches" "$F_DEPLOY"; then
    log_pass "D-1" "DEPLOYMENT.md"
  else
    log_fail "D-1" "DEPLOYMENT.md" "file write failed or verify token missing"
  fi
}

apply_deployment_md

# =============================================================================
# D-2 — docs/PRD.md: Mark v2.0 as superseded
# =============================================================================
header "D-2  docs/PRD.md — Mark v2.0 SUPERSEDED"

OLD_D2='**Status:** Active'
NEW_D2='**Status:** ⚠️ SUPERSEDED — canonical spec is now `docs/PRD_v3.md` (2026-04-18)'

run_patch "D-2" "$F_PRD" OLD_D2 NEW_D2 "SUPERSEDED"

# =============================================================================
# D-3 — docs/PRD.md §12: Replace session-note stub
# =============================================================================
header "D-3  docs/PRD.md §12 — Replace draft stub"

OLD_D3='### Current schema (`lib/db/src/schema/index.ts`)

Schema contents not fully visible from current session — confirm against actual file before adding tables.'

NEW_D3='### Current schema (`lib/db/src/schema/index.ts`)

> Read `lib/db/src/schema/index.ts` directly before adding tables. The planned additions
> below must not conflict with existing table names. As of 2026-04-18 the schema was not
> captured in this document — the actual file is the source of truth.
>
> Once FR-021 is implemented, replace this block with a verified schema dump.'

run_patch "D-3" "$F_PRD" OLD_D3 NEW_D3 "source of truth"

# =============================================================================
# D-4a — docs/ROADMAP.md: Description text metrics → metrics_kv
# =============================================================================
header "D-4a docs/ROADMAP.md — Description text"

OLD_D4A='**Implementation:** Add a `metrics` table to `lib/db/src/schema/index.ts` with a single-row config record. Read and write `totalSubscribers` from the DB instead of the filesystem. Use an upsert on write to keep it a single round-trip.'

NEW_D4A='**Implementation:** Add a `metrics_kv` table to `lib/db/src/schema/index.ts` with a single-row config record. Read and write `totalSubscribers` from the DB instead of the filesystem. Use an upsert on write to keep it a single round-trip.'

run_patch "D-4a" "$F_ROADMAP" OLD_D4A NEW_D4A 'metrics_kv` table to `lib/db'

# =============================================================================
# D-4b — docs/ROADMAP.md: Schema definition block
# =============================================================================
header "D-4b docs/ROADMAP.md — Schema definition"

OLD_D4B='export const metrics = pgTable("metrics", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: integer("value").notNull(),
});'

NEW_D4B='// Table name aligned with PRD_v3.md §12
export const metricsKv = pgTable("metrics_kv", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: integer("value").notNull(),
});'

run_patch "D-4b" "$F_ROADMAP" OLD_D4B NEW_D4B "Table name aligned with PRD_v3.md"

# =============================================================================
# D-4c — docs/ROADMAP.md: Runtime query code (from/insert/onConflictDoUpdate)
# =============================================================================
header "D-4c docs/ROADMAP.md — Runtime query code"

OLD_D4C='const row = await db
  .select()
  .from(metrics)
  .where(eq(metrics.key, "totalSubscribers"))
  .limit(1);
let totalSubscribers = row[0]?.value ?? 147;

// Write on increment
await db
  .insert(metrics)
  .values({ key: "totalSubscribers", value: totalSubscribers })
  .onConflictDoUpdate({
    target: metrics.key,
    set: { value: totalSubscribers },
  });'

NEW_D4C='const row = await db
  .select()
  .from(metricsKv)
  .where(eq(metricsKv.key, "totalSubscribers"))
  .limit(1);
let totalSubscribers = row[0]?.value ?? 147;

// Write on increment
await db
  .insert(metricsKv)
  .values({ key: "totalSubscribers", value: totalSubscribers })
  .onConflictDoUpdate({
    target: metricsKv.key,
    set: { value: totalSubscribers },
  });'

run_patch "D-4c" "$F_ROADMAP" OLD_D4C NEW_D4C "from(metricsKv)"

# =============================================================================
# D-5 — docs/DEVELOPMENT.md: Fix misleading git hooks comment
# =============================================================================
header "D-5  docs/DEVELOPMENT.md — Git hooks comment"

OLD_D5='# Install all workspace dependencies
# This also runs the prepare script which installs git hooks
pnpm install

# Approve simple-git-hooks build script (required once after initial install)
pnpm approve-builds
# Select simple-git-hooks when prompted'

NEW_D5='# Install all workspace dependencies
# NOTE: git hooks do NOT install automatically — allowBuilds is false by default.
# Run pnpm approve-builds (next step) before hooks become active.
pnpm install

# Required: approve the simple-git-hooks build script to activate pre-commit / pre-push gates
pnpm approve-builds
# Select simple-git-hooks when prompted'

run_patch "D-5" "$F_DEV" OLD_D5 NEW_D5 "hooks do NOT install automatically"

# =============================================================================
# D-6 — docs/ARCHITECTURE.md: api-client-react current-state callout
# =============================================================================
header "D-6  docs/ARCHITECTURE.md — api-client-react callout"

OLD_D6='### `lib/api-client-react`

Auto-generated React Query hooks and TypeScript types. Used by `r3-agi` for all non-SSE API calls. The custom fetch wrapper in `src/custom-fetch.ts` handles base URL configuration and shared error handling.'

NEW_D6='### `lib/api-client-react`

Auto-generated React Query hooks and TypeScript types. The custom fetch wrapper in
`src/custom-fetch.ts` handles base URL configuration and shared error handling.

> **Current state (2026-04-18):** `r3-agi` does not yet import `@workspace/api-client-react`.
> All API calls use raw `fetch` at the callsite (`AgentSuitePanel`, `RightPanel`, `useMetrics`).
> Wiring the generated hooks is a tracked defect (P0-2). The diagram above reflects the
> **intended** architecture, not the current implementation.'

run_patch "D-6" "$F_ARCH" OLD_D6 NEW_D6 "Wiring the generated hooks is a tracked defect"

# =============================================================================
# O-1 — docs/DEVELOPMENT.md: Fix cd path after git clone
# =============================================================================
header "O-1  docs/DEVELOPMENT.md — cd path after clone"

OLD_O1='git clone https://github.com/Berryboy93/r3v4.git
cd Agi-Suite'

NEW_O1='git clone https://github.com/Berryboy93/r3v4.git
cd r3v4/Agi-Suite'

run_patch "O-1" "$F_DEV" OLD_O1 NEW_O1 "cd r3v4/Agi-Suite"

# =============================================================================
# O-2 — README.md: Update DEPLOYMENT.md table description
# =============================================================================
header "O-2  README.md — DEPLOYMENT.md table description"

OLD_O2='| [Deployment](docs/DEPLOYMENT.md)     | Railway deployment, environment config  |'
NEW_O2='| [Deployment](docs/DEPLOYMENT.md)     | Railway env vars, build command, first-deploy steps |'

run_patch "O-2" "$F_README" OLD_O2 NEW_O2 "first-deploy steps"

# =============================================================================
# Summary
# =============================================================================
header "Summary"

TOTAL=$((CNT_PASS + CNT_SKIP + CNT_FAIL + CNT_DRY))
echo -e "   Patches evaluated : ${C_BLD}${TOTAL}${C_RST}"
echo -e "   ${C_GRN}✔ PASS${C_RST}             : ${CNT_PASS}"
echo -e "   ${C_CYN}⊘ SKIP${C_RST} (idempotent): ${CNT_SKIP}"
echo -e "   ${C_YLW}○ DRY${C_RST}              : ${CNT_DRY}"
echo -e "   ${C_RED}✘ FAIL${C_RST}             : ${CNT_FAIL}"
echo

if [[ "$DRY_RUN" == true ]]; then
  echo -e "   ${C_YLW}Dry-run mode — no files were modified${C_RST}"
elif [[ -d "$BACKUP_DIR" ]]; then
  echo -e "   ${C_DIM}Backups : $BACKUP_DIR${C_RST}"
  echo -e "   ${C_DIM}Rollback: $SCRIPT_NAME --docs-dir $DOCS_DIR --rollback${C_RST}"
fi

echo

if [[ "$CNT_FAIL" -gt 0 ]]; then
  echo -e "   ${C_RED}${C_BLD}Result: FAILED ($CNT_FAIL patch(es) did not apply)${C_RST}"
  echo -e "   ${C_DIM}Run with --verbose for old/new content on failures.${C_RST}"
  exit 1
else
  echo -e "   ${C_GRN}${C_BLD}Result: OK${C_RST}"
  exit 0
fi
