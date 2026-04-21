#!/usr/bin/env bash
# =============================================================================
# agi-diag.sh  v1.2.0
# Triple-check diagnostic — Agi-Suite ↔ R3 v4 Railway connection
#
# Bugs fixed vs v1.1.0:
#   FIX-7  A1 grep patterns: dropped trailing \) — on("abort", () => {}) was
#           not matched because ) does not immediately follow the closing quote.
#           All three event-handler checks (abort/close/error) false-failed
#           against correctly-implemented code.
#   FIX-8  SSE endpoint: /api/agent → /api/agent/chat
#
# Bugs fixed vs v1.0.0:
#   FIX-1  pgrep: \| → | (ERE alternation, not literal pipe)
#   FIX-2  pgrep | head pipeline: add || true  (pipefail + SIGPIPE)
#   FIX-3  SSE curl | head: accept exit 141 (SIGPIPE) as success
#   FIX-4  require('pg'): set NODE_PATH to lib/db/node_modules
#   FIX-5  ${DB_URL} interpolation: pass via env var, not string concat
#   FIX-6  \x27 in grep: replaced with $'...' bash quoting for POSIX match
#   ADD-1  Node version gate (SKILLS.md #8 — must be v22.x)
#   ADD-2  ANTHROPIC_API_KEY env check (agent route prerequisite)
#   ADD-3  session_metrics table check (Time Savings Tracking feature)
#   ADD-4  drizzle_migrations table check (confirms migrations applied)
#   ADD-5  Railway HTTPS URL: skip port check when no port in URL
#
# Usage:
#   cd ~/Agi-Suite
#   bash agi-diag.sh [--api-url URL] [--db-url URL]
#
# Options:
#   --api-url URL   Override API base URL  [default: http://localhost:3001]
#   --db-url  URL   Override DB URL        [default: $DATABASE_URL]
#
# Exit codes:
#   0  All green or warnings only
#   1  One or more checks FAILED
#   2  Pre-flight error
# =============================================================================
set -euo pipefail

SCRIPT_VERSION="1.2.0"
API_URL="${API_URL:-http://localhost:3001}"
DB_URL="${DB_URL:-${DATABASE_URL:-}}"

# ── colours ──────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m'
  B='\033[0;34m' W='\033[1m' Z='\033[0m'
else
  R='' G='' Y='' B='' W='' Z=''
fi

PASS=0; FAIL=0; WARN=0

ok()   { echo -e "  ${G}✔${Z}  $*"; PASS=$((PASS+1)); }
fail() { echo -e "  ${R}✘${Z}  $*"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${Y}⚠${Z}  $*"; WARN=$((WARN+1)); }
info() { echo -e "  ${B}→${Z}  $*"; }
hdr()  { echo; echo -e "${W}── $* ──${Z}"; }
die()  { echo -e "\n${R}FATAL: $*${Z}" >&2; exit 2; }

# ── arg parse ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    --db-url)  DB_URL="$2";  shift 2 ;;
    --help|-h)
      echo "Usage: bash agi-diag.sh [--api-url URL] [--db-url URL]"
      exit 0 ;;
    *) die "Unknown argument: '$1'" ;;
  esac
done

echo
echo -e "${W}agi-diag.sh${Z} v${SCRIPT_VERSION}"
info "api-url : $API_URL"
info "db-url  : ${DB_URL:+(set — not printed)}"
[[ -z "$DB_URL" ]] && warn "DB_URL not set — Pass 2 DB checks will be skipped"

# =============================================================================
# PRE-FLIGHT — Node version (SKILLS.md #8: must be v22.x)
# =============================================================================
hdr "Pre-flight — Node version"

if ! command -v node &>/dev/null; then
  fail "node not found in PATH"
else
  NODE_VER="$(node --version 2>&1)"
  NODE_MAJOR="${NODE_VER#v}"
  NODE_MAJOR="${NODE_MAJOR%%.*}"
  info "node version: $NODE_VER"
  if [[ "$NODE_MAJOR" -ge 22 ]]; then
    ok "Node ${NODE_VER} — v22+ confirmed"
  elif [[ "$NODE_MAJOR" -eq 18 ]]; then
    fail "Node ${NODE_VER} — v18 detected (Penguin/Termux env?). Results unreliable. Use v22."
  else
    warn "Node ${NODE_VER} — expected v22+. Proceed with caution."
  fi
fi

# =============================================================================
# PASS 1 — Process / port liveness
# =============================================================================
hdr "Pass 1a — api-server process"

