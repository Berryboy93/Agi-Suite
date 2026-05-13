#!/usr/bin/env bash

################################################################################
# Agi-Suite Startup Script (Unified Dev + Prod)
# 
# Consolidates agi-suite-startup-dev.sh and agi-suite-startup.sh into one script.
# Supports both development (live reload) and production modes.
#
# Usage:
#   ./agi-suite-startup.sh                      # Start with dev defaults
#   ./agi-suite-startup.sh --mode prod          # Start in production
#   ./agi-suite-startup.sh --mode dev --kill-ports
#   ./agi-suite-startup.sh status               # Check service status
#   ./agi-suite-startup.sh stop                 # Stop all services
#   ./agi-suite-startup.sh logs [api|frontend|both]
#
# Modes:
#   dev:  API on 3001 (tsx watch), Frontend on 5176+ (vite HMR)
#   prod: API on 3000 (node dist), Frontend on 5174 (static)
#
################################################################################

set -o pipefail

# ══════════════════════════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}" && git rev-parse --show-toplevel 2>/dev/null || echo "${SCRIPT_DIR}")"

# Default mode and command (will be overridden by argument parsing in main())
MODE="dev"
COMMAND="start"

# Service directories (monorepo structure)
API_DIR="${PROJECT_ROOT}/apps/api-server"
FRONTEND_DIR="${PROJECT_ROOT}/apps/r3-agi"
LOGS_DIR="${PROJECT_ROOT}/.logs"

# Create logs directory if missing
mkdir -p "${LOGS_DIR}"

# Mode-specific configuration
if [[ "${MODE}" == "prod" ]]; then
  API_PORT=3000
  FRONTEND_PORT=5174
  API_COMMAND="node dist/index.js"
  API_LOG="${LOGS_DIR}/api.prod.log"
  FRONTEND_LOG="${LOGS_DIR}/frontend.prod.log"
  MODE_LABEL="PRODUCTION"
else
  # Default to dev mode
  MODE="dev"
  API_PORT=3001
  FRONTEND_PORT=5176
  API_COMMAND="tsx watch --ignore ./client --ignore ./node_modules index.ts"
  API_LOG="${LOGS_DIR}/api.dev.log"
  FRONTEND_LOG="${LOGS_DIR}/frontend.dev.log"
  MODE_LABEL="DEVELOPMENT"
fi

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
log_error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ══════════════════════════════════════════════════════════════════════════════
# Preconditions
# ══════════════════════════════════════════════════════════════════════════════

precondition_check() {
  log_info "Checking preconditions..."
  
  # Check directories exist
  [[ -d "${API_DIR}" ]] || log_error "API directory not found: ${API_DIR}"
  [[ -d "${FRONTEND_DIR}" ]] || log_error "Frontend directory not found: ${FRONTEND_DIR}"
  
  # Check package.json files exist
  [[ -f "${API_DIR}/package.json" ]] || log_error "No package.json in ${API_DIR}"
  [[ -f "${FRONTEND_DIR}/package.json" ]] || log_error "No package.json in ${FRONTEND_DIR}"
  
  # Check git repo
  [[ -d "${PROJECT_ROOT}/.git" ]] || log_error "Not a git repository: ${PROJECT_ROOT}"
  
  log_success "Preconditions passed"
}

# ══════════════════════════════════════════════════════════════════════════════
# Core Functions
# ══════════════════════════════════════════════════════════════════════════════

start_services() {
  log_info "Starting ${MODE_LABEL} mode services..."
  
  if [[ "${MODE}" == "prod" ]]; then
    # Production: ensure build is fresh
    log_info "Building for production..."
    cd "${API_DIR}"
    npm run build || log_error "API build failed"
    cd "${FRONTEND_DIR}"
    npm run build || log_error "Frontend build failed"
  fi
  
  # Start API
  log_info "Starting API on port ${API_PORT}..."
  cd "${API_DIR}"
  nohup bash -c "${API_COMMAND}" > "${API_LOG}" 2>&1 &
  API_PID=$!
  echo "${API_PID}" > "${LOGS_DIR}/api.pid"
  log_success "API started (PID: ${API_PID})"
  
  # Wait for API to be ready
  log_info "Waiting for API to become ready..."
  for i in {1..30}; do
    if curl -s "http://localhost:${API_PORT}/health" > /dev/null 2>&1; then
      log_success "API is ready"
      break
    fi
    if [[ $i -eq 30 ]]; then
      log_warn "API health check timeout (this may be OK if service is starting)"
    fi
    sleep 1
  done
  
  # Start Frontend
  log_info "Starting Frontend on port ${FRONTEND_PORT}..."
  cd "${FRONTEND_DIR}"
  if [[ "${MODE}" == "dev" ]]; then
    nohup npm run dev > "${FRONTEND_LOG}" 2>&1 &
  else
    nohup npm run serve > "${FRONTEND_LOG}" 2>&1 &
  fi
  FRONTEND_PID=$!
  echo "${FRONTEND_PID}" > "${LOGS_DIR}/frontend.pid"
  log_success "Frontend started (PID: ${FRONTEND_PID})"
  
  # Print access info
  echo
  log_success "══════════════════════════════════════════════════════════════"
  log_success "Services running in ${MODE_LABEL} mode"
  log_success "API:      http://localhost:${API_PORT}"
  log_success "Frontend: http://localhost:${FRONTEND_PORT}"
  log_success "══════════════════════════════════════════════════════════════"
  echo
}

