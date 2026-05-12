#!/usr/bin/env bash
#==============================================================================
# Agi-Suite — Full Stack Master Script v11
# Rock-solid: portable grep, no \b, no -P, fixed ((var++)) set -e trap
#==============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── Configuration ────────────────────────────────────────────────────────────
REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/Agi-Suite")}"
API_DIR="$REPO_ROOT/apps/api-server"
FE_DIR="$REPO_ROOT/apps/r3-agi"
DB_DIR="$REPO_ROOT/lib/db"
PID_FILE="/tmp/agi-api-server.pid"
FE_PID_FILE="/tmp/agi-frontend.pid"
API_PORT="${API_PORT:-3001}"
FE_PORT="${FE_PORT:-5176}"
DB_PORT="${DB_PORT:-5432}"

API_HEALTH="http://localhost:$API_PORT/health"
FE_URL="http://localhost:$FE_PORT"

# Load API .env for DB commands
if [[ -f "$API_DIR/.env" ]]; then
  set -a
  source "$API_DIR/.env"
  set +a
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_db()    { echo -e "${CYAN}[DB]${NC}   $1"; }

die() { log_error "$1"; exit 1; }

backup_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local backup="${file}.bak-$(date +%Y%m%d_%H%M%S)"
    cp "$file" "$backup"
    log_warn "Backed up: $file → $(basename "$backup")"
  fi
}

# ── Port / Process Utilities (Portable — No \b, No -P) ─────────────────────
get_port_pids() {
  local port="$1"
  ss -tlnp 2>/dev/null | awk -v p=":$port " '$4 ~ p {print}' |     sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u | tr '\n' ' '
}

port_is_free() {
  [[ -z "$(get_port_pids "$1")" ]]
}

kill_port_processes() {
  local port="$1" label="${2:-process}"
  log_info "Cleaning up $label on port $port..."

  local pids
  pids=$(get_port_pids "$port")

  for pid in $pids; do
    [[ -n "$pid" ]] || continue
    log_warn "SIGTERM $label (PID: $pid)"
    kill -15 "$pid" 2>/dev/null || true
  done

  sleep 1

  pids=$(get_port_pids "$port")
  for pid in $pids; do
    [[ -n "$pid" ]] || continue
    log_warn "SIGKILL survivor (PID: $pid)"
    kill -9 "$pid" 2>/dev/null || true
  done

  local attempts=0
  while ! port_is_free "$port" && [[ $attempts -lt 20 ]]; do
    sleep 0.5
    attempts=$((attempts + 1))
  done

  if ! port_is_free "$port"; then
    die "Port $port still in use"
  fi

  log_ok "Port $port is free"
}

get_api_pid() {
  ss -tlnp 2>/dev/null | awk -v p=":$API_PORT " '$4 ~ p {print}' |     sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1
}

# ── Validation ─────────────────────────────────────────────────────────────
validate_environment() {
  log_info "Validating environment..."
  [[ -d "$API_DIR" ]] || die "api-server not found: $API_DIR"
  [[ -d "$FE_DIR" ]] || die "frontend not found: $FE_DIR"
  [[ -f "$API_DIR/package.json" ]] || die "api-server package.json missing"
  [[ -f "$FE_DIR/package.json" ]] || die "frontend package.json missing"

  local node_version
  node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  [[ "$node_version" -ge 18 ]] || die "Node.js 18+ required"
  command -v pnpm &>/dev/null || die "pnpm not found"

  log_ok "Environment valid"
}

