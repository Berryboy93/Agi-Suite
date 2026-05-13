.PHONY: help dev dev-logs prod-build prod-start stop status logs clean install test lint format setup

# Colors
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "$(BLUE)Agi-Suite Development & Production$(NC)"
	@echo ""
	@echo "$(GREEN)Quick Start:$(NC)"
	@echo "  make dev              Start in development mode (live reload)"
	@echo "  make prod-build       Build for production"
	@echo "  make prod-start       Start production build"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev              Start with live reload (pnpm dev)"
	@echo "  make dev-logs         Tail development logs"
	@echo "  make dev-clean        Kill stale dev processes"
	@echo "  make dev-status       Check dev server status"
	@echo ""
	@echo "$(GREEN)Production:$(NC)"
	@echo "  make prod-build       Build all projects for production"
	@echo "  make prod-start       Start production builds"
	@echo "  make prod-stop        Stop production services"
	@echo "  make prod-status      Check production status"
	@echo ""
	@echo "$(GREEN)General:$(NC)"
	@echo "  make setup            Install dependencies (first time)"
	@echo "  make test             Run all tests"
	@echo "  make lint             Run ESLint"
	@echo "  make format           Format code with Prettier"
	@echo "  make clean            Clean build artifacts"
	@echo "  make stop             Stop all services"
	@echo "  make logs             Tail all logs"
	@echo ""
	@echo "$(YELLOW)Ports:$(NC)"
	@echo "  Development: API on 3001, Frontend on 5176+"
	@echo "  Production: API on 3000, Frontend on 5173"
	@echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Development Commands (Live Reload)
# ══════════════════════════════════════════════════════════════════════════════

dev: ## Start in development mode (live reload)
	@echo "$(BLUE)Starting development mode...$(NC)"
	@echo "$(YELLOW)This will run with live reload enabled$(NC)"
	@echo ""
	@chmod +x agi-suite-startup-dev.sh
	@./agi-suite-startup-dev.sh start
	@echo ""
	@echo "$(GREEN)✓ Tip: Edit files in apps/api-server/src or apps/r3-agi/src$(NC)"
	@echo "$(GREEN)✓ Changes will reload automatically$(NC)"
	@echo "$(GREEN)✓ View logs: make dev-logs$(NC)"

dev-logs: ## Tail development logs (Ctrl+C to stop)
	@chmod +x agi-suite-startup-dev.sh
	@./agi-suite-startup-dev.sh logs

dev-status: ## Check development server status
	@chmod +x agi-suite-startup-dev.sh
	@./agi-suite-startup-dev.sh status

dev-clean: ## Kill stale development processes
	@echo "$(BLUE)Clearing stale development processes...$(NC)"
	@chmod +x agi-suite-startup-dev.sh
	@./agi-suite-startup-dev.sh kill-ports

# ══════════════════════════════════════════════════════════════════════════════
# Production Commands (Compiled Build)
# ══════════════════════════════════════════════════════════════════════════════

prod-build: ## Build all projects for production
	@echo "$(BLUE)Building for production...$(NC)"
	@pnpm build
	@echo "$(GREEN)✓ Build complete$(NC)"

prod-start: prod-build ## Build and start production services
	@echo "$(BLUE)Starting production services...$(NC)"
	@chmod +x agi-suite-startup.sh
	@./agi-suite-startup.sh start

prod-stop: ## Stop production services
	@echo "$(BLUE)Stopping production services...$(NC)"
	@chmod +x agi-suite-startup.sh
	@./agi-suite-startup.sh stop

prod-status: ## Check production service status
	@chmod +x agi-suite-startup.sh
	@./agi-suite-startup.sh status

# ══════════════════════════════════════════════════════════════════════════════
# General Commands
# ══════════════════════════════════════════════════════════════════════════════

setup: ## Install dependencies and prepare project
	@echo "$(BLUE)Setting up project...$(NC)"
	@echo "  Installing dependencies..."
	@pnpm install
	@echo "  Creating required directories..."
	@mkdir -p logs .pids
	@echo "$(GREEN)✓ Setup complete!$(NC)"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  Development: $(GREEN)make dev$(NC)"
	@echo "  Production:  $(GREEN)make prod-start$(NC)"

test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	@pnpm test
	@echo "$(GREEN)✓ Tests passed!$(NC)"

lint: ## Run ESLint
	@echo "$(BLUE)Linting code...$(NC)"
	@pnpm lint
	@echo "$(GREEN)✓ No lint errors!$(NC)"

format: ## Format code with Prettier
	@echo "$(BLUE)Formatting code...$(NC)"
	@pnpm format
	@echo "$(GREEN)✓ Code formatted!$(NC)"