stop_services() {
  log_info "Stopping services..."
  
  # Stop API
  if [[ -f "${LOGS_DIR}/api.pid" ]]; then
    API_PID=$(cat "${LOGS_DIR}/api.pid")
    if kill -0 "${API_PID}" 2>/dev/null; then
      kill "${API_PID}"
      log_success "Stopped API (PID: ${API_PID})"
    fi
    rm -f "${LOGS_DIR}/api.pid"
  fi
  
  # Stop Frontend
  if [[ -f "${LOGS_DIR}/frontend.pid" ]]; then
    FRONTEND_PID=$(cat "${LOGS_DIR}/frontend.pid")
    if kill -0 "${FRONTEND_PID}" 2>/dev/null; then
      kill "${FRONTEND_PID}"
      log_success "Stopped Frontend (PID: ${FRONTEND_PID})"
    fi
    rm -f "${LOGS_DIR}/frontend.pid"
  fi
  
  # Kill any remaining processes on our ports
  log_info "Cleaning up lingering processes..."
  lsof -ti:${API_PORT} | xargs kill -9 2>/dev/null || true
  lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
  
  log_success "Services stopped"
}

status_services() {
  log_info "Service status:"
  echo
  
  # API status
  if [[ -f "${LOGS_DIR}/api.pid" ]]; then
    API_PID=$(cat "${LOGS_DIR}/api.pid")
    if kill -0 "${API_PID}" 2>/dev/null; then
      log_success "API (PID ${API_PID}) is running on port ${API_PORT}"
    else
      log_warn "API (PID ${API_PID}) is NOT running"
    fi
  else
    log_warn "API: no PID file found"
  fi
  
  # Frontend status
  if [[ -f "${LOGS_DIR}/frontend.pid" ]]; then
    FRONTEND_PID=$(cat "${LOGS_DIR}/frontend.pid")
    if kill -0 "${FRONTEND_PID}" 2>/dev/null; then
      log_success "Frontend (PID ${FRONTEND_PID}) is running on port ${FRONTEND_PORT}"
    else
      log_warn "Frontend (PID ${FRONTEND_PID}) is NOT running"
    fi
  else
    log_warn "Frontend: no PID file found"
  fi
  
  echo
}

logs_services() {
  local service="${1:-both}"
  
  case "${service}" in
    api)
      log_info "Tailing API logs (${API_LOG})..."
      tail -f "${API_LOG}"
      ;;
    frontend)
      log_info "Tailing Frontend logs (${FRONTEND_LOG})..."
      tail -f "${FRONTEND_LOG}"
      ;;
    both)
      log_info "Tailing both logs (Ctrl+C to exit)..."
      tail -f "${API_LOG}" "${FRONTEND_LOG}"
      ;;
    *)
      log_error "Unknown service: ${service}. Use: api, frontend, both"
      ;;
  esac
}

kill_ports() {
  log_warn "Force-killing processes on ports ${API_PORT} and ${FRONTEND_PORT}..."
  lsof -ti:${API_PORT} | xargs kill -9 2>/dev/null || log_warn "Nothing on port ${API_PORT}"
  lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || log_warn "Nothing on port ${FRONTEND_PORT}"
  log_success "Ports cleared"
}

# ══════════════════════════════════════════════════════════════════════════════
# Command Router
# ══════════════════════════════════════════════════════════════════════════════

main() {
  # Parse flags
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --mode)
        MODE="$2"
        shift 2
        ;;
      --kill-ports)
        kill_ports
        exit 0
        ;;
      start|stop|status|logs)
        COMMAND="$1"
        shift
        ;;
      *)
        shift
        ;;
    esac
  done
  
  # Ensure defaults are set (in case no args were provided)
  MODE="${MODE:-dev}"
  COMMAND="${COMMAND:-start}"
  
  # Validate mode
  if [[ "${MODE}" != "dev" && "${MODE}" != "prod" ]]; then
    log_error "Invalid mode: ${MODE}. Use: dev or prod"
  fi
  
  # Execute command
  case "${COMMAND}" in
    start)
      precondition_check
      start_services
      ;;
    stop)
      stop_services
      ;;
    status)
      status_services
      ;;
    logs)
      logs_services "${@}"
      ;;
    *)
      log_error "Unknown command: ${COMMAND}. Use: start, stop, status, logs"
      ;;
  esac
}

main "$@"