# ── Database URL Parsing (Pure Bash) ───────────────────────────────────────
parse_db_url() {
  local url="${DATABASE_URL:-}"

  DB_USER=""
  DB_PASS=""
  DB_HOST="localhost"
  DB_NAME=""
  local extracted_port=""

  if [[ -z "$url" ]]; then
    return 1
  fi

  local rest="${url#postgresql://}"
  rest="${rest#postgres://}"

  if [[ "$rest" == *"@"* ]]; then
    local creds="${rest%%@*}"
    local hostpart="${rest#*@}"

    if [[ "$creds" == *":"* ]]; then
      DB_USER="${creds%%:*}"
      DB_PASS="${creds#*:}"
    else
      DB_USER="$creds"
      DB_PASS=""
    fi

    if [[ "$hostpart" == *"/"* ]]; then
      local host_port="${hostpart%%/*}"
      DB_NAME="${hostpart#*/}"
      DB_NAME="${DB_NAME%%\?*}"
    else
      local host_port="$hostpart"
      DB_NAME=""
    fi

    if [[ "$host_port" == *":"* ]]; then
      DB_HOST="${host_port%%:*}"
      extracted_port="${host_port#*:}"
    else
      DB_HOST="$host_port"
      extracted_port=""
    fi
  fi

  if [[ -n "$extracted_port" ]] && [[ "$extracted_port" =~ ^[0-9]+$ ]]; then
    DB_PORT="$extracted_port"
  fi

  log_db "Parsed URL: user='$DB_USER' host='$DB_HOST' port='$DB_PORT' db='$DB_NAME'"
}

# ── Postgres Superuser Helper ──────────────────────────────────────────────
run_as_postgres() {
  local cmd="$1"
  local output

  if output=$(sudo -u postgres psql -c "$cmd" 2>&1); then
    echo "$output"
    return 0
  fi

  if output=$(sudo psql "postgresql://postgres@localhost:$DB_PORT/postgres" -c "$cmd" 2>&1); then
    echo "$output"
    return 0
  fi

  if output=$(psql "postgresql://postgres@localhost:$DB_PORT/postgres" -c "$cmd" 2>&1); then
    echo "$output"
    return 0
  fi

  return 1
}

# ── Database ───────────────────────────────────────────────────────────────
check_db_server() {
  log_db "Checking Postgres server on port $DB_PORT..."

  if command -v pg_isready &>/dev/null; then
    if pg_isready -h localhost -p "$DB_PORT" &>/dev/null; then
      log_ok "Postgres server accepting connections"
      return 0
    fi
  fi

  log_warn "Postgres server not reachable"
  return 1
}

check_db_connection() {
  log_db "Testing database connection..."

  if [[ -z "${DATABASE_URL:-}" ]]; then
    log_warn "DATABASE_URL not set"
    return 1
  fi

  parse_db_url

  if command -v psql &>/dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1 as connection_test;" 2>/dev/null | grep -q "connection_test"; then
      log_ok "Database connection successful"
      return 0
    else
      log_warn "Connection failed for user '$DB_USER' to database '$DB_NAME'"
      return 1
    fi
  fi

  log_warn "psql not installed"
  return 1
}

db_provision() {
  log_db "Provisioning database..."

  if ! check_db_server; then
    die "Postgres server is not running. Start with: sudo systemctl start postgresql"
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    die "DATABASE_URL not set in $API_DIR/.env"
  fi

  parse_db_url

  log_db "Target: user='$DB_USER' database='$DB_NAME'"

  log_db "Testing superuser access..."
  if ! run_as_postgres "SELECT 1;" &>/dev/null; then
    die "Cannot connect as postgres superuser. Check pg_hba.conf or run: sudo -u postgres psql"
  fi
  log_ok "Superuser access confirmed"

  log_db "Ensuring user '$DB_USER' exists with correct password..."
  run_as_postgres "DO \\$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN CREATE USER $DB_USER WITH PASSWORD '$DB_PASS'; ELSE ALTER USER $DB_USER WITH PASSWORD '$DB_PASS'; END IF; END \\$\$;" 2>&1 | head -5 || {
    log_warn "DO block failed, trying direct commands..."
    run_as_postgres "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>&1 | head -3 || true
    run_as_postgres "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>&1 | head -3 || true
  }

  log_db "Ensuring database '$DB_NAME' exists..."
  run_as_postgres "SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME');\gexec" 2>&1 | head -5 || {
    run_as_postgres "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>&1 | head -3 || true
  }

  log_db "Granting privileges..."
  run_as_postgres "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>&1 | head -3 || true

  if check_db_connection; then
    log_ok "Database provisioned and accessible"
  else
    die "Database provisioning failed"
  fi
}

