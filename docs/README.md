# Agi-Suite

> AI-native engineering command center for the R3 v4 project.

Agi-Suite is a self-hosted, browser-based operations dashboard that provides live monitoring, AI-assisted development tooling, and system control for the R3 v4 Digital Audio Workstation platform. It is purpose-built for solo development — everything in one place, zero context-switching.

---

## What it is

A two-artifact monorepo workspace:

| Artifact     | Role                                                            |
| ------------ | --------------------------------------------------------------- |
| `r3-agi`     | React frontend — multi-panel dashboard UI                       |
| `api-server` | Express backend — metrics, SSE streaming, Anthropic agent proxy |

Backed by a shared library layer (`lib/`) that enforces type-safe contracts between the frontend, backend, and database.

---

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL database (local or Railway-provisioned)

### Setup

```bash
git clone https://github.com/Berryboy93/r3v4.git
cd r3v4/Agi-Suite   # or wherever the workspace root lives
pnpm install
```

Create `.env` in `artifacts/api-server/`:

```env
PORT=8080
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NODE_ENV=development
```

### Run

```bash
pnpm dev
```

This starts both services concurrently:

| Service                | URL                   |
| ---------------------- | --------------------- |
| Frontend (Vite)        | http://localhost:5173 |
| API server (tsx watch) | http://localhost:8080 |

### Other commands

```bash
pnpm typecheck      # TypeScript check across all packages
pnpm test           # Vitest across all lib packages
pnpm test:watch     # Vitest in watch mode
pnpm build          # Production build (typecheck + all packages)
```

---

## Workspace layout

```
Agi-Suite/
├── artifacts/
│   ├── api-server/         # Express backend
│   ├── r3-agi/             # React 19 frontend
│   └── mockup-sandbox/     # UI component development sandbox
├── lib/
│   ├── api-spec/           # OpenAPI spec (source of truth)
│   ├── api-zod/            # Generated Zod validators
│   ├── api-client-react/   # Generated React Query hooks
│   └── db/                 # Drizzle ORM + PostgreSQL schema
├── scripts/                # Workspace tooling scripts
├── .simple-git-hooks.json  # Git hook definitions
├── .prettierignore         # Prettier exclusions
├── vitest.workspace.ts     # Vitest monorepo config
├── pnpm-workspace.yaml     # Workspace + catalog config
└── WORKSPACE.md            # Engineering conventions
```

---

## Documentation

| Document                             | Contents                                |
| ------------------------------------ | --------------------------------------- |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, package graph |
| [API Reference](docs/API.md)         | All endpoints, request/response shapes  |
| [Development](docs/DEVELOPMENT.md)   | Workflow, conventions, tooling          |
| [Deployment](docs/DEPLOYMENT.md)     | Railway deployment, environment config  |
| [Roadmap](docs/ROADMAP.md)           | Planned upgrades and future state       |
