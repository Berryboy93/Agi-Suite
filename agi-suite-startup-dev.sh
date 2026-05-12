#!/usr/bin/env bash

################################################################################
# Agi-Suite Development Startup Script
# 
# This version works with the actual development setup:
# - API: Runs on port 3001 with tsx watch (live reload)
# - Frontend: Runs on port 5176+ with vite (live reload)
# - Uses: pnpm dev (concurrently runs both)
#
# Usage:
#   ./agi-suite-startup-dev.sh                    # Start both with pnpm dev
#   ./agi-suite-startup-dev.sh --kill-ports       # Kill stale processes
#   ./agi-suite-startup-dev.sh status              # Check status
#   ./agi-suite-startup-dev.sh logs                # Tail logs
#   ./agi-suite-startup-dev.sh --api-only          # Start just API
#   ./agi-suite-startup-dev.sh --frontend-only     # Start just frontend
################################################################################

set -o pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}" && git rev-parse --show-toplevel 2>/dev/null || echo "$(pwd)")"

# Development ports (actual ports used)
API_PORT=3001
FRONTEND_BASE_PORT=5176
LOGS_DIR="${PROJECT_ROOT}/logs"
PID_DIR="${PROJECT_ROOT}/.pids"
DEV_PID_FILE="${PID_DIR}/dev.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ══════════════════════════════════════════════════════════════════════════════
# Logging
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

find_process_on_port() {
  local port=$1
  ss -tlnp 2>/dev/null | grep ":${port}" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1
}

port_in_use() {
  local port=$1
  ss -tlnp 2>/dev/null | grep ":${port}" >/dev/null 2>&1
}

is_running() {
  local pid=$1
  if [[ -z "$pid" ]]; then
    return 1
  fi
  kill -0 "$pid" 2>/dev/null
}

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