db_diagnose() {
  log_db "Diagnosing database..."

  if ! check_db_server; then
    die "Postgres server is not running"
  fi

  log_db "DATABASE_URL: ${DATABASE_URL:-NOT SET}"

  if [[ -n "${DATABASE_URL:-}" ]]; then
    parse_db_url

    log_db "Testing connection with visible errors..."
    psql "$DATABASE_URL" -c "SELECT 1 as test;" 2>&1 | head -10 || true

    log_db "Listing databases (as postgres superuser)..."
    run_as_postgres "\l" 2>&1 | head -15 || log_warn "Cannot list databases"

    log_db "Checking users..."
    run_as_postgres "\du" 2>&1 | head -10 || log_warn "Cannot list users"
  fi
}

db_migrate() {
  log_db "Running database migrations..."

  if ! check_db_server; then
    die "Cannot migrate — Postgres server is down"
  fi

  if ! check_db_connection; then
    log_warn "Database not accessible — provisioning..."
    db_provision
  fi

  cd "$DB_DIR"

  if [[ -f "$API_DIR/.env" ]]; then
    set -a
    source "$API_DIR/.env"
    set +a
  fi

  log_db "DATABASE_URL is set: $([[ -n "${DATABASE_URL:-}" ]] && echo "YES" || echo "NO")"

  log_db "Running drizzle-kit push..."
  if pnpm push 2>&1; then
    log_ok "Migrations complete"
  else
    log_error "Migration failed"
    db_diagnose
    die "Migration failed"
  fi
}

db_status() {
  if check_db_server; then
    if check_db_connection; then
      local conn_count
      conn_count=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs || echo "?")
      log_db "Active connections: $conn_count"
    fi
  fi
}

# ── API Server ─────────────────────────────────────────────────────────────
fix_routes() {
  log_info "Fixing routes and auth..."
  local app_ts="$API_DIR/src/app.ts"
  [[ -f "$app_ts" ]] || die "app.ts not found"

  if grep -q 'req.path === "/api/healthz"' "$app_ts"; then
    log_ok "Auth bypass already present — skipping"
    return 0
  fi

  backup_file "$app_ts"

  cat > "$app_ts" << 'EOF'
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth.js";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── CORS ─────────────────────────────────────────────────────────────────
const rawOrigins = process.env["CORS_ORIGIN"] ?? "";
const allowedOrigins: (string | RegExp)[] = rawOrigins.trim()
  ? rawOrigins.split(",").map((o) => o.trim())
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "http://localhost:5177",
    ];

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        allowedOrigins.some((o) =>
          typeof o === "string" ? o === origin : o.test(origin),
        )
      ) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  }),
);

// ── Request logging ────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Public endpoints (no auth) ─────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "api-server",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── FR-016: Bearer token auth with healthz bypass ──────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/api/healthz") {
    return next();
  }
  return requireAuth(req, res, next);
});

app.use("/api", router);

// ── FR-022: Global error handler ───────────────────────────────────────────
app.use(
  (
    err: Error & { status?: number; code?: string },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const status = err.status ?? 500;
    const code =
      err.code ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    if (status >= 500) {
      logger.error({ err }, "Unhandled server error");
    }
    if (res.headersSent) return;
    res.status(status).json({
      error: err.message ?? "Internal server error",
      code,
    });
  },
);

export default app;
EOF
  log_ok "Fixed app.ts (added 5177 to CORS)"
}

typecheck() {
  log_info "Running TypeScript check..."
  cd "$API_DIR"
  pnpm typecheck || die "TypeScript errors"
  log_ok "Type check passed"
}

build_api() {
  log_info "Building api-server..."
  cd "$API_DIR"
  [[ -d "$API_DIR/dist" ]] && rm -rf "$API_DIR/dist"
  pnpm build || die "Build failed"
  log_ok "Build complete"
}

