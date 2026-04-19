# Development

## Environment setup

### System requirements

- Node.js 22+ (`node --version`)
- pnpm 10+ (`pnpm --version`)
- PostgreSQL 14+ (local or remote)
- Git

### First-time setup

```bash
git clone https://github.com/Berryboy93/r3v4.git
cd Agi-Suite

# Install all workspace dependencies
# This also runs the prepare script which installs git hooks
pnpm install

# Approve simple-git-hooks build script (required once after initial install)
pnpm approve-builds
# Select simple-git-hooks when prompted
```

### Environment variables

Create `apps/api-server/.env`:

```env
# Required
PORT=3001
ANTHROPIC_API_KEY=sk-ant-api03-...
DATABASE_URL=postgresql://user:password@localhost:5432/agi_suite

# Optional
NODE_ENV=development
LOG_LEVEL=info
```

The `api-server` loads this file via Node's built-in `--env-file` flag (Node 22+). No `dotenv` package required.

---

## Daily workflow

### Starting the dev server

```bash
pnpm dev
```

Both services start concurrently via `concurrently`:

- `[api]` — `tsx watch src/index.ts` on port 3001. Restarts instantly on any source change in `apps/api-server/src/`. No build step.
- `[agi]` — Vite dev server on port 5173 with HMR.

### Making API server changes

Edit any file in `apps/api-server/src/`. The tsx watcher detects the change and restarts the server in under a second. No manual restart needed.

### Making frontend changes

Edit any file in `apps/r3-agi/src/`. Vite's HMR updates the browser without a page reload for component changes.

### Adding a new API endpoint

1. Add the endpoint to `lib/api-spec/openapi.yaml`
2. Run the code generator: `pnpm --filter @workspace/api-spec generate`
3. The updated Zod types and React Query hooks are generated automatically
4. Implement the route in `apps/api-server/src/routes/`
5. Register it in `apps/api-server/src/routes/index.ts`

This keeps the contract as the single source of truth.

### Database schema changes

```bash
# 1. Edit lib/db/src/schema/index.ts

# 2. Generate a migration file
pnpm --filter @workspace/db generate

# 3. Review the generated file in lib/db/drizzle/

# 4. Commit the migration file with your schema change
git add lib/db/drizzle/ lib/db/src/schema/
git commit -m 'feat(db): add sessions table'

# 5. Apply locally
pnpm --filter @workspace/db migrate
```

Never use `push` in production. `push` is for fast local iteration only — it bypasses migration history.

---

## Git hooks

Installed via `simple-git-hooks` on `pnpm install`. Defined in `.simple-git-hooks.json`:

| Hook         | Command                        | Blocks commit/push on                    |
| ------------ | ------------------------------ | ---------------------------------------- |
| `pre-commit` | `pnpm exec prettier --check .` | Any file not matching prettier format    |
| `pre-push`   | `pnpm typecheck`               | Any TypeScript error across all packages |

### Bypassing hooks (emergency only)

```bash
git commit --no-verify -m "..."   # skip pre-commit
git push --no-verify               # skip pre-push
```

Never bypass on the main branch without immediately following up with a fix commit.

---

## Code quality

### TypeScript

```bash
pnpm typecheck
```

Runs in two phases:

1. `tsc --build` — compiles the shared libs (`lib/`) via project references
2. Per-package `tsc --noEmit` — checks `apps/` and `scripts/` independently

Zero errors is the required state before any push.

### Formatting

```bash
# Check (what the pre-commit hook runs)
pnpm exec prettier --check .

# Fix
pnpm exec prettier --write .
```

Prettier config is default (no `.prettierrc`). Excluded paths are in `.prettierignore`.

### Testing

```bash
pnpm test           # run all tests once
pnpm test:watch     # watch mode
```

Tests live inside each `lib/` package alongside the source. The Vitest workspace config at the root (`vitest.workspace.ts`) aggregates all package test suites.

---

## Package management

### Adding a dependency

```bash
# To a specific package
pnpm --filter @workspace/api-server add express

# As a dev dependency
pnpm --filter @workspace/r3-agi add -D @types/something

# To the workspace root
pnpm add -D -w some-tool
```

### Catalog-pinned packages

Common packages are version-pinned in the workspace catalog in `pnpm-workspace.yaml`. When adding a cataloged package, reference it as `"catalog:"` in the package's `package.json` rather than a version string:

```json
{
  "dependencies": {
    "drizzle-orm": "catalog:",
    "tsx": "catalog:"
  }
}
```

This ensures all workspace packages use the same version.

### Supply chain policy

`minimumReleaseAge: 1440` is enforced globally. Any package version published less than 24 hours ago will be rejected during install. Do not disable this. If an urgent install is needed, add the package to `minimumReleaseAgeExclude` temporarily and remove it once the 24-hour window passes.

---

## Workspace scripts reference

| Script                                 | What it does                                              |
| -------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                             | Start api-server (tsx watch) + r3-agi (Vite) concurrently |
| `pnpm build`                           | Typecheck all packages then build all artifacts           |
| `pnpm typecheck`                       | TypeScript check across all packages                      |
| `pnpm test`                            | Run Vitest across all lib packages                        |
| `pnpm test:watch`                      | Vitest in watch mode                                      |
| `pnpm --filter @workspace/db migrate`  | Apply pending DB migrations                               |
| `pnpm --filter @workspace/db generate` | Generate migration from schema diff                       |
| `pnpm --filter @workspace/db push`     | Push schema directly (dev only)                           |
| `pnpm approve-builds`                  | Approve post-install scripts for new packages             |

---

## Debugging

### API server logs

The api-server logs every request with method, URL (path only, no query params), status code, and response time in milliseconds. In development, pino-pretty colorizes by log level.

```
[13:25:46.131] INFO: Server listening { port: 3001 }
[13:25:50.107] INFO: request completed { req: { id: 1, method: "POST", url: "/api/metrics/heartbeat" }, res: { statusCode: 200 }, responseTime: 42 }
```

Auth headers and cookies are redacted from all log output.

### SSE debugging

To inspect the raw SSE stream from the terminal:

```bash
# Metrics stream
curl -N http://localhost:3001/api/metrics/stream

# Agent chat (single turn)
curl -N -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```