# FIX-1: unescaped | for ERE alternation (pgrep uses POSIX ERE on Linux;
#         \| is a literal pipe in ERE, NOT alternation)
PGREP_PAT="dist/index.mjs|tsx.*src/index.ts|api-server"

if pgrep -f "$PGREP_PAT" &>/dev/null; then
  ok "api-server process found"
  # FIX-2: || true — if >3 processes match, head closes the pipe early,
  #         pgrep exits 141 (SIGPIPE), which would kill script under pipefail
  pgrep -af "$PGREP_PAT" 2>/dev/null | head -3 | sed 's/^/          /' || true
else
  fail "No api-server process detected"
fi

hdr "Pass 1b — Port liveness"

# ADD-5: only do port check when URL has an explicit numeric port;
#         HTTPS Railway URLs (no port) would produce empty PORT → broken grep
if [[ "$API_URL" =~ :[0-9]{2,5}(/|$) ]]; then
  API_PORT="${API_URL##*:}"
  API_PORT="${API_PORT%%/*}"
  if command -v ss &>/dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":${API_PORT}"; then
      ok "Port ${API_PORT} is LISTEN"
    else
      fail "Port ${API_PORT} NOT listening"
    fi
  elif command -v lsof &>/dev/null; then
    if lsof -iTCP:"${API_PORT}" -sTCP:LISTEN &>/dev/null; then
      ok "Port ${API_PORT} is LISTEN (via lsof)"
    else
      fail "Port ${API_PORT} NOT listening (via lsof)"
    fi
  else
    warn "Neither ss nor lsof available — port check skipped"
  fi
else
  info "No explicit port in API_URL — port check skipped (HTTPS/Railway URL)"
fi

hdr "Pass 1c — /api/healthz"

HC_BODY="$(curl -sf --max-time 5 "${API_URL}/api/healthz" 2>&1)" && HC_RC=0 || HC_RC=$?
if [[ "$HC_RC" -eq 0 ]]; then
  ok "/api/healthz → 200  body: ${HC_BODY}"
else
  fail "/api/healthz unreachable (curl exit ${HC_RC}) — server not running?"
fi

hdr "Pass 1d — /api/metrics"

MET_BODY="$(curl -sf --max-time 5 "${API_URL}/api/metrics" 2>&1)" && MET_RC=0 || MET_RC=$?
if [[ "$MET_RC" -eq 0 ]]; then
  ok "/api/metrics → 200  body: ${MET_BODY}"
else
  fail "/api/metrics failed (curl exit ${MET_RC})"
fi

# =============================================================================
# PASS 2 — DB connectivity (SKILLS.md #5)
# =============================================================================
hdr "Pass 2 — Railway DB connectivity (SKILLS.md #5)"

if [[ -z "$DB_URL" ]]; then
  warn "DATABASE_URL not set — skipping all DB checks"
  warn "  export DATABASE_URL=\"postgresql://postgres:PASS@ballast.proxy.rlwy.net:PORT/railway\""
elif ! command -v node &>/dev/null; then
  warn "node not found — DB check skipped"
else
  # FIX-4: pg is in lib/db/node_modules, NOT in repo root node_modules.
  #         NODE_PATH lets require('pg') resolve from the correct location.
  # FIX-5: DB_URL is passed via DATABASE_URL env var to node, never
  #         interpolated as a JS string literal (single quotes in password
  #         would cause a JS SyntaxError if interpolated directly).
  DB_NODE_PATH="$(pwd)/lib/db/node_modules:$(pwd)/node_modules"

  NODE_DB_CHECK="$(
    DATABASE_URL="${DB_URL}" NODE_PATH="${DB_NODE_PATH}" node -e "