deploy_api() {
  log_info "Deploying api-server..."

  if [[ -f "$PID_FILE" ]]; then
    local old_pid
    old_pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
      log_warn "Stopping tracked process (PID: $old_pid)"
      kill -15 "$old_pid" 2>/dev/null || true
      sleep 2
      kill -9 "$old_pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  kill_port_processes "$API_PORT" "API server"

  cd "$API_DIR"
  > "$API_DIR/api.log"

  (
    cd "$API_DIR"
    nohup node --env-file=.env --enable-source-maps ./dist/index.mjs >> api.log 2>&1 &
    local inner_attempts=0
    while [[ $inner_attempts -lt 30 ]]; do
      sleep 0.3
      if ss -tlnp 2>/dev/null | awk -v p=":$API_PORT " '$4 ~ p {exit 0} END {exit 1}'; then
        break
      fi
      inner_attempts=$((inner_attempts + 1))
    done
  )

  local new_pid=""
  local outer_attempts=0
  while [[ -z "$new_pid" ]] && [[ $outer_attempts -lt 30 ]]; do
    sleep 0.3
    new_pid=$(get_api_pid)
    outer_attempts=$((outer_attempts + 1))
  done

  if [[ -z "$new_pid" ]]; then
    log_error "Failed to detect node PID. Log tail:"
    tail -30 "$API_DIR/api.log" || true
    die "Server failed to start"
  fi

  echo "$new_pid" > "$PID_FILE"
  log_ok "Started (node PID: $new_pid)"

  local health_attempts=0
  while [[ $health_attempts -lt 15 ]]; do
    sleep 0.5
    if curl -sf "$API_HEALTH" &>/dev/null; then
      break
    fi
    health_attempts=$((health_attempts + 1))
  done

  if [[ $health_attempts -ge 15 ]]; then
    die "Server started but health check failed"
  fi

  log_ok "Health check passed"
}

verify_api() {
  log_info "Verifying API endpoints..."

  log_ok "/health: $(curl -sf "$API_HEALTH")"
  log_ok "/api/healthz: $(curl -sf "http://localhost:$API_PORT/api/healthz")"
  log_ok "/api/metrics: $(curl -sf "http://localhost:$API_PORT/api/metrics" | head -c 60)..."
  log_ok "API verified"
}

# ── Frontend ───────────────────────────────────────────────────────────────
build_fe() {
  log_info "Building frontend..."
  cd "$FE_DIR"
  pnpm build || die "Frontend build failed"
  log_ok "Frontend build complete"
}

