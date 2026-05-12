#!/usr/bin/env bash
#==============================================================================
# Agi-Suite API Server — Master Implementation Script
# Idempotent | Convention-aware | Safe to run multiple times
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
NC='\033[0m' # No Color

# ── Helpers ────────────────────────────────────────────────────────────────
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

# ── Validation ─────────────────────────────────────────────────────────────
validate_environment() {
  log_info "Validating environment..."

  [[ -d "$API_DIR" ]] || die "api-server directory not found: $API_DIR"
  [[ -f "$API_DIR/package.json" ]] || die "package.json not found"

  # Check Node.js version (needs 18+)
  local node_version
  node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  [[ "$node_version" -ge 18 ]] || die "Node.js 18+ required, found: $(node --version)"

  # Check pnpm
  command -v pnpm &>/dev/null || die "pnpm not found. Install: npm i -g pnpm"

  log_ok "Environment valid"
}

# ── Fix Routes & Auth ──────────────────────────────────────────────────────
fix_routes() {
  log_info "Fixing routes and auth..."

  local app_ts="$SRC_DIR/app.ts"
  [[ -f "$app_ts" ]] || die "app.ts not found: $app_ts"

  # Check if already fixed (idempotent)
  if grep -q 'req.path === "/api/healthz"' "$app_ts"; then
    log_ok "Auth bypass for healthz already present — skipping"
    return 0
  fi

  backup_file "$app_ts"

  # Create fixed version
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

// ── Request logging ──────────────────────────────────────────────────────────
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

  log_ok "Fixed app.ts — auth bypass + root /health added"
}

# ── Type Check ─────────────────────────────────────────────────────────────
typecheck() {
  log_info "Running TypeScript check..."
  cd "$API_DIR"
  pnpm typecheck || die "TypeScript errors found"
  log_ok "Type check passed"
}

# ── Build ──────────────────────────────────────────────────────────────────
build() {
  log_info "Building api-server..."
  cd "$API_DIR"

  # Clean dist if exists (idempotent)
  [[ -d "$DIST_DIR" ]] && rm -rf "$DIST_DIR"

  pnpm build || die "Build failed"
  log_ok "Build complete"
}

# ── Deploy / Start ─────────────────────────────────────────────────────────
deploy() {
  log_info "Deploying api-server..."

  # Stop existing if running (idempotent)
  if [[ -f "$PID_FILE" ]]; then
    local old_pid
    old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      log_warn "Stopping existing process (PID: $old_pid)"
      kill "$old_pid" || true
      sleep 2
      # Force kill if still running
      kill -9 "$old_pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  # Also kill any node on port 3001 (cleanup)
  local port_pid
  port_pid=$(ss -tlnp | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
  if [[ -n "$port_pid" ]]; then
    log_warn "Killing orphaned node process on port $PORT (PID: $port_pid)"
    kill -9 "$port_pid" 2>/dev/null || true
    sleep 1
  fi

  cd "$API_DIR"

  # Start in background with nohup
  nohup pnpm start > "$API_DIR/api.log" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$PID_FILE"

  log_info "Started (PID: $new_pid), logging to api.log"

  # Wait for startup
  sleep 3
}

# ── Health Verification ──────────────────────────────────────────────────────
verify() {
  log_info "Verifying endpoints..."

  local max_attempts=10
  local attempt=1

  while [[ $attempt -le $max_attempts ]]; do
    if curl -sf "$HEALTH_URL" &>/dev/null; then
      break
    fi
    log_warn "Attempt $attempt/$max_attempts — waiting for server..."
    sleep 1
    ((attempt++))
  done

  # Test /api/healthz
  local healthz_resp
  healthz_resp=$(curl -sf "$HEALTH_URL" || echo "FAIL")
  if [[ "$healthz_resp" == "FAIL" ]]; then
    die "Healthz check failed"
  fi
  log_ok "/api/healthz: $healthz_resp"

  # Test /health
  local health_resp
  health_resp=$(curl -sf "$ROOT_HEALTH_URL" || echo "FAIL")
  if [[ "$health_resp" == "FAIL" ]]; then
    die "Root /health check failed"
  fi
  log_ok "/health: $health_resp"

  # Test /api/metrics
  local metrics_resp
  metrics_resp=$(curl -sf "http://localhost:$PORT/api/metrics" || echo "FAIL")
  log_ok "/api/metrics: ${metrics_resp:0:60}..."

  log_ok "All verifications passed — API is healthy"
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
  cat << EOF
Usage: $0 [command]

Commands:
  fix       Fix routes/auth in app.ts only
  check     Run TypeScript type check
  build     Build the project
  deploy    Start/restart the server
  verify    Test all health endpoints
  all       Run full pipeline (default)
  status    Show running process status
  logs      Tail the api.log
  stop      Stop the running server

Examples:
  $0              # Full pipeline
  $0 fix          # Just fix code
  $0 deploy       # Just restart
  $0 verify       # Just test endpoints
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
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      log_ok "Server running (PID: $(cat "$PID_FILE"))"
      ss -tlnp | grep ":$PORT " || true
    else
      log_warn "Server not running"
    fi
    ;;
  logs)
    [[ -f "$API_DIR/api.log" ]] && tail -f "$API_DIR/api.log" || die "No log file"
    ;;
  stop)
    [[ -f "$PID_FILE" ]] && kill "$(cat "$PID_FILE")" 2>/dev/null && rm -f "$PID_FILE" && log_ok "Stopped" || log_warn "Not running"
    ;;
  *)        usage; exit 1 ;;
esac