const {Client} = require('pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
c.connect()
  .then(() => c.query(
    \"SELECT table_name FROM information_schema.tables \" +
    \"WHERE table_schema='public' ORDER BY table_name\"
  ))
  .then(r => {
    const tables = r.rows.map(x => x.table_name);
    console.log('TABLES:' + tables.join(','));
    return c.end();
  })
  .catch(e => { console.error('DB_ERR:' + e.message); process.exit(1); });
" 2>&1
  )" && DB_RC=0 || DB_RC=$?

  if [[ "$DB_RC" -eq 0 ]] && echo "$NODE_DB_CHECK" | grep -q "^TABLES:"; then
    TABLES="$(echo "$NODE_DB_CHECK" | grep "^TABLES:" | sed 's/^TABLES://')"
    ok "PostgreSQL connection OK"
    info "Tables: ${TABLES}"

    # Core tables
    for tbl in users sessions; do
      if echo "$TABLES" | tr ',' '\n' | grep -qx "$tbl"; then
        ok "Table present: ${tbl}"
      else
        fail "Table MISSING: ${tbl}"
      fi
    done

    # ADD-3: session_metrics (Time Savings Tracking)
    if echo "$TABLES" | tr ',' '\n' | grep -qx "session_metrics"; then
      ok "Table present: session_metrics (Time Savings Tracking)"
    else
      warn "session_metrics absent — Time Savings Tracking table not migrated"
    fi

    # metrics_kv (FR-021 — expected absent pre-implementation)
    if echo "$TABLES" | tr ',' '\n' | grep -qx "metrics_kv"; then
      ok "Table present: metrics_kv (FR-021 implemented)"
    else
      warn "metrics_kv absent — FR-021 not yet implemented (expected pre-release)"
    fi

    # ai_decision_log (migration 0005)
    if echo "$TABLES" | tr ',' '\n' | grep -qx "ai_decision_log"; then
      ok "Table present: ai_decision_log (migration 0005 applied)"
    else
      warn "ai_decision_log absent — migration 0005 not applied to Railway"
    fi

    # ADD-4: drizzle migration history table
    if echo "$TABLES" | tr ',' '\n' | grep -qx "__drizzle_migrations"; then
      ok "Table present: __drizzle_migrations (Drizzle migration history)"
    else
      warn "__drizzle_migrations absent — migrations may not have run via drizzle-kit"
    fi

  else
    fail "PostgreSQL connection FAILED"
    echo "$NODE_DB_CHECK" | grep -E "DB_ERR|Error|Cannot" | head -3 | sed 's/^/          /'
  fi
fi

# =============================================================================
# PASS 3 — SSE / agent route + static analysis (SKILLS.md A1, A7)
# =============================================================================
hdr "Pass 3a — /api/agent/chat SSE stream (SKILLS.md A7)"

# FIX-3: curl | head -10 causes SIGPIPE when head closes the pipe after
#         reading 10 lines; curl exits 141. Under pipefail this propagates
#         as SSE_RC=141 even when the stream is working perfectly.
#         The "|| true" on head prevents pipefail from aborting the subshell;
#         we then accept either 0 or 141 as "stream delivered data".
# FIX-8: Correct endpoint. router.post("/agent/chat") mounted under /api
#         by routes/index.ts → full path is /api/agent/chat, not /api/agent.
SSE_OUTPUT="$(
  curl -sf \
    --max-time 8 \
    --no-buffer \
    -H "Accept: text/event-stream" \
    -H "Content-Type: application/json" \
    -X POST "${API_URL}/api/agent/chat" \
    -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":20}' \
    2>&1 | head -10 || true
)" && SSE_RC=0 || SSE_RC=$?

if { [[ "$SSE_RC" -eq 0 ]] || [[ "$SSE_RC" -eq 141 ]]; } && \
   echo "$SSE_OUTPUT" | grep -q "^data:"; then
  ok "/api/agent/chat SSE stream — events received (exit ${SSE_RC})"
  echo "$SSE_OUTPUT" | head -5 | sed 's/^/          /'
elif echo "$SSE_OUTPUT" | grep -qi "unauthorized\|403\|401"; then
  warn "/api/agent/chat returned auth error (expected if auth is enforced)"
  echo "$SSE_OUTPUT" | head -3 | sed 's/^/          /'
elif [[ "$SSE_RC" -ne 0 ]] && [[ "$SSE_RC" -ne 141 ]]; then
  fail "/api/agent/chat unreachable (curl exit ${SSE_RC}) — server running?"
else
  fail "/api/agent/chat responded but no SSE data: lines returned:"
  echo "$SSE_OUTPUT" | head -5 | sed 's/^/          /'
fi

hdr "Pass 3b — A1 abort-pattern static analysis (agent.ts)"

AGENT_FILE="$(find . -path "*/api-server/src/routes/agent.ts" 2>/dev/null | head -1 || true)"
if [[ -z "$AGENT_FILE" ]]; then
  warn "agent.ts not found — run from Agi-Suite root"