deploy_fe() {
  log_info "Deploying frontend..."

  if [[ -f "$FE_PID_FILE" ]]; then
    local old_pid
    old_pid=$(cat "$FE_PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
      log_warn "Stopping frontend (PID: $old_pid)"
      kill -15 "$old_pid" 2>/dev/null || true
      sleep 1
      kill -9 "$old_pid" 2>/dev/null || true
    fi
    rm -f "$FE_PID_FILE"
  fi

  kill_port_processes "$FE_PORT" "frontend"

  cd "$FE_DIR"
  > "$FE_DIR/frontend.log"

  (
    cd "$FE_DIR"
    nohup pnpm dev >> frontend.log 2>&1 &
    local inner_attempts=0
    while [[ $inner_attempts -lt 30 ]]; do
      sleep 0.3
      if ss -tlnp 2>/dev/null | awk -v p=":$FE_PORT " '$4 ~ p {exit 0} END {exit 1}'; then
        break
      fi
      inner_attempts=$((inner_attempts + 1))
    done
  )

  local new_pid=""
  local outer_attempts=0
  while [[ -z "$new_pid" ]] && [[ $outer_attempts -lt 30 ]]; do
    sleep 0.3
    new_pid=$(ss -tlnp 2>/dev/null | awk -v p=":$FE_PORT " '$4 ~ p {print}' |       sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
    outer_attempts=$((outer_attempts + 1))
  done

  if [[ -z "$new_pid" ]]; then
    die "Frontend failed to start"
  fi

  echo "$new_pid" > "$FE_PID_FILE"
  log_ok "Frontend started (PID: $new_pid) on port $FE_PORT"
}

verify_fe() {
  log_info "Verifying frontend..."
  local max=10 attempt=1

  while [[ $attempt -le $max ]]; do
    if curl -sf "$FE_URL" -o /dev/null; then
      break
    fi
    log_warn "Waiting for frontend... ($attempt/$max)"
    sleep 1
    attempt=$((attempt + 1))
  done

  if [[ $attempt -le $max ]]; then
    log_ok "Frontend responding on $FE_URL"
  else
    log_warn "Frontend not responding (might need browser)"
  fi
}

# ── Stack Commands ─────────────────────────────────────────────────────────
stack_start() {
  log_info "═══ STARTING FULL STACK ═══"
  validate_environment

  if check_db_server; then
    if ! check_db_connection; then
      log_warn "Database not accessible — provisioning..."
      db_provision
    fi
  else
    log_warn "Database server not running — API may fail"
  fi

  fix_routes
  typecheck
  build_api
  deploy_api
  verify_api
  deploy_fe
  verify_fe

  echo ""
  log_ok "═══ STACK READY ═══"
  log_info "API:      $API_HEALTH"
  log_info "Frontend: $FE_URL"
  log_info "DB:       postgresql://localhost:$DB_PORT"
  echo ""
  log_info "Logs:"
  log_info "  API:      tail -f $API_DIR/api.log"
  log_info "  Frontend: tail -f $FE_DIR/frontend.log"
}

stack_stop() {
  log_info "═══ STOPPING STACK ═══"

  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -15 "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      log_ok "Stopped API (PID: $pid)"
    fi
    rm -f "$PID_FILE"
  fi

  if [[ -f "$FE_PID_FILE" ]]; then
    local pid
    pid=$(cat "$FE_PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -15 "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      log_ok "Stopped frontend (PID: $pid)"
    fi
    rm -f "$FE_PID_FILE"
  fi

  local api_pids
  api_pids=$(get_port_pids "$API_PORT")
  if [[ -n "$api_pids" ]]; then
    for pid in $api_pids; do kill -9 "$pid" 2>/dev/null || true; done
    log_ok "Cleaned up API port"
  fi

  local fe_pids
  fe_pids=$(get_port_pids "$FE_PORT")
  if [[ -n "$fe_pids" ]]; then
    for pid in $fe_pids; do kill -9 "$pid" 2>/dev/null || true; done
    log_ok "Cleaned up frontend port"
  fi

  log_ok "Stack stopped"
}

stack_status() {
  echo ""
  log_info "═══ STACK STATUS ═══"

  local api_pid
  api_pid=$(get_api_pid)
  if [[ -n "$api_pid" ]]; then
    log_ok "API:      RUNNING (PID: $api_pid, port $API_PORT)"
  else
    log_warn "API:      STOPPED"
  fi

  local fe_line
  fe_line=$(ss -tlnp 2>/dev/null | awk -v p=":517[3-9] " '$4 ~ p {print; exit}')
  if [[ -n "$fe_line" ]]; then
    local fe_port
    fe_port=$(echo "$fe_line" | awk '{print $4}' | cut -d: -f2)
    local fe_pid
    fe_pid=$(echo "$fe_line" | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
    log_ok "Frontend: RUNNING (PID: $fe_pid, port $fe_port)"
  else
    log_warn "Frontend: STOPPED"
  fi

  if check_db_server &>/dev/null; then
    log_ok "Database: RUNNING (port $DB_PORT)"
  else
    log_warn "Database: DOWN"
  fi

  echo ""
}

# ── Legacy API-only commands ───────────────────────────────────────────────
show_api_status() {
  local pid_from_file=""
  local pid_from_port=""

  if [[ -f "$PID_FILE" ]]; then
    pid_from_file=$(cat "$PID_FILE" 2>/dev/null || echo "")
  fi

  pid_from_port=$(get_api_pid)

  if [[ -n "$pid_from_file" ]] && kill -0 "$pid_from_file" 2>/dev/null; then
    log_ok "API running (tracked PID: $pid_from_file)"
    if [[ -n "$pid_from_port" ]]; then
      ss -tlnp | awk -v p=":$API_PORT " '$4 ~ p {print}' || true
    fi
    return 0
  fi

  if [[ -n "$pid_from_port" ]]; then
    log_warn "Untracked API process on port $API_PORT (PID: $pid_from_port)"
    return 1
  fi

  log_warn "API not running"
  return 1
}

show_api_logs() {
  if [[ -f "$API_DIR/api.log" ]]; then
    tail -f "$API_DIR/api.log"
  else
    die "No API log file"
  fi
}

stop_api() {
  local stopped=0

  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -15 "$pid" 2>/dev/null && stopped=1
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      log_ok "Stopped API (PID: $pid)"
    else
      log_warn "API already dead"
    fi
    rm -f "$PID_FILE"
  fi

  local port_pids
  port_pids=$(get_port_pids "$API_PORT")
  if [[ -n "$port_pids" ]]; then
    for pid in $port_pids; do kill -9 "$pid" 2>/dev/null || true; done
    log_ok "Cleaned up API port"
    stopped=1
  fi

  if [[ $stopped -eq 0 ]]; then
    log_warn "API not running"
  fi
}

kill_api() {
  rm -f "$PID_FILE"
  kill_port_processes "$API_PORT" "API"
}

# ── CLI ──────────────────────────────────────────────────────────────────────
usage() {
  cat << 'EOF'
Usage: agi-suite.sh [command]

STACK COMMANDS:
  stack       Start full stack (API + frontend + DB check/provision)
  status      Show status of all components
  stop        Stop everything (API + frontend)
  restart     Full stop + stack start

API COMMANDS:
  api         API pipeline: fix → check → build → deploy → verify
  fix         Fix routes/auth only
  check       TypeScript check
  build       Build API only
  deploy      Deploy API only
  verify      Verify API endpoints
  api-status  Show API status
  api-logs    Tail API log
  api-stop    Stop API only
  api-kill    Hard kill API port

FRONTEND COMMANDS:
  fe          Build + deploy frontend
  fe-build    Build frontend only
  fe-deploy   Deploy frontend only
  fe-stop     Stop frontend only

DATABASE COMMANDS:
  db-check    Check Postgres server + connection
  db-diagnose Full DB diagnostics with visible errors
  db-provision Auto-create user/database + reset password
  db-migrate  Run Drizzle migrations (auto-provisions if needed)
  db-status   Show DB connection info

OTHER:
  all         Alias for 'stack'

Examples:
  ./agi-suite.sh db-diagnose   # Debug DB connection
  ./agi-suite.sh db-provision  # Fix user/password/database
  ./agi-suite.sh stack         # Start everything
  ./agi-suite.sh status        # Check what's running

EOF
}

case "${1:-stack}" in
  # Stack
  stack|all)
    stack_start
    ;;
  status)
    stack_status
    ;;
  stop)
    stack_stop
    ;;
  restart)
    stack_stop
    sleep 1
    stack_start
    ;;

  # API
  api)
    validate_environment
    fix_routes
    typecheck
    build_api
    deploy_api
    verify_api
    ;;
  fix)
    fix_routes
    ;;
  check)
    validate_environment
    typecheck
    ;;
  build)
    validate_environment
    build_api
    ;;
  deploy)
    validate_environment
    deploy_api
    ;;
  verify)
    verify_api
    ;;
  api-status)
    show_api_status
    ;;
  api-logs)
    show_api_logs
    ;;
  api-stop)
    stop_api
    ;;
  api-kill)
    kill_api
    ;;

  # Frontend
  fe)
    validate_environment
    deploy_fe
    verify_fe
    ;;
  fe-build)
    validate_environment
    build_fe
    ;;
  fe-deploy)
    validate_environment
    deploy_fe
    verify_fe
    ;;
  fe-stop)
    if [[ -f "$FE_PID_FILE" ]]; then
      local pid
      pid=$(cat "$FE_PID_FILE" 2>/dev/null || echo "")
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        kill -15 "$pid" 2>/dev/null || true
        sleep 1
        kill -9 "$pid" 2>/dev/null || true
        log_ok "Stopped frontend (PID: $pid)"
      fi
      rm -f "$FE_PID_FILE"
    fi
    local fe_pids
    fe_pids=$(get_port_pids "$FE_PORT")
    if [[ -n "$fe_pids" ]]; then
      for pid in $fe_pids; do kill -9 "$pid" 2>/dev/null || true; done
      log_ok "Cleaned up frontend port"
    fi
    ;;

  # Database
  db-check)
    check_db_server
    check_db_connection
    ;;
  db-diagnose)
    db_diagnose
    ;;
  db-provision)
    db_provision
    ;;
  db-migrate)
    db_migrate
    ;;
  db-status)
    db_status
    ;;

  *)
    usage
    exit 1
    ;;
esac
