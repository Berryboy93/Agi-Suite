#!/bin/bash

# Agi-Suite v2.0 Quick Setup Script
# Automates initial setup for both development and production environments

set -e

COLOR_RESET='\033[0m'
COLOR_BLUE='\033[0;34m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'

log_info() {
    echo -e "${COLOR_BLUE}ℹ${COLOR_RESET} $1"
}

log_success() {
    echo -e "${COLOR_GREEN}✓${COLOR_RESET} $1"
}

log_warn() {
    echo -e "${COLOR_YELLOW}⚠${COLOR_RESET} $1"
}

log_error() {
    echo -e "${COLOR_RED}✗${COLOR_RESET} $1"
}

check_prerequisite() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is not installed"
        return 1
    fi
    log_success "$1 found"
}

main() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║   Agi-Suite v2.0 Quick Setup Script    ║"
    echo "╚════════════════════════════════════════╝"
    echo ""

    # Check prerequisites
    log_info "Checking prerequisites..."
    check_prerequisite "node" || exit 1
    check_prerequisite "pnpm" || {
        log_warn "pnpm not found, installing..."
        npm install -g pnpm
    }
    check_prerequisite "git" || exit 1

    echo ""

    # Ask for setup mode
    log_info "Select setup mode:"
    echo "  1) Development (live reload, tsx watch, port 3001)"
    echo "  2) Production (optimized build, port 3000)"
    read -p "Enter choice [1-2]: " MODE_CHOICE

    case $MODE_CHOICE in
        1)
            MODE="dev"
            ;;
        2)
            MODE="prod"
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac

    echo ""
    log_info "Setting up for $MODE mode..."

    # Install dependencies
    log_info "Installing dependencies..."
    pnpm install || {
        log_error "Dependency installation failed"
        exit 1
    }
    log_success "Dependencies installed"

    # Build for production if needed
    if [ "$MODE" = "prod" ]; then
        log_info "Building for production..."
        pnpm run build || {
            log_error "Production build failed"
            exit 1
        }
        log_success "Production build complete"
    fi

    # Create logs directory
    mkdir -p logs
    log_success "Logs directory ready"

    # Make startup scripts executable
    chmod +x agi-suite-startup.sh 2>/dev/null || true
    chmod +x agi-suite-startup-dev.sh 2>/dev/null || true
    log_success "Startup scripts are executable"

    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║      Setup Complete! Next Steps:       ║"
    echo "╚════════════════════════════════════════╝"
    echo ""

    if [ "$MODE" = "dev" ]; then
        log_success "Start development with:"
        echo "  ${COLOR_BLUE}make dev${COLOR_RESET}"
        echo ""
        echo "The application will be available at:"
        echo "  ${COLOR_BLUE}http://localhost:3001${COLOR_RESET}"
    else
        log_success "Start production with:"
        echo "  ${COLOR_BLUE}make prod-start${COLOR_RESET}"
        echo ""
        echo "The application will be available at:"
        echo "  ${COLOR_BLUE}http://localhost:3000${COLOR_RESET}"
    fi

    echo ""
    log_info "Useful commands:"
    echo "  ${COLOR_BLUE}make help${COLOR_RESET}       Show all available commands"
    echo "  ${COLOR_BLUE}make logs${COLOR_RESET}       Tail service logs"
    echo "  ${COLOR_BLUE}make stop${COLOR_RESET}       Stop all services"
    echo ""
}

main "$@"
