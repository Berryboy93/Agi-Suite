#!/usr/bin/env bash

################################################################################
# Agi-Suite Startup Script v1.0
# 
# A clean, robust startup script for the Agi-Suite monorepo
# Handles: API server, frontend, process management, logging, health checks
#
# Usage:
#   ./agi-suite-startup.sh                    # Start both API + frontend
#   ./agi-suite-startup.sh --api-only         # Start just the API
#   ./agi-suite-startup.sh --frontend-only    # Start just the frontend
#   ./agi-suite-startup.sh stop                # Stop all services
#   ./agi-suite-startup.sh status              # Check service status
#   ./agi-suite-startup.sh logs [service]     # Tail logs (api, frontend, or both)
################################################################################

set -o pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════════

# Resolve script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}" && git rev-parse --show-toplevel 2>/dev/null || echo "$(pwd)")"

# Service directories
API_DIR="${PROJECT_ROOT}/apps/api-server"
FRONTEND_DIR="${PROJECT_ROOT}/apps/r3-agi"
LOGS_DIR="${PROJECT_ROOT}/logs"

# Service configuration
API_PORT="${API_PORT:-3000}"
API_HOST="${API_HOST:-localhost}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
FRONTEND_HOST="${FRONTEND_HOST:-localhost}"

# PID files
PID_FILE_API="${PROJECT_ROOT}/.pids/api.pid"
PID_FILE_FRONTEND="${PROJECT_ROOT}/.pids/frontend.pid"
PID_DIR="$(dirname "$PID_FILE_API")"

# Timeouts
STARTUP_TIMEOUT=30
HEALTH_CHECK_TIMEOUT=15
SHUTDOWN_TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ══════════════════════════════════════════════════════════════════════════════
# Logging Functions
# ══════════════════════════════════════════════════════════════════════════════

log_info() {
  echo -e "${BLUE}ℹ${NC} [$(date +'%H:%M:%S')] $*"
}

log_success() {
  echo -e "${GREEN}✓${NC} [$(date +'%H:%M:%S')] $*"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} [$(date +'%H:%M:%S')] $*" >&2
}

log_error() {
  echo -e "${RED}✗${NC} [$(date +'%H:%M:%S')] $*" >&2
}

die() {
  log_error "$@"
  exit 1
}

# ══════════════════════════════════════════════════════════════════════════════
# Utility Functions
# ══════════════════════════════════════════════════════════════════════════════

# Check if port is in use
port_in_use() {
  local port=$1
  ss -tlnp 2>/dev/null | grep ":${port}" >/dev/null 2>&1
}

# Wait for a port to be available
wait_for_port() {
  local port=$1
  local timeout=$2
  local elapsed=0
  
  while [[ $elapsed -lt $timeout ]]; do
    if port_in_use "$port"; then
      return 0
    fi
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
  
  return 1
}

# Check if a process is still running
is_running() {
  local pid=$1
  if [[ -z "$pid" ]]; then
    return 1
  fi
  kill -0 "$pid" 2>/dev/null
}

# Get PID from file (if it exists and process is running)
get_saved_pid() {
  local pid_file=$1
  if [[ -f "$pid_file" ]]; then
    local pid=$(cat "$pid_file")
    if is_running "$pid"; then
      echo "$pid"
      return 0
    else
      rm -f "$pid_file"
    fi
  fi
  return 1
}

# Kill process by PID gracefully, then forcefully
kill_process() {
  local pid=$1
  local name=$2
  
  if ! is_running "$pid"; then
    return 0
  fi
  
  log_info "Terminating $name (PID: $pid)..."
  kill -TERM "$pid" 2>/dev/null || true
  
  local elapsed=0
  while [[ $elapsed -lt $SHUTDOWN_TIMEOUT ]] && is_running "$pid"; do
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
  
  if is_running "$pid"; then
    log_warn "Force killing $name (PID: $pid)..."
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.5
  fi
  
  if ! is_running "$pid"; then
    log_success "$name stopped"
    return 0
  else
    log_error "Failed to stop $name"
    return 1
  fi
}

# Ensure directories exist
ensure_dirs() {
  mkdir -p "$LOGS_DIR"
  mkdir -p "$PID_DIR"
}

# ══════════════════════════════════════════════════════════════════════════════
# Health Check Functions
# ══════════════════════════════════════════════════════════════════════════════

check_api_health() {
  local url="http://${API_HOST}:${API_PORT}/health"
  curl -sf "$url" >/dev/null 2>&1
}