else
  info "Checking: $AGENT_FILE"

  # FIX-6: \x27 is NOT a hex escape in standard (non-PCRE) grep.
  #         bash $'...' syntax interprets \x27 → literal ' before grep sees it.
  # FIX-7: Do NOT assert the closing ) after the event name.
  #         The SDK pattern is .on("abort", () => {}) — the ) does not
  #         immediately follow the closing quote. The old pattern
  #         on\(["']abort["']\) only matched on("abort") with no args,
  #         producing 3 false failures against correctly-implemented code.
  Q=$'\x27'   # Q = single-quote character

  if grep -qE "on\([\"${Q}]abort[\"${Q}]" "$AGENT_FILE"; then
    ok "A1 ✔  stream.on(\"abort\") present — crash guard active"
  else
    fail "A1 ✘  stream.on(\"abort\") MISSING — client disconnect WILL crash the process"
    info "  Fix: stream.on(\"abort\", () => {})  — SKILLS.md A1"
  fi

  if grep -qE "on\([\"${Q}]close[\"${Q}]" "$AGENT_FILE"; then
    ok "A1 ✔  req.on(\"close\") cleanup present"
  else
    warn "A1 ⚠  req.on(\"close\") missing — stream may not abort on disconnect"
  fi

  if grep -qE "on\([\"${Q}]error[\"${Q}]" "$AGENT_FILE"; then
    ok "A1 ✔  stream.on(\"error\") handler present"
  else
    fail "A1 ✘  stream.on(\"error\") MISSING — API errors will be unhandled"
  fi

  if grep -q 'APIUserAbortError\|aborted' "$AGENT_FILE"; then
    ok "A1 ✔  APIUserAbortError guard present"
  else
    warn "A1 ⚠  No APIUserAbortError guard — may double-log abort errors"
  fi
fi

hdr "Pass 3c — ANTHROPIC_API_KEY (ADD-2)"

# ADD-2: Verify the key is reachable — check shell env first, then .env file.
#         On Railway the key is in service variables; locally it's in .env.
ENV_FILE="apps/api-server/.env"
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  ok "ANTHROPIC_API_KEY set in shell environment"
elif [[ -f "$ENV_FILE" ]] && grep -q "ANTHROPIC_API_KEY" "$ENV_FILE"; then
  if grep 'ANTHROPIC_API_KEY' "$ENV_FILE" | grep -q 'sk-ant-'; then
    ok "ANTHROPIC_API_KEY in ${ENV_FILE} (sk-ant-... prefix confirmed)"
  else
    warn "ANTHROPIC_API_KEY in ${ENV_FILE} but value looks empty or placeholder"
  fi
else
  warn "ANTHROPIC_API_KEY not found in shell env or ${ENV_FILE}"
  warn "  Railway deploy: set it in service variables"
  warn "  Local run: add to apps/api-server/.env"
fi

hdr "Pass 3d — Frontend fetch pattern check (D-6 architecture)"

for component in AgentSuitePanel RightPanel useMetrics; do
  F="$(find . \( -path "*/r3-agi/src/*/${component}.tsx" \
              -o -path "*/r3-agi/src/*/${component}.ts" \) \
       2>/dev/null | head -1 || true)"

  if [[ -z "$F" ]]; then
    warn "${component}: file not found"
    continue
  fi

  FETCH_COUNT="$(grep -c "fetch(" "$F" 2>/dev/null || true)"
  IMPORT_CLIENT="$(grep -c "api-client-react\|useAgent\|useMetrics.*generated" "$F" 2>/dev/null || true)"

  if [[ "$FETCH_COUNT" -gt 0 ]] && [[ "$IMPORT_CLIENT" -eq 0 ]]; then
    warn "${component}: ${FETCH_COUNT} raw fetch() call(s) — @workspace/api-client-react not wired (D-6 / P0-2 known defect)"
  elif [[ "$IMPORT_CLIENT" -gt 0 ]]; then
    ok "${component}: uses generated client hooks (P0-2 resolved)"
  else
    info "${component}: no fetch or generated-client calls detected"
  fi
done

# =============================================================================
# Summary
# =============================================================================
hdr "Summary"

TOTAL=$((PASS+FAIL+WARN))
echo -e "  Checks run : ${W}${TOTAL}${Z}"
echo -e "  ${G}✔ PASS${Z}     : ${PASS}"
echo -e "  ${Y}⚠ WARN${Z}     : ${WARN}"
echo -e "  ${R}✘ FAIL${Z}     : ${FAIL}"
echo

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "  ${R}${W}Result: DEGRADED — ${FAIL} check(s) failed${Z}"
  exit 1
elif [[ "$WARN" -gt 0 ]]; then
  echo -e "  ${Y}${W}Result: PARTIAL — server live, known gaps present${Z}"
  exit 0
else
  echo -e "  ${G}${W}Result: ALL GREEN${Z}"
  exit 0
fi