# Roadmap

This document tracks planned improvements, in rough priority order. Each item describes what it is, why it matters, and what the implementation looks like.

---

## Immediate (known gaps from current state)

### 1. Approve `simple-git-hooks` build script

**Status:** Hooks are installed and working via the `prepare` script, but pnpm flagged the build script as unapproved. Future `pnpm install` runs on a fresh clone will not re-apply hooks until this is resolved.

**Fix:**

```bash
pnpm approve-builds
# Select simple-git-hooks
```

Run once. The approval is stored in `.npmrc` or `pnpm-workspace.yaml` depending on pnpm version.

---

### 2. Persist `totalSubscribers` to PostgreSQL

**Status:** Currently persisted to `/tmp/r3-metrics.json` on the server filesystem. Resets to 147 on every Railway deploy because Railway uses an ephemeral filesystem.

**Implementation:** Add a `metrics` table to `lib/db/src/schema/index.ts` with a single-row config record. Read and write `totalSubscribers` from the DB instead of the filesystem. Use an upsert on write to keep it a single round-trip.

```typescript
// lib/db/src/schema/index.ts
export const metrics = pgTable("metrics", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: integer("value").notNull(),
});
```

```typescript
// Read on startup
const row = await db
  .select()
  .from(metrics)
  .where(eq(metrics.key, "totalSubscribers"))
  .limit(1);
let totalSubscribers = row[0]?.value ?? 147;

// Write on increment
await db
  .insert(metrics)
  .values({ key: "totalSubscribers", value: totalSubscribers })
  .onConflictDoUpdate({
    target: metrics.key,
    set: { value: totalSubscribers },
  });
```

---

### 3. Lint (ESLint)

**Status:** Not present. Prettier handles formatting but has no opinion on code correctness, unused variables, or React hook rules.

**Implementation:** Add `eslint` + `@typescript-eslint/eslint-plugin` + `eslint-plugin-react-hooks` to root devDependencies. Create a flat config `eslint.config.js` at workspace root. Add `"lint": "eslint ."` to root scripts and add it to the `pre-push` hook alongside typecheck:

```json
{
  "pre-push": "pnpm typecheck && pnpm lint"
}
```

---

## Short-term

### 4. API server watch mode without full process restart

**Status:** `tsx watch` restarts the entire Node process on any file change. For small edits deep in a route file, this is fast enough. For larger changes involving module graph updates, there is a brief moment where the server is unavailable.

**Better approach:** `tsx watch` is correct for now. Revisit if restart time becomes perceptible (>500ms). At that point, switch to esbuild `--watch` + `node --watch dist/index.mjs` for incremental rebuilds without process restart.

---

### 5. Test coverage for `lib/` packages

**Status:** Vitest is configured at the workspace root but no test files exist yet. The test runner is wired — it just has nothing to run.

**Priority order:**

1. `lib/api-zod` — unit tests for every Zod schema (parse valid, reject invalid, check error messages)
2. `lib/db` — integration tests for schema constraints and query patterns (requires a test database)
3. `lib/api-client-react` — mock-based tests for the custom fetch wrapper and error handling

**Naming convention:** `*.test.ts` colocated with the source file. Do not create a separate `__tests__` directory.

---

### 6. Agent conversation persistence

**Status:** Conversation history lives in Zustand store (`useAGI`). It is lost on page refresh.

**Implementation:** Two options depending on privacy requirements:

- **localStorage** — zero infrastructure, survives refresh, lost on clear. Appropriate for single-user local deployment.
- **Database** — add a `conversations` table, POST conversation turns to a new `/api/agent/conversations` endpoint. Required for multi-device access or audit logging.

For the current solo-developer use case, localStorage is sufficient.

---

### 7. OpenAPI spec code generation script

**Status:** `lib/api-spec/orval.config.ts` is present but there is no documented command to run the generator. Adding a new endpoint requires manually knowing the orval CLI.

**Fix:** Add a `generate` script to `lib/api-spec/package.json`:

```json
{
  "scripts": {
    "generate": "orval --config ./orval.config.ts"
  }
}
```

