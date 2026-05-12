#!/usr/bin/env bash
#==============================================================================
# Agi-Suite API Server — Master Implementation Script v3
# Fixes: status local scope, robust PID tracking, pino worker cleanup
#==============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── Configuration ────────────────────────────────────────────────────────────
REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/Agi-Suite")}"
API_DIR="$REPO_ROOT/apps/api-server"
SRC_DIR="$API_DIR/src"
DIST_DIR="$API_DIR/dist"
ENV_FILE="$API_DIR/.env"
PID_FILE="/tmp/agi-api-server.pid"
PORT="${PORT:-3001}"
HEALTH_URL="http://localhost:$PORT/api/healthz"
ROOT_HEALTH_URL="http://localhost:$PORT/health"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

die() { log_error "$1"; exit 1; }

backup_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local backup="${file}.bak-$(date +%Y%m%d_%H%M%S)"
    cp "$file" "$backup"
    log_warn "Backed up: $file → $(basename "$backup")"
  fi
}

# ── Process / Port Utilities ────────────────────────────────────────────────
get_port_pids() {
  ss -tlnp 2>/dev/null | grep ":$1 " | grep -oP 'pid=\K[0-9]+' | sort -u | tr '\n' ' '
}

kill_port_processes() {
  local port="$1"
  log_info "Cleaning up port $port..."

  local pids
  pids=$(get_port_pids "$port")

  for pid in $pids; do
    [[ -n "$pid" ]] || continue
    log_warn "Killing process on port $port (PID: $pid)"
    kill -15 "$pid" 2>/dev/null || true
  done

  sleep 1

  # SIGKILL survivors
  pids=$(get_port_pids "$port")
  for pid in $pids; do
    [[ -n "$pid" ]] || continue
    log_warn "Force-killing survivor (PID: $pid)"
    kill -9 "$pid" 2>/dev/null || true
  done

  # Wait for port release
  local attempts=0
  while [[ -n "$(get_port_pids "$port")" ]] && [[ $attempts -lt 15 ]]; do
    sleep 0.5
    ((attempts++))
  done

  if [[ -n "$(get_port_pids "$port")" ]]; then
    die "Port $port still in use"
  fi

  log_ok "Port $port is free"
}

get_node_pid() {
  # Find node process serving on the port (most reliable)
  ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1
}

# ── Validation ─────────────────────────────────────────────────────────────
validate_environment() {
  log_info "Validating environment..."
  [[ -d "$API_DIR" ]] || die "api-server directory not found: $API_DIR"
  [[ -f "$API_DIR/package.json" ]] || die "package.json not found"
  local node_version
  node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  [[ "$node_version" -ge 18 ]] || die "Node.js 18+ required"
  command -v pnpm &>/dev/null || die "pnpm not found"
  log_ok "Environment valid"
}

# ── Fix Routes & Auth ──────────────────────────────────────────────────────
fix_routes() {
  log_info "Fixing routes and auth..."
  local app_ts="$SRC_DIR/app.ts"
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
  log_ok "Fixed app.ts"
}

# ── Type Check ─────────────────────────────────────────────────────────────
typecheck() {
  log_info "Running TypeScript check..."
  cd "$API_DIR"
  pnpm typecheck || die "TypeScript errors"
  log_ok "Type check passed"
}

# ── Build ──────────────────────────────────────────────────────────────────
build() {
  log_info "Building api-server..."
  cd "$API_DIR"
  [[ -d "$DIST_DIR" ]] && rm -rf "$DIST_DIR"
  pnpm build || die "Build failed"
  log_ok "Build complete"
}

# ── Deploy ─────────────────────────────────────────────────────────────────
deploy() {
  log_info "Deploying api-server..."

  # Stop existing tracked process
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

  # Aggressive port cleanup
  kill_port_processes "$PORT"

  cd "$API_DIR"

  # Start with explicit log truncation
  > "$API_DIR/api.log"

  # Use exec to replace shell, redirect properly, background the whole thing
  (
    cd "$API_DIR"
    exec node --env-file=.env --enable-source-maps ./dist/index.mjs >> api.log 2>&1
  ) &

  local bg_pid=$!
  sleep 2

  # Find the actual node process (not the subshell)
  local node_pid
  node_pid=$(get_node_pid)

  if [[ -z "$node_pid" ]]; then
    # Fallback: try to find by cmdline
    node_pid=$(pgrep -f "node.*index.mjs" | grep -v "^$bg_pid$" | head -1)
  fi

  if [[ -z "$node_pid" ]]; then
    log_error "Failed to detect node PID. Log tail:"
    tail -5 "$API_DIR/api.log" || true
    die "Server failed to start"
  fi

  echo "$node_pid" > "$PID_FILE"
  log_ok "Started (node PID: $node_pid, subshell: $bg_pid)"

  sleep 2
}

