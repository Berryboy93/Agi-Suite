# Agi-Suite v2.0 Setup Guide

## Prerequisites

Before starting, ensure you have:

- **Node.js** v18+ ([download](https://nodejs.org/))
- **pnpm** v8+ (`npm install -g pnpm`)
- **Git** ([download](https://git-scm.com/))
- **Docker** (optional, for production deployment)

Verify installations:

```bash
node --version    # v18+
pnpm --version    # v8+
git --version     # any recent version
```

## Quick Start (Automated)

The fastest way to get started:

```bash
cd ~/Agi-Suite
chmod +x quick-setup.sh
./quick-setup.sh
```

Follow the prompts to select **development** or **production** mode. The script will:

1. Check prerequisites
2. Install all dependencies
3. Build (for production)
4. Display next steps

## Manual Setup

### 1. Install Dependencies

```bash
cd ~/Agi-Suite
pnpm install
```

### 2. Development Mode

For local development with live reload (Vite HMR):

```bash
make dev
```

This runs:

- **API Server**: `tsx watch` on port 3001
- **Frontend**: Vite dev server with hot reload
- Available at: `http://localhost:3001`

### 3. Production Mode

For optimized, production-ready build:

```bash
# Build first (compiles TypeScript, bundles frontend)
pnpm run build

# Then start
make prod-start
```

Or in one command:

```bash
make setup-prod && make prod-start
```

- Available at: `http://localhost:3000`
- Optimized bundle sizes
- No source maps in assets

## Project Structure

```
Agi-Suite/
├── apps/
│   ├── api-server/        # Express + tRPC backend
│   └── r3-agi/            # Vite + React frontend
├── lib/
│   ├── api-client-react/  # Generated API client
│   ├── api-spec/          # OpenAPI specs + Orval
│   ├── api-zod/           # Zod validation schemas
│   └── db/                # Drizzle ORM + migrations
├── docs/                  # Documentation
├── scripts/               # Utility scripts
├── agi-suite-startup.sh   # Production startup script
├── agi-suite-startup-dev.sh # Development startup script
├── Makefile               # Task automation
└── quick-setup.sh         # Automated setup
```

## Common Tasks

| Task                  | Command           |
| --------------------- | ----------------- |
| Start development     | `make dev`        |
| Start production      | `make prod-start` |
| Stop services         | `make stop`       |
| View logs             | `make logs`       |
| Install dependencies  | `make install`    |
| Clean build artifacts | `make clean`      |
| Type check            | `pnpm typecheck`  |
| Format code           | `pnpm format`     |
| Run tests             | `pnpm test`       |

## Environment Variables

Create a `.env.local` file in the repository root:

```bash
# API Configuration
API_PORT=3001
API_HOST=localhost

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/agi_suite

# Frontend
VITE_API_URL=http://localhost:3001/api

# Auth (if using)
JWT_SECRET=your-secret-key-here
```

See `.env.example` for all available options.

## Database Setup

Initialize or update the database:

```bash
# Install dependencies (includes Drizzle CLI)
pnpm install

# Run pending migrations
pnpm run db:migrate

# Seed data (if available)
pnpm run db:seed
```

## Troubleshooting

### Port Already in Use

If port 3001 (dev) or 3000 (prod) is already in use:

```bash
# Find and kill process on port 3001
lsof -i :3001
kill -9 <PID>
```

### Dependencies Won't Install

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall from scratch
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors

```bash
# Rebuild TypeScript
pnpm typecheck

# Clear build cache
make clean
pnpm install
```

### API Connection Errors

1. Verify `VITE_API_URL` matches your API_PORT
2. Check that API server is running: `lsof -i :3001`
3. Check browser console for CORS issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more solutions.

## Next Steps

1. **Development**: Read [DEV-VS-PROD.md](./DEV-VS-PROD.md) for workflow tips
2. **API**: Check [docs/API.md](./docs/API.md) for endpoint documentation
3. **Architecture**: Review [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. **Contributing**: See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

## Getting Help

- Check existing issues: `git log --oneline | head -20`
- Review logs: `make logs`
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Open an issue on GitHub

---

**Version**: 2.0  
**Last Updated**: May 2026  
**Maintainer**: R3 Development Team