check_api_ready() {
  local elapsed=0
  log_info "Waiting for API to be ready..."
  
  while [[ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]]; do
    if check_api_health; then
      log_success "API is healthy"
      return 0
    fi
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
  
  log_warn "API health check timeout (${HEALTH_CHECK_TIMEOUT}s)"
  return 1
}

# ══════════════════════════════════════════════════════════════════════════════
# API Server Functions
# ══════════════════════════════════════════════════════════════════════════════

start_api() {
  log_info "Starting API server..."
  
  if [[ ! -d "$API_DIR" ]]; then
    die "API directory not found: $API_DIR"
  fi
  
  # Check if already running
  if pid=$(get_saved_pid "$PID_FILE_API"); then
    log_warn "API is already running (PID: $pid)"
    return 0
  fi
  
  # Check if port is free
  if port_in_use "$API_PORT"; then
    log_error "Port $API_PORT is already in use"
    log_info "Attempting to kill existing process..."
    
    # Find and kill the process using the port
    local pid=$(ss -tlnp 2>/dev/null | grep ":${API_PORT}" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
    if [[ -n "$pid" ]]; then
      kill_process "$pid" "Process on port $API_PORT" || die "Cannot free port $API_PORT"
      sleep 1
    else
      die "Port $API_PORT in use but cannot identify process"
    fi
  fi
  
  # Check dependencies
  if [[ ! -f "$API_DIR/dist/index.mjs" ]]; then
    die "API build not found at $API_DIR/dist/index.mjs. Run: cd $API_DIR && pnpm build"
  fi
  
  if [[ ! -f "$API_DIR/.env" ]]; then
    log_warn "No .env file found at $API_DIR/.env"
    log_info "Creating basic .env file..."
    cat > "$API_DIR/.env" << EOF
API_PORT=${API_PORT}
API_HOST=${API_HOST}
NODE_ENV=development
EOF
  fi
  
  # Clear old log file
  > "$LOGS_DIR/api.log"
  
  # Start the API server
  (
    cd "$API_DIR"
    nohup node --env-file=.env --enable-source-maps ./dist/index.mjs >> "$LOGS_DIR/api.log" 2>&1 &
    # Capture the PID immediately
    echo $! > "$PID_FILE_API"
  )
  
  # Small delay to let process start
  sleep 0.5
  
  # Verify the process is actually running
  if ! pid=$(get_saved_pid "$PID_FILE_API"); then
    log_error "Failed to start API server"
    log_error "Recent logs:"
    tail -20 "$LOGS_DIR/api.log" | sed 's/^/  /'
    die "API startup failed"
  fi
  
  log_success "API server started (PID: $pid)"
  
  # Wait for port to be listening
  if wait_for_port "$API_PORT" "$STARTUP_TIMEOUT"; then
    log_success "API listening on port $API_PORT"
  else
    log_warn "API port not detected after ${STARTUP_TIMEOUT}s (may still be starting)"
  fi
  
  # Run health check
  if ! check_api_ready; then
    log_warn "API health check failed, but process is running"
    log_info "Check logs: tail -f $LOGS_DIR/api.log"
  fi
}

stop_api() {
  log_info "Stopping API server..."
  
  if pid=$(get_saved_pid "$PID_FILE_API"); then
    kill_process "$pid" "API server"
    rm -f "$PID_FILE_API"
  else
    log_info "API is not running"
  fi
}

status_api() {
  if pid=$(get_saved_pid "$PID_FILE_API"); then
    echo -e "${GREEN}✓${NC} API server is running (PID: $pid)"
    echo "  Port: $API_PORT"
    if check_api_health; then
      echo "  Health: ${GREEN}healthy${NC}"
    else
      echo "  Health: ${YELLOW}unhealthy${NC}"
    fi
    return 0
  else
    echo -e "${RED}✗${NC} API server is not running"
    return 1
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Frontend Functions
# ══════════════════════════════════════════════════════════════════════════════

start_frontend() {
  log_info "Starting frontend..."
  
  if [[ ! -d "$FRONTEND_DIR" ]]; then
    die "Frontend directory not found: $FRONTEND_DIR"
  fi
  
  # Check if already running
  if pid=$(get_saved_pid "$PID_FILE_FRONTEND"); then
    log_warn "Frontend is already running (PID: $pid)"
    return 0
  fi
  
  # Check if port is free
  if port_in_use "$FRONTEND_PORT"; then
    log_error "Port $FRONTEND_PORT is already in use"
    local pid=$(ss -tlnp 2>/dev/null | grep ":${FRONTEND_PORT}" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
    if [[ -n "$pid" ]]; then
      kill_process "$pid" "Process on port $FRONTEND_PORT" || die "Cannot free port $FRONTEND_PORT"
      sleep 1
    fi
  fi
  
  # Clear old log file
  > "$LOGS_DIR/frontend.log"
  
  # Start the frontend
  (
    cd "$FRONTEND_DIR"
    nohup pnpm dev >> "$LOGS_DIR/frontend.log" 2>&1 &
    echo $! > "$PID_FILE_FRONTEND"
  )
  
  sleep 0.5
  
  if ! pid=$(get_saved_pid "$PID_FILE_FRONTEND"); then
    log_error "Failed to start frontend"
    log_error "Recent logs:"
    tail -20 "$LOGS_DIR/frontend.log" | sed 's/^/  /'
    die "Frontend startup failed"
  fi
  
  log_success "Frontend started (PID: $pid)"
  
  if wait_for_port "$FRONTEND_PORT" "$STARTUP_TIMEOUT"; then
    log_success "Frontend listening on port $FRONTEND_PORT"
  else
    log_warn "Frontend port not detected after ${STARTUP_TIMEOUT}s"
  fi
}

stop_frontend() {
  log_info "Stopping frontend..."
  
  if pid=$(get_saved_pid "$PID_FILE_FRONTEND"); then
    kill_process "$pid" "Frontend"
    rm -f "$PID_FILE_FRONTEND"
  else
    log_info "Frontend is not running"
  fi
}

status_frontend() {
  if pid=$(get_saved_pid "$PID_FILE_FRONTEND"); then
    echo -e "${GREEN}✓${NC} Frontend is running (PID: $pid)"
    echo "  Port: $FRONTEND_PORT"
    return 0
  else
    echo -e "${RED}✗${NC} Frontend is not running"
    return 1
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Combined Operations
# ══════════════════════════════════════════════════════════════════════════════

start_all() {
  ensure_dirs
  log_info "Starting Agi-Suite services..."
  start_api
  start_frontend
  echo ""
  status_all
  echo ""
  log_success "Services started!"
  echo "  API: http://${API_HOST}:${API_PORT}"
  echo "  Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
}

stop_all() {
  log_info "Stopping all services..."
  stop_api
  stop_frontend
  log_success "All services stopped"
}

status_all() {
  echo ""
  echo "Service Status:"
  echo "─────────────────────────────────────"
  status_api
  echo ""
  status_frontend
  echo "─────────────────────────────────────"
}

show_logs() {
  local service=$1
  
  case "${service,,}" in
    api)
      log_info "Tailing API logs (Ctrl+C to stop)..."
      tail -f "$LOGS_DIR/api.log"
      ;;
    frontend)
      log_info "Tailing frontend logs (Ctrl+C to stop)..."
      tail -f "$LOGS_DIR/frontend.log"
      ;;
    *)
      log_info "Tailing all logs (Ctrl+C to stop)..."
      log_info "API logs:" 
      tail -f "$LOGS_DIR/api.log" "$LOGS_DIR/frontend.log"
      ;;
  esac
}

# ══════════════════════════════════════════════════════════════════════════════
# Main Command Handler
# ══════════════════════════════════════════════════════════════════════════════

show_usage() {
  cat << EOF
Agi-Suite Startup Script v1.0

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  start          Start both API and frontend (default)
  start-api      Start only the API server
  start-frontend Start only the frontend
  stop           Stop all services
  restart        Restart all services
  status         Show service status
  logs [service] Tail logs (api, frontend, or all)
  help           Show this help message

Environment Variables:
  API_PORT       API server port (default: 3000)
  API_HOST       API server host (default: localhost)
  FRONTEND_PORT  Frontend port (default: 5173)
  FRONTEND_HOST  Frontend host (default: localhost)

Examples:
  $0                    # Start both services
  $0 start-api          # Start only API
  $0 status             # Check service status
  $0 logs api           # Tail API logs
  API_PORT=8080 $0      # Start with custom API port

EOF
}

# Parse command
COMMAND="${1:-start}"

case "${COMMAND,,}" in
  start)
    start_all
    ;;
  start-api|api)
    ensure_dirs
    start_api
    ;;
  start-frontend|frontend)
    ensure_dirs
    start_frontend
    ;;
  stop|shutdown)
    stop_all
    ;;
  restart)
    stop_all
    sleep 1
    start_all
    ;;
  status)
    status_all
    ;;
  logs|log)
    ensure_dirs
    show_logs "$2"
    ;;
  help|-h|--help)
    show_usage
    ;;
  *)
    log_error "Unknown command: $COMMAND"
    show_usage
    exit 1
    ;;
esac
