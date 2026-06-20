# CLAUDE.md — Agi-Suite Governance

## Project
Agi-Suite is an autonomous agent admin console for R3 v4.
- **Monorepo root:** `~/Agi-Suite`
- **API server:** `apps/api-server` (Express/tRPC, port 3001)
- **Frontend:** `apps/r3-agi` (React/Vite, port 5176)
- **DB package:** `lib/db` (Drizzle/PostgreSQL)
- **Deploy:** Railway

## WIRE Protocol
Read-before-write. Timestamped backups before edits. Dry-run defaults.
Use Python file writes (not heredocs) for multi-line patches.

### Type-check gate (run after every change)
```bash
pnpm --filter @workspace/api-server exec tsc --noEmit 2>&1 | grep "error TS" | head -10
pnpm --filter @workspace/r3-agi exec tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Do NOT use `pnpm tsc -b --noEmit` from root — broken with composite project references.
Do NOT include `@workspace/db` in gate — produces false TS6305 cascade from root tsconfig.

## Dev
```bash
cd ~/Agi-Suite && pnpm dev
# api: http://localhost:3001
# agi: http://localhost:5176
```

## Database
- **Connection (app):** `postgresql://r3:r3local@localhost:5432/r3vibe`
- **psql (peer auth):** `psql -U r3v -d r3vibe`  ← use this for all manual SQL
- **psql via URL fails** over IPv6 — always use `-U r3v -d r3vibe` for manual queries
- **Migrations:** `lib/db/migrations/` — apply manually via `psql -U r3v -d r3vibe < file.sql`
- After creating tables as `r3v`, always grant: `GRANT ALL PRIVILEGES ON TABLE <t> TO r3;`

## Key tables
| Table | Owner | Notes |
|-------|-------|-------|
| `metrics_kv` | r3v | Persistent counters (totalSubscribers) |
| `agi_agents` | r3v | Agent dispatch queue — created 2025-05 |

## R3 v4 integration
- R3 v4 runs on `http://localhost:3000` (Stable repo)
- Secrets must match: `INTERNAL_SECRET` in both `.env` files
- `fetchR3Metrics` polls `/api/internal/metrics/time-savings` every 30s
- r3Metrics shows zeros until Stable is running on :3000 — this is expected

## Architectural invariants
- Express-only API (no tRPC client in api-server)
- SSE stream: `res.setTimeout(0)` + `req.socket.setTimeout(0)` required — do not remove
- `/api/agents/status` must remain public (no `requireAgentToken`) — UI polls it unauthenticated
- Agent token auth covers all other `/api/agents/*` routes via `router.use(requireAgentToken)`
- Spacing tokens: `spacing.semantic.component` has xs/sm/md/lg/xl — do not remove xl

## Known non-issues
- `pnpm tsc -b --noEmit` TS6310 errors — structural, not real errors
- `@workspace/db exec tsc --noEmit` TS6305 — false cascade from root tsconfig, not real errors
- Both are safe to ignore; use per-package gate above