# ── Verify ─────────────────────────────────────────────────────────────────
verify() {
  log_info "Verifying endpoints..."
  local max=15 attempt=1

  while [[ $attempt -le $max ]]; do
    if curl -sf "$HEALTH_URL" &>/dev/null; then
      break
    fi
    log_warn "Waiting for server... ($attempt/$max)"
    sleep 1
    ((attempt++))
  done

  [[ $attempt -le $max ]] || die "Server failed to start"

  log_ok "/api/healthz: $(curl -sf "$HEALTH_URL")"
  log_ok "/health: $(curl -sf "$ROOT_HEALTH_URL")"
  log_ok "/api/metrics: $(curl -sf "http://localhost:$PORT/api/metrics" | head -c 60)..."
  log_ok "All verifications passed"
}

# ── Full Pipeline ──────────────────────────────────────────────────────────
run_all() {
  validate_environment
  fix_routes
  typecheck
  build
  deploy
  verify
  log_ok "═══ PIPELINE COMPLETE ═══"
}

# ── Status ─────────────────────────────────────────────────────────────────
show_status() {
  local pid_from_file=""
  local pid_from_port=""

  if [[ -f "$PID_FILE" ]]; then
    pid_from_file=$(cat "$PID_FILE" 2>/dev/null || echo "")
  fi

  pid_from_port=$(get_node_pid)

  if [[ -n "$pid_from_file" ]] && kill -0 "$pid_from_file" 2>/dev/null; then
    log_ok "Running (tracked PID: $pid_from_file)"
    if [[ -n "$pid_from_port" ]]; then
      ss -tlnp | grep ":$PORT " || true
    fi
    return 0
  fi

  if [[ -n "$pid_from_port" ]]; then
    log_warn "Untracked process on port $PORT (PID: $pid_from_port)"
    ss -tlnp | grep ":$PORT " || true
    return 1
  fi

  log_warn "Not running"
  return 1
}

# ── Logs ───────────────────────────────────────────────────────────────────
show_logs() {
  if [[ -f "$API_DIR/api.log" ]]; then
    tail -f "$API_DIR/api.log"
  else
    die "No log file found"
  fi
}

# ── Stop ───────────────────────────────────────────────────────────────────
do_stop() {
  local stopped=0

  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -15 "$pid" 2>/dev/null && stopped=1
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
      log_ok "Stopped tracked process (PID: $pid)"
    else
      log_warn "Tracked process already dead"
    fi
    rm -f "$PID_FILE"
  fi

  # Also clean port regardless
  local port_pids
  port_pids=$(get_port_pids "$PORT")
  if [[ -n "$port_pids" ]]; then
    for pid in $port_pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
    log_ok "Cleaned up port $PORT"
    stopped=1
  fi

  if [[ $stopped -eq 0 ]]; then
    log_warn "Nothing to stop"
  fi
}

# ── Hard Kill ──────────────────────────────────────────────────────────────
do_kill() {
  rm -f "$PID_FILE"
  kill_port_processes "$PORT"
  log_ok "Port $PORT cleared"
}

# ── CLI ────────────────────────────────────────────────────────────────────
usage() {
  cat << 'EOF'
Usage: agi-api-master.sh [command]

Commands:
  all       Full pipeline (default)
  fix       Fix routes/auth only
  check     TypeScript check
  build     Build only
  deploy    Deploy/restart only
  verify    Test endpoints
  status    Show running status
  logs      Tail api.log
  stop      Stop server + cleanup
  kill      Hard kill everything on port 3001

EOF
}

case "${1:-all}" in
  fix)      fix_routes ;;
  check)    validate_environment; typecheck ;;
  build)    validate_environment; build ;;
  deploy)   validate_environment; deploy ;;
  verify)   verify ;;
  all)      run_all ;;
  status)   show_status ;;
  logs)     show_logs ;;
  stop)     do_stop ;;
  kill)     do_kill ;;
  *)        usage; exit 1 ;;
esac