clean: ## Clean all build artifacts and logs
	@echo "$(YELLOW)Cleaning artifacts...$(NC)"
	@rm -rf apps/api-server/dist
	@rm -rf apps/r3-agi/dist
	@rm -rf logs/*
	@echo "$(GREEN)✓ Cleaned!$(NC)"

stop: ## Stop all running services
	@echo "$(BLUE)Stopping all services...$(NC)"
	@chmod +x agi-suite-startup-dev.sh agi-suite-startup.sh
	@./agi-suite-startup-dev.sh stop
	@./agi-suite-startup.sh stop
	@echo "$(GREEN)✓ All services stopped$(NC)"

logs: ## Tail all available logs
	@echo "$(BLUE)Checking for logs...$(NC)"
	@if [ -f logs/dev.log ]; then \
		echo "$(YELLOW)Development logs:$(NC)"; \
		tail -f logs/dev.log; \
	elif [ -f logs/api.log ]; then \
		echo "$(YELLOW)API logs:$(NC)"; \
		tail -f logs/api.log; \
	else \
		echo "$(RED)No logs found$(NC)"; \
		exit 1; \
	fi

status: ## Show status of all services
	@echo "$(BLUE)Checking service status...$(NC)"
	@chmod +x agi-suite-startup-dev.sh agi-suite-startup.sh
	@echo ""
	@echo "$(YELLOW)Development Status:$(NC)"
	@./agi-suite-startup-dev.sh status
	@echo "$(YELLOW)Production Status:$(NC)"
	@./agi-suite-startup.sh status

# ══════════════════════════════════════════════════════════════════════════════
# Utility Commands
# ══════════════════════════════════════════════════════════════════════════════

env-check: ## Validate environment setup
	@echo "$(BLUE)Checking environment...$(NC)"
	@which node > /dev/null && echo "$(GREEN)✓$(NC) Node.js is installed ($(shell node --version))" || echo "$(RED)✗$(NC) Node.js not found"
	@which pnpm > /dev/null && echo "$(GREEN)✓$(NC) pnpm is installed ($(shell pnpm --version))" || echo "$(RED)✗$(NC) pnpm not found"
	@test -d apps/api-server && echo "$(GREEN)✓$(NC) API directory exists" || echo "$(RED)✗$(NC) API directory missing"
	@test -d apps/r3-agi && echo "$(GREEN)✓$(NC) Frontend directory exists" || echo "$(RED)✗$(NC) Frontend directory missing"
	@test -f agi-suite-startup.sh && echo "$(GREEN)✓$(NC) Production startup script exists" || echo "$(RED)✗$(NC) Production script missing"
	@test -f agi-suite-startup-dev.sh && echo "$(GREEN)✓$(NC) Development startup script exists" || echo "$(RED)✗$(NC) Development script missing"
	@echo ""

check-ports: ## Check which services are using service ports
	@echo "$(BLUE)Checking ports...$(NC)"
	@echo "$(YELLOW)Development Ports:$(NC)"
	@ss -tlnp 2>/dev/null | grep -E ":3001|:517[6-9]" || echo "  Not in use"
	@echo "$(YELLOW)Production Ports:$(NC)"
	@ss -tlnp 2>/dev/null | grep -E ":3000|:5173" || echo "  Not in use"

kill-all-ports: ## Force kill processes on all service ports
	@echo "$(RED)Force killing processes on service ports...$(NC)"
	@pkill -f "node" || true
	@pkill -f "vite" || true
	@pkill -f "pnpm dev" || true
	@sleep 1
	@echo "$(GREEN)✓ Ports cleared!$(NC)"

info: ## Show project information
	@echo "$(BLUE)Agi-Suite Project Information$(NC)"
	@echo ""
	@echo "$(YELLOW)Mode Comparison:$(NC)"
	@echo ""
	@echo "  $(GREEN)Development (make dev)$(NC)"
	@echo "    • Live reload enabled (tsx watch + vite)"
	@echo "    • API port: 3001"
	@echo "    • Frontend port: 5176+"
	@echo "    • Best for: Active development"
	@echo "    • Start: make dev"
	@echo ""
	@echo "  $(BLUE)Production (make prod-start)$(NC)"
	@echo "    • Compiled build (optimized)"
	@echo "    • API port: 3000"
	@echo "    • Frontend port: 5173"
	@echo "    • Best for: Testing, deployment"
	@echo "    • Start: make prod-start"
	@echo ""
	@echo "$(YELLOW)Project Structure:$(NC)"
	@echo "  API:      apps/api-server/"
	@echo "  Frontend: apps/r3-agi/"
	@echo "  Logs:     logs/"
	@echo "  PIDs:     .pids/"
	@echo ""

# Special targets
.SILENT: help
.PHONY: $(MAKECMDGOALS)
