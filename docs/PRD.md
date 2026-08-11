# Agi-Suite — Product Requirements Document

**Version:** 2.0  
**Date:** 2026-04-18  
**Author:** r3v  
**Status:** Active  
**Branch:** `feature/llpte-extraction`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [User Persona](#3-user-persona)
4. [Product Vision](#4-product-vision)
5. [Current State (v1.0)](#5-current-state-v10)
6. [System Architecture](#6-system-architecture)
7. [Feature Requirements — Current](#7-feature-requirements--current)
8. [Feature Requirements — Future](#8-feature-requirements--future)
9. [Technical Requirements](#9-technical-requirements)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [API Contract](#11-api-contract)
12. [Data Model](#12-data-model)
13. [Security Requirements](#13-security-requirements)
14. [Success Metrics](#14-success-metrics)
15. [Release Phases](#15-release-phases)
16. [Known Gaps and Risks](#16-known-gaps-and-risks)
17. [Decisions Log](#17-decisions-log)

---

## 1. Executive Summary

Agi-Suite is an AI-native, browser-based engineering command center built specifically for the development and operation of R3 v4 — a browser-based AI-native Digital Audio Workstation. It consolidates system monitoring, AI-assisted development, codebase navigation, QA verification, and project management into a single, always-open interface running alongside the development environment.

The core premise is zero context-switching: every piece of information needed to build, debug, verify, and ship R3 v4 is accessible without leaving the browser tab.

---

## 2. Problem Statement

Developing a complex, AI-native platform as a solo developer across multiple technical domains (audio DSP, WebAssembly, AI pipelines, real-time WebSocket collaboration, Three.js visuals) creates a persistent overhead problem:

- **Cognitive load from tool sprawl.** Switching between terminal, browser, documentation, issue tracker, and AI chat windows fragments focus and wastes time.
- **No live system state.** There is no single view of what is running, what has changed, and what is broken.
- **Manual verification is slow and error-prone.** Pre-deploy QA is a mental checklist rather than a structured workflow.
- **AI assistance is context-free.** Generic AI chat tools have no knowledge of the specific codebase, architecture, or current state.
- **Priorities drift without a forcing function.** Without an in-environment prioritization view, feature creep and reactive work displace planned work.

Agi-Suite is the solution to all five problems in one purpose-built tool.

---

## 3. User Persona

**Primary user: r3v (solo developer)**

- Builds and maintains R3 v4 full-stack: React/Vite frontend, Express/Drizzle backend, LLPTE audio pipeline, Railway deployment
- Works in a Kali Linux VM environment (VMware)
- Expert-level TypeScript, Node.js, Python; strong systems-level understanding
- Requires direct, zero-handholding technical tooling
- High context-switching cost — any reduction in tab switches or terminal round-trips has direct productivity impact
- Deploys to Railway; monitors via Railway dashboard and logs today; wants to replace the Railway dashboard for operational monitoring

**There are no secondary users today.** Multi-user support is a future consideration only.

---

## 4. Product Vision

> Agi-Suite becomes the only interface needed to develop, operate, and evolve R3 v4 — from writing code to shipping deploys, all from a single browser-based dashboard with an AI co-pilot that has live, structured access to the entire system.

The three-horizon evolution:

| Horizon                                    | Timeframe  | State          |
| ------------------------------------------ | ---------- | -------------- |
| H1: Monitoring + AI chat                   | Now        | ✅ Shipped     |
| H2: Active control + tool-use AI           | 1–3 months | 🔨 In progress |
| H3: Autonomous agent with deploy authority | 3–6 months | 🗺 Planned      |

---

## 5. Current State (v1.0)

### What is shipped

As of 2026-04-18, Agi-Suite is a functioning two-service monorepo with the following capabilities:

**Frontend (`apps/r3-agi`)**

- Multi-panel React 19 SPA with sidebar navigation
- 12 active view panels covering all major operational domains
- Live metrics bar showing active users and total subscribers
- Embedded AI agent panel with full streaming chat (Claude Sonnet)
- Real-time SSE connection to backend metrics stream

**Backend (`apps/api-server`)**

- Express 5 API server with structured pino logging
- Anthropic SDK streaming proxy — server-side, key never exposed to client
- Session-aware metrics system with SSE broadcast
- Health endpoint for Railway deploy validation
- Hot reload in development via `tsx watch`
- Production build via esbuild with source maps

**Shared infrastructure**

- OpenAPI-first contract layer (`lib/api-spec` → `lib/api-zod` + `lib/api-client-react`)
- Drizzle ORM + PostgreSQL with migration workflow
- pnpm workspace with catalog-pinned versions and supply chain controls
- Git hooks: prettier pre-commit, typecheck pre-push
- Vitest workspace config (runner ready, test suites pending)

### What is not yet shipped

- No authentication on any endpoint
- No conversation persistence (resets on page refresh)
- No agent tool use (chat only, no system access)
- No test coverage
- No CI pipeline
- `totalSubscribers` resets on every Railway deploy (ephemeral filesystem)
- No ESLint

---

## 6. System Architecture

### Service topology

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  r3-agi  │  Sidebar + Views + AgentSuitePanel        │   │
│  │          │  useMetrics (SSE) │ useAGI (Zustand)      │   │
│  └────────────────────┬─────────────────────────────────┘   │
└───────────────────────│─────────────────────────────────────┘
                        │ HTTP + SSE
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            api-server (Express 5, Node 22)                   │
│  /api/healthz   /api/metrics   /api/metrics/stream           │
│  /api/metrics/heartbeat   /api/agent/chat                    │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               ▼                          ▼
        Anthropic API              PostgreSQL (Railway)
        claude-sonnet-4            Drizzle ORM
```

### Monorepo package graph

```
lib/api-spec  ──generates──►  lib/api-zod  ──────────►  api-server
                          └──►  lib/api-client-react  ──►  r3-agi
lib/db  ─────────────────────────────────────────────►  api-server
```

### Frontend layout

```
┌─ Header (metrics bar: active users, total subscribers) ──────┐
│                                                               │
│ ┌─ Sidebar ─┐  ┌─ Active View ──────────────┐  ┌─ Panel ──┐ │
│ │           │  │                             │  │          │ │
│ │  nav      │  │  Overview / Intelligence /  │  │  Agent   │ │
│ │  links    │  │  LLPTE / AGICmd / API /     │  │  Suite   │ │
│ │           │  │  ASI / Patch / PRD /        │  │  Panel   │ │
│ │           │  │  Checklist / Verify /       │  │  (SSE    │ │
│ │           │  │  Priorities / Tree          │  │  chat)   │ │
│ │           │  │                             │  │          │ │
│ └───────────┘  └─────────────────────────────┘  └──────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## 7. Feature Requirements — Current

### FR-001: System Overview Dashboard

**Status:** Shipped  
**View:** `OverviewView`

The overview provides a real-time top-level status readout of the R3 v4 system. Displays active user count, total subscriber count, and key system health indicators. The entry point for any session — tells the developer immediately whether the system is in a good state or requires attention.

**Acceptance criteria:**

- Displays `activeUsers` and `totalSubscribers` from the metrics stream
- Updates in real time without page reload
- Visible degradation state when SSE connection is lost

---

### FR-002: LLPTE Pipeline Monitoring

**Status:** Shipped  
**Views:** `IntelligenceView`, `LLPTEView`

The LLPTE (six-package AI audio processing suite: `llpte-core`, `llpte-signal`, `llpte-ai`, `llpte-transition-graph`, `llpte-execution`, `llpte-adapters`) is the core AI engine of R3 v4. Monitoring its state is critical to understanding the health of the product.

`IntelligenceView` provides a high-level status across all six packages. `LLPTEView` provides a deep-dive into the pipeline topology, execution state, and any error conditions.

**Acceptance criteria:**

- Each of the six packages has an individual status indicator
- Pipeline execution state is visible (idle / processing / error)
- Errors surface with enough context to diagnose without switching to a terminal

---

### FR-003: AGI Command Interface

**Status:** Shipped  
**View:** `AGICmdView`

Provides a structured interface for issuing commands to the AGI agent layer of R3 v4. Distinct from the embedded chat panel — this view exposes discrete operational commands rather than open-ended conversation.

**Acceptance criteria:**

- Available commands are enumerated in the UI (no free-form input for command names)
- Command execution state is visible (pending / success / error)
- Command output is displayed inline

---

### FR-004: Live API Inspection

**Status:** Shipped  
**View:** `APIView`

Displays the live state of the R3 v4 API — registered routes, recent request logs, error rates. Eliminates the need to switch to a separate API testing tool for basic inspection.

**Acceptance criteria:**

- All registered routes are listed with their HTTP method
- Recent requests are shown with status codes and response times
- Filtering by route or status code

---

### FR-005: ASI Layer Status

**Status:** Shipped  
**View:** `ASIView`

Higher-order intelligence layer monitoring for the ASI components of R3 v4. Surfaces state and telemetry from the top of the AI decision stack.

---

### FR-006: Patch Tracking

**Status:** Shipped  
**View:** `PatchView`

Tracks applied patches, pending patches, and patch history against the R3 v4 codebase. Provides a record of what changed, when, and why — enforcing the four-part change accountability framework (root cause, fix rationale, affected surface, regression check).

**Acceptance criteria:**

- Patch list with timestamp, description, and status
- Each patch entry links to affected files/surfaces
- Pending patches are visually distinguished from applied patches

---

### FR-007: Canonical PRD Reference

**Status:** Shipped  
**View:** `PRDView`

Renders the canonical R3 v4 PRD inline within the dashboard. The PRD is the authoritative product specification — having it always accessible without switching tabs ensures development decisions are made against the correct reference.

**Acceptance criteria:**

- PRD renders in full with section navigation
- PRD version/date is visible
- Read-only — the PRD is not edited from within Agi-Suite

---

### FR-008: QA Checklist

**Status:** Shipped  
**View:** `ChecklistView`

A structured pre-deploy verification checklist derived from the 17-item QA spec in `Wire.txt`. Replaces the mental checklist with a trackable, repeatable process.

**Acceptance criteria:**

- All checklist items are enumerated with pass/fail state
- State persists within a session (does not reset on view change)
- Completion percentage is displayed
- A checklist cannot be marked complete unless all items are checked

---

### FR-009: System Verification

**Status:** Shipped  
**View:** `VerifyView`

Active verification steps that confirm system integrity — TypeScript compilation, test pass rate, build output validity, and deployment readiness. Distinct from the checklist (which is manual) — Verify runs automated checks.

**Acceptance criteria:**

- Each verification step shows last-run timestamp and result
- Failed verifications are visually prominent
- Verification can be re-triggered from the UI

---

### FR-010: Work Prioritization

**Status:** Shipped  
**View:** `PrioritiesView`

In-environment priority tracking that surfaces the active work queue without requiring a separate project management tool. Provides a forcing function against feature creep.

**Acceptance criteria:**

- Items have priority levels (P0/P1/P2 or equivalent)
- Active item (in-progress) is visually distinct
- Items can be reordered within the UI

---

### FR-011: Dependency/File Tree

**Status:** Shipped  
**View:** `TreeView`

Visual representation of the R3 v4 dependency graph or file structure. Allows navigation and understanding of the codebase topology without a separate tool.

---

### FR-012: Embedded AI Agent

**Status:** Shipped  
**Panel:** `AgentSuitePanel`  
**Backend:** `POST /api/agent/chat`

A streaming AI chat panel (Claude Sonnet) embedded permanently in the right panel of the dashboard. The agent has knowledge of R3 v4 through system prompt context. Responses stream incrementally via SSE.

**Acceptance criteria:**

- Streaming response renders token-by-token without flicker
- Client disconnect (navigation, close) gracefully aborts the Anthropic request without crashing the server
- Conversation history is maintained within a session
- Error states (API error, timeout) are surfaced in the chat UI
- Model: `claude-sonnet-4-20250514`
- Default max tokens: 1500 (configurable per request)

---

### FR-013: Real-time Metrics

**Status:** Shipped  
**Endpoints:** `GET /api/metrics/stream`, `POST /api/metrics/heartbeat`

Live session tracking displayed in the header bar. Sessions register via heartbeat and expire after 45 seconds of inactivity. The SSE stream broadcasts state changes to all connected clients.

**Acceptance criteria:**

- `activeUsers` count updates within 1 second of a session change
- `totalSubscribers` increments once per unique session (not per heartbeat)
- SSE stream auto-reconnects on connection loss
- Heartbeat interval: 30 seconds
- Session TTL: 45 seconds

---

## 8. Feature Requirements — Future

### FR-014: Agent Tool Use

**Priority:** P0  
**Horizon:** H2  
**Target:** 1–4 weeks

Transform the agent from a conversational assistant into an active co-pilot with structured access to the system. The Anthropic SDK's tool use API allows the agent to call defined functions and receive their results before completing a response.

**Tools to implement (in priority order):**

| Tool             | Description                            | Implementation                                     |
| ---------------- | -------------------------------------- | -------------------------------------------------- |
| `read_file`      | Read any file in the R3 v4 workspace   | Server reads file at path, returns content         |
| `list_directory` | List files in a directory              | `fs.readdir` with recursive option                 |
| `run_typecheck`  | Run `pnpm typecheck` and return output | `child_process.exec` with timeout                  |
| `run_tests`      | Run `pnpm test` and return results     | `child_process.exec`, parse Vitest output          |
| `query_db`       | Execute a read-only SQL query          | Drizzle raw query with `SET TRANSACTION READ ONLY` |
| `list_routes`    | Return all registered Express routes   | Introspect the Express router at runtime           |
| `get_metrics`    | Return current metrics snapshot        | Call internal metrics state directly               |

**Acceptance criteria:**

- Tool calls are visible in the chat UI (tool name + arguments displayed, then result)
- Tool execution errors surface as tool results, not as crashes
- `read_file` is sandboxed to the R3 v4 workspace root (no path traversal)
- `query_db` is strictly read-only — write operations are rejected at the middleware level
- `run_typecheck` and `run_tests` have a 60-second execution timeout

**Backend changes:**

- Update `/api/agent/chat` to pass `tools` array to Anthropic API
- Implement tool execution handlers in `src/lib/tools/`
- Stream `tool_use` and `tool_result` events through SSE alongside text deltas

---

### FR-015: Conversation Persistence

**Priority:** P0  
**Horizon:** H2  
**Target:** 2–4 weeks

Conversation history currently lives only in Zustand store memory. It is lost on page refresh, browser close, or navigation. This breaks the continuity that makes the agent useful for extended development sessions.

**Phase 1 — localStorage (immediate):**

- Persist conversation history to `localStorage` keyed by session
- Restore on page load
- Cap at last N messages to avoid localStorage quota issues (suggested: 50 messages)
- Zero infrastructure required

**Phase 2 — Database persistence (multi-device / audit):**

- Add `conversations` and `messages` tables to `lib/db`
- POST each turn to `/api/agent/conversations`
- Load conversation history on mount from the API
- Required if the dashboard is ever accessed from multiple devices

**Acceptance criteria (Phase 1):**

- Page refresh restores full conversation history
- Conversation history is capped and gracefully truncated when limit is reached
- Clear conversation button empties both UI state and localStorage

---

### FR-016: Request Authentication

**Priority:** P0  
**Horizon:** H2  
**Target:** 2–4 weeks

All API endpoints are currently unauthenticated. Acceptable for localhost-only development but a blocker for any production Railway deployment that is not behind a private network.

**Implementation:**

- Bearer token middleware applied to all routes except `/api/healthz`
- Token stored as `API_SECRET` environment variable on Railway
- Frontend reads token from Vite environment variable (`VITE_API_SECRET`)
- Token is injected into all requests via the custom fetch wrapper in `lib/api-client-react`
- SSE connections include token as query parameter or custom header

**Acceptance criteria:**

- All non-health endpoints return `401` without valid token
- Token mismatch logs a warning with the request IP (no token value in logs)
- Frontend correctly handles `401` responses (show error state, do not retry indefinitely)

---

### FR-017: Streaming Cancel

**Priority:** P1  
**Horizon:** H2  
**Target:** 1–2 weeks

Users cannot currently stop a streaming agent response mid-generation. They must wait for completion or navigate away. A cancel button is standard UX for any streaming AI interface.

**Implementation:**

- `AbortController` created per request in `AgentSuitePanel`
- Cancel button visible during active streaming
- On cancel: `abortController.abort()` → browser closes SSE connection → server `req.on("close")` fires → `stream.abort()` called
- No changes required server-side (already handles client disconnect correctly)
- UI state: button transitions from "Stop" to "Send" on cancel completion

**Acceptance criteria:**

- Cancel button appears only during active streaming
- Cancelling mid-response preserves the partial response in the chat history
- Cancelling does not produce an error message in the UI
- Server confirms no process crash or unhandled rejection on cancel

---

### FR-018: ESLint Integration

**Priority:** P1  
**Horizon:** H2  
**Target:** 1 week

Prettier handles formatting. TypeScript handles type errors. ESLint fills the gap: unused variables, React hook rule violations, exhaustive switch statements, and import ordering.

**Config:**

- `eslint.config.js` (flat config) at workspace root
- Plugins: `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-import`
- Rules: recommended TypeScript + strict React hooks + no unused vars
- Add `"lint": "eslint ."` to root scripts
- Add `pnpm lint` to the `pre-push` hook alongside `pnpm typecheck`

**Acceptance criteria:**

- Zero lint errors on current codebase after initial setup (fix or suppress with justification)
- Lint runs in CI and blocks merge on failure
- No rules that conflict with prettier (use `eslint-config-prettier` to disable formatting rules)

---

### FR-019: Test Coverage for `lib/` Packages

**Priority:** P1  
**Horizon:** H2  
**Target:** 2–4 weeks

Vitest is configured. No tests exist. The shared library layer (`lib/`) is the most critical surface to cover — it enforces the contract between all other packages.

**Coverage targets:**

| Package                | Test type                                                       | Priority |
| ---------------------- | --------------------------------------------------------------- | -------- |
| `lib/api-zod`          | Unit — parse valid inputs, reject invalid, check error messages | P0       |
| `lib/api-client-react` | Unit — mock fetch, test error handling, retry logic             | P1       |
| `lib/db`               | Integration — schema constraints, query correctness             | P1       |
| `apps/api-server`      | Integration — route handlers with supertest                     | P2       |

**Acceptance criteria:**

- `pnpm test` passes with zero failures before any push
- Coverage thresholds enforced in `vitest.config.ts` per package: 80% lines for `api-zod`, no threshold for others until suites are established
- Tests are colocated with source: `schema.test.ts` next to `schema.ts`

---

### FR-020: CI Pipeline

**Priority:** P1  
**Horizon:** H2  
**Target:** 2–3 weeks

Git hooks enforce quality locally. There is no CI gate on pushes or pull requests. A developer who bypasses hooks (or works on a machine where hooks are not installed) can push broken code undetected.

**GitHub Actions workflow:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prettier --check .
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

**Acceptance criteria:**

- All five checks must pass for a green CI
- `--frozen-lockfile` ensures the lockfile is never mutated in CI
- CI runs on every push to any branch and every PR
- Build time target: under 3 minutes

---

### FR-021: Metrics Persistence to PostgreSQL

**Priority:** P1  
**Horizon:** H2  
**Target:** 1–2 weeks

`totalSubscribers` resets to 147 on every Railway deploy due to the ephemeral filesystem. This makes the metric meaningless as a real measure of engagement.

**Schema addition:**

```sql
CREATE TABLE metrics_kv (
  key   VARCHAR(64) PRIMARY KEY,
  value INTEGER     NOT NULL
);
INSERT INTO metrics_kv (key, value) VALUES ('totalSubscribers', 147)
  ON CONFLICT DO NOTHING;
```

**Implementation:**

- Read `totalSubscribers` from DB on server startup
- Write on every increment with an upsert
- In-memory value is still the primary source during runtime (DB write is async, non-blocking)
- Generate and commit the migration file before deploying

**Acceptance criteria:**

- `totalSubscribers` survives Railway deploys
- DB write failure does not crash the server or block the heartbeat response
- Write latency has no observable impact on heartbeat response time (< 5ms added)

---

### FR-022: Structured Error Responses

**Priority:** P2  
**Horizon:** H2  
**Target:** 1 week

Error responses are not consistently shaped. Routes may return `{ error: "..." }`, Express's default HTML error page, or nothing at all depending on where the error occurs.

**Target shape:**

```typescript
interface ErrorResponse {
  error: string; // human-readable message
  code?: string; // machine-readable error code (e.g. "VALIDATION_ERROR")
  requestId?: string; // pino request ID for log correlation
}
```

**Implementation:**

- Global error handler middleware in `src/app.ts`
- All route errors use `next(err)` to propagate
- Add `ErrorResponse` type to `lib/api-spec/openapi.yaml`
- Regenerate `lib/api-zod` and `lib/api-client-react`

**Acceptance criteria:**

- No route returns HTML for error conditions
- All 4xx and 5xx responses match the `ErrorResponse` shape
- Request ID is included in error responses for log correlation

---

### FR-023: Historical Metrics and Charts

**Priority:** P2  
**Horizon:** H3  
**Target:** 4–8 weeks

Active user count and subscriber count are point-in-time metrics. Historical trends require time-series storage and visualization.

**Schema:**

```sql
CREATE TABLE metrics_events (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(32) NOT NULL,  -- 'session_start', 'session_end'
  session_id  VARCHAR(64) NOT NULL,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New endpoint:** `GET /api/metrics/history?period=7d`

**Frontend:** Dedicated metrics chart view (or expanded `OverviewView`) with a line chart of active users over time. Recharts is already available in the React dependency tree.

---

### FR-024: Agent with Deploy Authority

**Priority:** P0 (H3)  
**Horizon:** H3  
**Target:** 3–6 months

The long-horizon vision for the agent is full deploy authority — the ability to not just read and advise but to take action: apply patches, run migrations, trigger Railway deploys, roll back if a health check fails.

**Prerequisite gates (must be completed first):**

1. FR-014 (tool use) — agent must be able to read and verify state
2. FR-016 (authentication) — all actions must be authenticated
3. FR-019 (test coverage) — a deploy-authority agent requires verified correctness guarantees
4. FR-020 (CI) — CI must be passing before any automated deploy

**Tools added in H3:**

| Tool              | Description                               | Risk level                                     |
| ----------------- | ----------------------------------------- | ---------------------------------------------- |
| `apply_patch`     | Apply a Python or bash patch script       | High — requires dry-run preview + confirmation |
| `run_migration`   | Run `pnpm --filter @workspace/db migrate` | High — irreversible                            |
| `trigger_deploy`  | Trigger a Railway redeploy                | High — requires health check gate              |
| `rollback_deploy` | Roll back to previous Railway deployment  | Medium                                         |
| `write_file`      | Write to a file in the workspace          | High — requires diff preview + confirmation    |

**Safety model:**

- All destructive tools require a two-step confirmation: agent proposes → user approves
- Confirmation is a typed acknowledgment, not a click (reduces accidental confirmation)
- All tool executions are logged to the DB with timestamp, tool name, arguments, and result
- A "safe mode" flag disables all write tools globally

---

## 9. Technical Requirements

### TR-001: Stack constraints (non-negotiable)

| Layer              | Technology                 | Constraint                               |
| ------------------ | -------------------------- | ---------------------------------------- |
| Frontend framework | React 19                   | Fixed — aligns with R3 v4 frontend       |
| Frontend build     | Vite 7                     | Fixed                                    |
| CSS                | Tailwind CSS 4             | Fixed                                    |
| Component library  | shadcn/ui                  | Fixed                                    |
| Backend framework  | Express 5                  | Fixed                                    |
| Backend runtime    | Node.js 22                 | Minimum version                          |
| ORM                | Drizzle ORM                | Fixed                                    |
| Database           | PostgreSQL                 | Fixed — Railway plugin                   |
| AI SDK             | `@anthropic-ai/sdk`        | Fixed — Anthropic only                   |
| AI model           | `claude-sonnet-4-20250514` | Default; may be configurable per feature |
| Package manager    | pnpm 10                    | Fixed — enforced by preinstall script    |
| Language           | TypeScript                 | Strict throughout                        |

### TR-002: Development environment

- Hot reload: `tsx watch` for api-server (< 500ms restart), Vite HMR for frontend
- Environment loading: Node `--env-file` (no dotenv package)
- All changes type-safe before commit (pre-push hook)
- All files prettier-formatted before commit (pre-commit hook)

### TR-003: Build output

- Production api-server bundle: single ESM file via esbuild
- `@anthropic-ai/sdk` externalized from bundle (installed separately at runtime)
- Source maps included for production debugging
- Target bundle size: < 300kb (excluding externals)

### TR-004: Monorepo conventions

- Shared package versions managed via pnpm catalog in `pnpm-workspace.yaml`
- All catalog-referenced packages use `"catalog:"` in `package.json`
- No circular dependencies between packages
- `lib/` packages do not import from `apps/`
- `apps/` packages may import from `lib/`

---

## 10. Non-Functional Requirements

### NFR-001: Performance

| Metric                                  | Target                   |
| --------------------------------------- | ------------------------ |
| API server cold start                   | < 2 seconds              |
| Heartbeat response time                 | < 50ms p99               |
| SSE first byte after agent request      | < 500ms                  |
| Frontend initial load (Vite prod build) | < 2 seconds on broadband |
| tsx watch restart on file change        | < 500ms                  |

### NFR-002: Reliability

- API server must not crash on client disconnect during streaming (enforced by `stream.on("abort", () => {})`)
- SSE clients must be cleaned up on disconnect (no memory leak in `sseClients` Set)
- Session map must be pruned periodically (15-second interval) to prevent unbounded growth
- DB write failures (metrics persistence) must not propagate to HTTP response errors

### NFR-003: Security

- `ANTHROPIC_API_KEY` never leaves the server process
- `DATABASE_URL` never leaves the server process
- Auth headers and cookies redacted from all log output
- Supply chain: `minimumReleaseAge: 1440` enforced globally
- No package version published < 24 hours ago installs without explicit allowlist exception

### NFR-004: Observability

- All requests logged with method, path (no query string), status, and response time
- Unhandled errors logged with full stack trace via pino
- Source maps in production for readable stack traces in logs
- Request ID propagated through log entries for correlation

### NFR-005: Developer experience

- Zero TypeScript errors at all times
- Zero prettier violations at all times
- Workspace commands documented in `DEVELOPMENT.md`
- New developer can run `pnpm install && pnpm dev` and have a working environment in < 5 minutes

---

## 11. API Contract

The canonical API contract lives in `lib/api-spec/openapi.yaml`. All downstream consumers (Zod validators, React Query hooks) are generated from this file. Never write validators or hooks by hand.

### Current endpoints

| Method | Path                     | Auth                    | Description          |
| ------ | ------------------------ | ----------------------- | -------------------- |
| `GET`  | `/api/healthz`           | None                    | Liveness check       |
| `GET`  | `/api/metrics`           | None                    | Metrics snapshot     |
| `GET`  | `/api/metrics/stream`    | None (future: required) | SSE metrics stream   |
| `POST` | `/api/metrics/heartbeat` | None (future: required) | Session heartbeat    |
| `POST` | `/api/agent/chat`        | None (future: required) | Agent streaming chat |

### Planned additions (FR-014, FR-016, FR-021)

| Method | Path                       | Auth     | Description               |
| ------ | -------------------------- | -------- | ------------------------- |
| `GET`  | `/api/metrics/history`     | Required | Time-series metrics       |
| `POST` | `/api/agent/conversations` | Required | Persist conversation turn |
| `GET`  | `/api/agent/conversations` | Required | Load conversation history |

---

## 12. Data Model

### Current schema (`lib/db/src/schema/index.ts`)

Schema contents not fully visible from current session — confirm against actual file before adding tables.

### Planned additions

**`metrics_kv`** (FR-021 — metrics persistence)

```typescript
export const metricsKv = pgTable("metrics_kv", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: integer("value").notNull(),
});
```

**`metrics_events`** (FR-023 — historical metrics)

```typescript
export const metricsEvents = pgTable("metrics_events", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow(),
});
```

**`conversations`** (FR-015 Phase 2 — conversation persistence)

```typescript
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  role: varchar("role", { length: 16 }).notNull(), // user | assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

---

## 13. Security Requirements

### SR-001: Supply chain

- `minimumReleaseAge: 1440` enforced in `pnpm-workspace.yaml`. Do not disable.
- Exceptions to the 1440-minute rule require explicit `minimumReleaseAgeExclude` entry with justification
- All exceptions must be removed once the 24-hour window passes

### SR-002: Secrets management

- All secrets are Railway environment variables — never committed to the repository
- `.env` files are gitignored
- No secret should appear in any log output
- When FR-016 is implemented, the `API_SECRET` is added to Railway and to Vite's env config as `VITE_API_SECRET` — never hardcoded

### SR-003: Input validation (FR-014 — tool use)

- `read_file` tool: path must be resolved against the workspace root and validated to not escape it (`path.resolve` + `startsWith(ROOT)`)
- `query_db` tool: all queries run in `READ ONLY` transaction mode; DDL statements are rejected
- `run_typecheck` / `run_tests`: no arguments accepted from the agent — command is hardcoded

### SR-004: Agent safety (FR-024 — deploy authority)

- All destructive tools gated behind explicit user confirmation
- Confirmation is a typed acknowledgment string, not a boolean
- All tool executions logged to database with full audit trail
- `safe_mode` global flag disables all write tools

---

## 14. Success Metrics

### H1 Metrics (current — v1.0)

| Metric                                    | Target                      | Current state                 |
| ----------------------------------------- | --------------------------- | ----------------------------- |
| Server uptime                             | > 99% over any 7-day period | Unknown — no monitoring alert |
| Agent crash-free streaming sessions       | 100%                        | ✅ Fixed (abort handler)      |
| TypeScript errors on main branch          | 0                           | ✅ Verified                   |
| Prettier violations on commit             | 0                           | ✅ Enforced by hook           |
| Pre-deploy QA time (checklist completion) | < 5 minutes                 | Unmeasured                    |

### H2 Metrics (target)

| Metric                                | Target              |
| ------------------------------------- | ------------------- |
| Agent tool-use request success rate   | > 95%               |
| Conversation persistence restore rate | 100% on page reload |
| Test coverage (`lib/api-zod`)         | > 80% lines         |
| CI pipeline pass rate                 | > 98% on first run  |
| Heartbeat response time p99           | < 50ms              |

### H3 Metrics (target)

| Metric                                                       | Target                       |
| ------------------------------------------------------------ | ---------------------------- |
| Agent-initiated deploys with zero rollback                   | > 90%                        |
| Time from "ship decision" to deployed                        | < 5 minutes (agent-assisted) |
| Dev sessions requiring external tool (terminal, browser tab) | < 20%                        |

---

## 15. Release Phases

### Phase 1 — Foundation (Completed 2026-04-18)

- [x] Core monorepo structure with pnpm workspace
- [x] Express API server with metrics and agent endpoints
- [x] React dashboard with 12 view panels
- [x] Streaming agent chat with SSE
- [x] SDK abort crash fix
- [x] Hot reload dev environment
- [x] Git hooks (prettier + typecheck)
- [x] Vitest workspace config
- [x] DB migrate/generate scripts
- [x] Complete documentation suite

### Phase 2 — Hardening (Target: 4 weeks)

- [ ] FR-016: Authentication
- [ ] FR-017: Streaming cancel
- [ ] FR-015: Conversation persistence (Phase 1 — localStorage)
- [ ] FR-018: ESLint
- [ ] FR-019: Test coverage for `lib/api-zod`
- [ ] FR-020: CI pipeline
- [ ] FR-021: Metrics persistence to PostgreSQL
- [ ] FR-022: Structured error responses

### Phase 3 — Intelligence (Target: 8 weeks)

- [ ] FR-014: Agent tool use (read_file, list_directory, run_typecheck, run_tests, query_db)
- [ ] FR-015: Conversation persistence (Phase 2 — database)
- [ ] FR-019: Test coverage for `lib/db` and `api-server`
- [ ] FR-023: Historical metrics and charts

### Phase 4 — Autonomy (Target: 6 months)

- [ ] FR-024: Agent deploy authority
- [ ] Agent patch application with dry-run preview
- [ ] Agent migration execution with rollback gate
- [ ] Full audit log for all agent-initiated actions
- [ ] Safe mode global kill switch

---

## 16. Known Gaps and Risks

### Gap: `simple-git-hooks` build approval

**Risk level:** Low  
**Description:** `pnpm approve-builds` has not been run. On a fresh `pnpm install` (new machine or CI), git hooks will not be installed automatically.  
**Mitigation:** Run `pnpm approve-builds` and select `simple-git-hooks`. This is a one-time action.

### Gap: No authentication

**Risk level:** High if Railway service is public-facing  
**Description:** All endpoints accept unauthenticated requests. The Anthropic API key is protected server-side, but the agent endpoint could be abused by anyone with the Railway URL.  
**Mitigation:** Block the Railway service behind a private network, or implement FR-016 before any public deployment.

### Gap: Ephemeral metrics persistence

**Risk level:** Low (cosmetic)  
**Description:** `totalSubscribers` resets to 147 on every deploy.  
**Mitigation:** FR-021 resolves this.

### Risk: Agent tool-use security surface

**Risk level:** High  
**Description:** When FR-014 ships, the agent gains filesystem and database access. A prompt injection through user-provided content (e.g. a file the agent reads that contains adversarial instructions) could cause unintended tool calls.  
**Mitigation:** Path sandboxing, read-only DB transactions, no write tools in H2, human-in-the-loop confirmation for all destructive operations in H3.

### Risk: Single-process metrics broadcast

**Risk level:** Medium  
**Description:** The SSE broadcast and session map are in-process. If the API server restarts, all SSE clients disconnect and must reconnect. If the server is ever scaled to multiple Railway instances, sessions will not be shared.  
**Mitigation:** Acceptable for current single-instance deployment. If horizontal scaling is needed, move session state to Redis or PostgreSQL.

---

## 17. Decisions Log

| Date       | Decision                                                 | Rationale                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-18 | Use `stream.on("abort", () => {})` instead of `.catch()` | `MessageStream` is not a Promise. `abort` is a distinct SDK event from `error`. `Promise.reject()` is called intentionally by the SDK when no abort listener exists.                            |
| 2026-04-18 | Externalize `@anthropic-ai/sdk` from esbuild bundle      | Package exists in `node_modules` at Railway runtime. Bundling it added ~1.8mb with no benefit.                                                                                                  |
| 2026-04-18 | Use `tsx watch` for dev, esbuild for production          | `tsx watch` provides sub-500ms restart with no build step. esbuild provides optimized production output. Keeping them separate avoids compromising either.                                      |
| 2026-04-18 | `tsx` version uses `"catalog:"` not a hardcoded version  | `tsx: ^4.21.0` is pinned in `pnpm-workspace.yaml` catalog. Hardcoding a different version in `api-server/package.json` would conflict with the catalog and potentially install a duplicate.     |
| 2026-04-18 | `lib/db` uses `push` for dev, `migrate` for production   | `push` is fast for local schema iteration. `migrate` maintains a versioned history required for safe production deploys. Both are needed; neither replaces the other.                           |
| 2026-04-18 | `minimumReleaseAge: 1440` in workspace config            | Supply-chain attacks via malicious npm publishes are typically discovered and pulled within hours. A 24-hour minimum release age provides a strong defense buffer with minimal workflow impact. |
| 2026-04-18 | No `.prettierrc` — use prettier defaults                 | Reducing configuration surface area. Prettier's defaults are well-considered and widely adopted. Deviation requires justification.                                                              |
| 2026-04-18 | Authentication deferred to FR-016                        | Service is not public-facing in current deployment. The gap is documented and known. Shipping auth before other hardening would block value delivery without proportionate risk reduction.      |
