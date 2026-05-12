#!/usr/bin/env bash
#==============================================================================
# Agi-Suite API Server — Master Implementation Script v2
# Fixes: Port race condition, stale PID files, proper process cleanup
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

# ── Robust Port Cleanup ──────────────────────────────────────────────────────
kill_port_processes() {
  local port="$1"
  log_info "Cleaning up port $port..."

  # Method 1: Kill by PID from ss
  local pids
  pids=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | sort -u)
  for pid in $pids; do
    if [[ -n "$pid" ]] && [[ "$pid" != "$(cat "$PID_FILE" 2>/dev/null)" ]]; then
      log_warn "Killing foreign process on port $port (PID: $pid)"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done

  # Method 2: fuser fallback
  if command -v fuser &>/dev/null; then
    fuser -k "$port/tcp" 2>/dev/null || true
  fi

  # Method 3: lsof fallback
  if command -v lsof &>/dev/null; then
    lsof -ti tcp:"$port" | xargs kill -9 2>/dev/null || true
  fi

  # Wait for port to free
  local attempts=0
  while ss -tlnp 2>/dev/null | grep -q ":$port " && [[ $attempts -lt 10 ]]; do
    sleep 0.5
    ((attempts++))
  done

  if ss -tlnp 2>/dev/null | grep -q ":$port "; then
    die "Port $port still in use after cleanup"
  fi

  log_ok "Port $port is free"
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

  # Stop existing
  if [[ -f "$PID_FILE" ]]; then
    local old_pid
    old_pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
      log_warn "Stopping existing (PID: $old_pid)"
      kill "$old_pid" 2>/dev/null || true
      sleep 2
      kill -9 "$old_pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  # Aggressive port cleanup
  kill_port_processes "$PORT"

  cd "$API_DIR"

  # Start directly with node (avoid pnpm wrapper holding port)
  # Use setsid to detach from terminal properly
  local log_file="$API_DIR/api.log"
  > "$log_file"  # Truncate log

  setsid bash -c "node --env-file=.env --enable-source-maps ./dist/index.mjs >> '$log_file' 2>&1" &

  # Find the actual node process (not setsid)
  sleep 2
  local new_pid
  new_pid=$(pgrep -f "node.*dist/index.mjs" | head -1)

  if [[ -z "$new_pid" ]]; then
    die "Failed to start server — check $log_file"
  fi

  echo "$new_pid" > "$PID_FILE"
  log_ok "Started (PID: $new_pid), logging to api.log"

  # Wait for bind
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
  stop      Stop server
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
  status)
    if [[ -f "$PID_FILE" ]]; then
      local pid
      pid=$(cat "$PID_FILE")
      if kill -0 "$pid" 2>/dev/null; then
        log_ok "Running (PID: $pid)"
        ss -tlnp | grep ":$PORT " || true
      else
        log_warn "Stale PID file — process dead"
        rm -f "$PID_FILE"
      fi
    else
      # Check if something else is on the port
      if ss -tlnp | grep -q ":$PORT "; then
        local rogue
        rogue=$(ss -tlnp | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
        log_warn "PID file missing but port in use (PID: $rogue)"
      else
        log_warn "Not running"
      fi
    fi
    ;;
  logs)
    [[ -f "$API_DIR/api.log" ]] && tail -f "$API_DIR/api.log" || die "No log"
    ;;
  stop)
    if [[ -f "$PID_FILE" ]]; then
      local pid
      pid=$(cat "$PID_FILE")
      kill "$pid" 2>/dev/null && log_ok "Stopped (PID: $pid)" || log_warn "Already dead"
      rm -f "$PID_FILE"
    else
      log_warn "No PID file"
    fi
    kill_port_processes "$PORT" 2>/dev/null || true
    ;;
  kill)
    rm -f "$PID_FILE"
    kill_port_processes "$PORT"
    log_ok "Port $PORT cleared"
    ;;
  *)        usage; exit 1 ;;
esac