kill_process() {
  local pid=$1
  local name=$2
  
  if ! is_running "$pid"; then
    return 0
  fi
  
  log_info "Terminating $name (PID: $pid)..."
  kill -TERM "$pid" 2>/dev/null || true
  
  local elapsed=0
  while [[ $elapsed -lt 5 ]] && is_running "$pid"; do
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

ensure_dirs() {
  mkdir -p "$LOGS_DIR"
  mkdir -p "$PID_DIR"
}

clear_ports() {
  local ports=(3001 5176 5177 5178)
  
  for port in "${ports[@]}"; do
    if pid=$(find_process_on_port "$port"); then
      log_warn "Found process on port $port (PID: $pid), killing..."
      kill_process "$pid" "Process on port $port" || true
    fi
  done
  
  sleep 1
}

# ══════════════════════════════════════════════════════════════════════════════
# Check Functions
# ══════════════════════════════════════════════════════════════════════════════

check_api_health() {
  # Try the health endpoint (adjust if needed)
  curl -sf http://localhost:3001/health >/dev/null 2>&1 || \
  curl -sf http://localhost:3001/ >/dev/null 2>&1
}

find_frontend_port() {
  # Find which port the frontend is actually using
  local ports=(5176 5177 5178 5179)
  
  for port in "${ports[@]}"; do
    if port_in_use "$port"; then
      echo "$port"
      return 0
    fi
  done
  
  echo "unknown"
}

# ══════════════════════════════════════════════════════════════════════════════
# Start Development Mode
# ══════════════════════════════════════════════════════════════════════════════

start_dev() {
  log_info "Starting Agi-Suite in development mode..."
  log_info "Using: pnpm dev (concurrently)"
  log_info "This runs with live reload enabled"
  echo ""
  
  # Check if already running
  if pid=$(get_saved_pid "$DEV_PID_FILE"); then
    log_warn "Development mode already running (PID: $pid)"
    return 0
  fi
  
  # Kill any stale processes on these ports
  log_info "Clearing stale processes..."
  clear_ports
  
  ensure_dirs
  > "$LOGS_DIR/dev.log"
  
  # Start pnpm dev
  cd "$PROJECT_ROOT"
  (
    nohup pnpm dev >> "$LOGS_DIR/dev.log" 2>&1 &
    echo $! > "$DEV_PID_FILE"
  )
  
  sleep 1
  
  if ! pid=$(get_saved_pid "$DEV_PID_FILE"); then
    log_error "Failed to start pnpm dev"
    log_error "Recent logs:"
    tail -20 "$LOGS_DIR/dev.log" | sed 's/^/  /'
    die "Startup failed"
  fi
  
  log_success "Development server started (PID: $pid)"
  
  # Wait for services to be ready
  log_info "Waiting for services to start..."
  local elapsed=0
  while [[ $elapsed -lt 30 ]]; do
    # Check if API is listening
    if port_in_use 3001; then
      log_success "API ready on port 3001"
      break
    fi
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
  
  # Find where frontend ended up
  local frontend_port=$(find_frontend_port)
  if [[ "$frontend_port" != "unknown" ]]; then
    log_success "Frontend ready on port $frontend_port"
  fi
  
  echo ""
  log_success "Services started!"
  echo "  API: http://localhost:3001"
  echo "  Frontend: http://localhost:$frontend_port"
  echo ""
  echo "$(Yellow)Live reload enabled — edit files to see changes automatically!$(NC)"
}

start_api_only() {
  log_info "Starting API only..."
  ensure_dirs
  > "$LOGS_DIR/dev.log"
  
  cd "$PROJECT_ROOT/apps/api-server"
  (
    nohup pnpm dev >> "$LOGS_DIR/dev.log" 2>&1 &
    echo $! > "$DEV_PID_FILE"
  )
  
  sleep 1
  
  if pid=$(get_saved_pid "$DEV_PID_FILE"); then
    log_success "API started (PID: $pid)"
    log_info "API: http://localhost:3001"
  else
    die "Failed to start API"
  fi
}

start_frontend_only() {
  log_info "Starting Frontend only..."
  ensure_dirs
  > "$LOGS_DIR/dev.log"
  
  cd "$PROJECT_ROOT/apps/r3-agi"
  (
    nohup pnpm dev >> "$LOGS_DIR/dev.log" 2>&1 &
    echo $! > "$DEV_PID_FILE"
  )
  
  sleep 1
  
  if pid=$(get_saved_pid "$DEV_PID_FILE"); then
    log_success "Frontend started (PID: $pid)"
    local port=$(find_frontend_port)
    log_info "Frontend: http://localhost:$port"
  else
    die "Failed to start frontend"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Stop
# ══════════════════════════════════════════════════════════════════════════════

stop_dev() {
  log_info "Stopping development services..."
  
  if pid=$(get_saved_pid "$DEV_PID_FILE"); then
    kill_process "$pid" "Development server"
    rm -f "$DEV_PID_FILE"
  else
    log_info "Development server is not running"
  fi
  
  # Also try to clean up any stale processes
  clear_ports || true
}

# ══════════════════════════════════════════════════════════════════════════════
# Status
# ══════════════════════════════════════════════════════════════════════════════

status_dev() {
  echo ""
  echo "Development Server Status:"
  echo "─────────────────────────────────────"
  
  if pid=$(get_saved_pid "$DEV_PID_FILE"); then
    echo -e "${GREEN}✓${NC} Development server running (PID: $pid)"
  else
    echo -e "${RED}✗${NC} Development server not running"
  fi
  
  # Check ports
  if port_in_use 3001; then
    echo -e "${GREEN}✓${NC} API (http://localhost:3001)"
  else
    echo -e "${RED}✗${NC} API (port 3001 not in use)"
  fi
  
  local frontend_port=$(find_frontend_port)
  if [[ "$frontend_port" != "unknown" ]]; then
    echo -e "${GREEN}✓${NC} Frontend (http://localhost:$frontend_port)"
  else
    echo -e "${RED}✗${NC} Frontend (ports not in use)"
  fi
  
  echo "─────────────────────────────────────"
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# Logs
# ══════════════════════════════════════════════════════════════════════════════

show_logs() {
  ensure_dirs
  log_info "Tailing development logs (Ctrl+C to stop)..."
  tail -f "$LOGS_DIR/dev.log"
}

# ══════════════════════════════════════════════════════════════════════════════
# Help
# ══════════════════════════════════════════════════════════════════════════════

show_usage() {
  cat << EOF
Agi-Suite Development Startup Script

Usage: $0 [COMMAND]

Commands:
  (default)              Start both API and frontend with live reload
  --api-only             Start only the API server
  --frontend-only        Start only the frontend
  status                 Show service status
  logs                   Tail development logs
  stop                   Stop all services
  kill-ports             Kill stale processes on dev ports
  help                   Show this help message

Details:

This script starts your development environment using 'pnpm dev':
  • API runs on port 3001 with tsx watch (live reload)
  • Frontend runs on port 5176+ with vite (live reload)
  • Both services auto-restart when you edit files

Quick Tips:
  • Edit files in apps/api-server/src or apps/r3-agi/src
  • Changes automatically reload in browser
  • Check logs with: $0 logs
  • Stop with: Ctrl+C or $0 stop

Examples:
  $0                     # Start everything
  $0 status              # Check what's running
  $0 logs                # View live logs
  $0 kill-ports          # Clear stale processes
  $0 stop                # Stop all services

EOF
}

# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

COMMAND="${1:-start}"

case "${COMMAND,,}" in
  start|dev)
    start_dev
    ;;
  --api-only|api)
    start_api_only
    ;;
  --frontend-only|frontend)
    start_frontend_only
    ;;
  status)
    status_dev
    ;;
  logs|log)
    show_logs
    ;;
  stop|shutdown)
    stop_dev
    ;;
  kill-ports|clean)
    log_info "Clearing stale processes..."
    clear_ports
    log_success "Ports cleared"
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