And document the full endpoint-addition workflow explicitly in `DEVELOPMENT.md`.

---

## Medium-term

### 8. Streaming response cancellation from UI

**Status:** The `AgentSuitePanel` sends a request and reads the SSE stream. If the user wants to stop mid-stream, there is no cancel button — they must navigate away or wait.

**Implementation:** Use the `AbortController` API on the client side. Pass the signal to the fetch request. The server already handles `req.on("close")` correctly — client abort is all that is needed.

```typescript
const abortController = new AbortController();

fetch("/api/agent/chat", {
  method: "POST",
  signal: abortController.signal,
  // ...
});

// Cancel:
abortController.abort();
```

Wire a "Stop" button in `AgentSuitePanel` to `abortController.abort()`.

---

### 9. Request authentication

**Status:** All API endpoints are unauthenticated. This is acceptable for a local-only or private Railway deployment, but is a gap if the deployment is ever public-facing.

**Implementation:** Add a simple bearer token check as Express middleware:

```typescript
// src/middleware/auth.ts
export function requireApiKey(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token !== process.env.API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
```

Apply to all routes except `/api/healthz`. Add `API_SECRET` to the Railway environment variables and the frontend's Vite env config.

---

### 10. Structured error responses

**Status:** Error responses are not consistently shaped. Some routes return `{ error: "..." }`, others fall through to Express's default error handler which returns HTML.

**Implementation:** Add a global error handler in `src/app.ts`:

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});
```

Add the corresponding error response type to `lib/api-spec/openapi.yaml` and regenerate.

---

## Long-term

### 11. Multi-tab / multi-device session handling

**Status:** `totalSubscribers` increments per unique `sessionId`. The session ID is generated in the frontend and lives in memory — it resets on page refresh, generating a new session and incrementing the counter artificially.

**Improvement:** Move session ID generation to a `localStorage`-backed stable ID. One ID per browser, persists across refreshes and tabs.

---

### 12. Metrics dashboard view

**Status:** Metrics are consumed by `useMetrics` and presumably displayed in `OverviewView`, but there is no dedicated visualization for historical trends.

**Implementation:** Add a `/api/metrics/history` endpoint backed by a time-series table in PostgreSQL. Surface trends in a dedicated chart view using a lightweight charting library (recharts or uplot).

---

### 13. Agent tool use

**Status:** The agent chat is plain conversational — no tool calls. The Anthropic SDK supports tool use natively.

**High-value tools for this use case:**

- `read_file` — read any file in the R3 v4 workspace
- `run_typecheck` — trigger `pnpm typecheck` and return the output
- `query_db` — run a read-only SQL query against the development database
- `list_routes` — enumerate all registered Express routes

This would transform the agent from a chat interface into an actual development co-pilot with live access to the system.

---

### 14. CI pipeline

**Status:** Git hooks enforce quality locally. There is no CI check on pull requests or pushes.

**Implementation:** GitHub Actions workflow at `.github/workflows/ci.yml`:

```yaml
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prettier --check .
      - run: pnpm typecheck
      - run: pnpm test
```

The `--frozen-lockfile` flag ensures the lockfile is never mutated in CI.

---

## Completed

| Item                  | Completed  | Description                                                                              |
| --------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| SDK abort crash fix   | 2026-04-18 | Added `stream.on("abort", () => {})` to prevent unhandled rejection on client disconnect |
| API server hot reload | 2026-04-18 | Replaced `build && start` dev script with `tsx watch`                                    |
| Bundle size reduction | 2026-04-18 | Externalized `@anthropic-ai/sdk` from esbuild bundle (~1.8mb reduction)                  |
| Git hooks             | 2026-04-18 | `simple-git-hooks` with pre-commit prettier and pre-push typecheck                       |
| Prettier              | 2026-04-18 | Formatted 153 files, `.prettierignore` configured                                        |
| Vitest workspace      | 2026-04-18 | Vitest configured at monorepo root, `test` and `test:watch` scripts added                |
| DB migrate scripts    | 2026-04-18 | Added `migrate` and `generate` scripts to `lib/db/package.json`                          |
