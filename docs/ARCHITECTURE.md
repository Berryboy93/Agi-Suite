# Architecture

## Overview

Agi-Suite is a pnpm workspace monorepo composed of two runtime artifacts and a shared library layer. The architecture enforces a strict contract boundary between services through generated code — the OpenAPI spec in `lib/api-spec` is the single source of truth, and everything downstream (Zod validators, React Query hooks) is generated from it.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   r3-agi (Vite)                       │   │
│  │                                                       │   │
│  │  Sidebar → Views → Hooks → api-client-react          │   │
│  │                         → useMetrics (SSE)           │   │
│  │                         → useAGI (SSE streaming)     │   │
│  └────────────────────┬──────────────────────────────────┘  │
└───────────────────────│─────────────────────────────────────┘
                        │ HTTP / SSE
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   api-server (Express 5)                     │
│                                                              │
│  /api/healthz          → health check                        │
│  /api/metrics          → snapshot                            │
│  /api/metrics/stream   → SSE broadcast                       │
│  /api/metrics/heartbeat→ session registration                │
│  /api/agent/chat       → Anthropic SSE proxy                 │
│                                                              │
└───────────────────┬─────────────────────────────────────────┘
                    │
          ┌─────────┴──────────┐
          │                    │
          ▼                    ▼
   Anthropic API          PostgreSQL
   (claude-sonnet)        (Drizzle ORM)
```

---

## Package graph

```
lib/api-spec          ← OpenAPI YAML (source of truth)
      │
      ├── lib/api-zod           ← generated Zod validators
      │         │
      │         └── apps/api-server   ← validates request bodies
      │
      └── lib/api-client-react  ← generated React Query hooks
                │
                └── apps/r3-agi       ← consumes typed hooks
```

`lib/db` is consumed only by `apps/api-server`. The frontend never talks to the database directly.

---

## Frontend (`apps/r3-agi`)

**Stack:** React 19, Vite 7, Tailwind CSS 4, shadcn/ui, React Query, Zustand

### Layout

The app is a single-page application with a fixed three-panel layout:

```
┌──────────┬────────────────────────────┬───────────────┐
│          │                            │               │
│ Sidebar  │        Active View         │  Right Panel  │
│  (nav)   │                            │  (agent chat) │
│          │                            │               │
└──────────┴────────────────────────────┴───────────────┘
         Header (metrics bar)
```

### Views

| View               | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `OverviewView`     | System health, key metrics at a glance        |
| `IntelligenceView` | LLPTE pipeline status and telemetry           |
| `LLPTEView`        | Deep-dive into the six-package audio AI suite |
| `AGICmdView`       | Issue commands to the AGI agent layer         |
| `APIView`          | Live API inspection and testing               |
| `ASIView`          | Higher-order intelligence layer monitoring    |
| `PatchView`        | Patch tracking and application                |
| `PRDView`          | Canonical PRD rendered in-app                 |
| `ChecklistView`    | Pre-deploy QA checklist                       |
| `VerifyView`       | System verification steps                     |
| `PrioritiesView`   | Active work prioritization board              |
| `TreeView`         | Dependency/file graph visualization           |

### State management

| Store              | Responsibility                                            |
| ------------------ | --------------------------------------------------------- |
| `useAGI` (Zustand) | Agent conversation state, streaming chunks, abort control |

### Real-time data

- `useMetrics` — connects to `/api/metrics/stream` (SSE), maintains active user count and subscriber total in component state
- Heartbeat posted to `/api/metrics/heartbeat` on a 30-second interval to register session presence

### Agent panel

`AgentSuitePanel` manages a streaming conversation with Claude via `/api/agent/chat`. The SSE protocol:

```
client → POST /api/agent/chat  { messages, system?, max_tokens? }
server → text/event-stream
         data: {"type":"text_delta","text":"..."}  (repeated)
         data: [DONE]
```

Abort is handled client-side by closing the connection; the server detects `req.close` and calls `stream.abort()`.

---

## Backend (`apps/api-server`)

**Stack:** Express 5, pino, Anthropic SDK 0.39, esbuild (production build), tsx watch (development)

### Build modes

| Mode        | Command                    | Mechanism                                                        |
| ----------- | -------------------------- | ---------------------------------------------------------------- |
| Development | `pnpm dev`                 | `tsx watch src/index.ts` — instant reload on save, no build step |
| Production  | `pnpm build && pnpm start` | esbuild bundle → `node dist/index.mjs`                           |

### Logging

Structured JSON logging via pino. In development, `pino-pretty` colorizes output. In production, raw JSON for log aggregation. Request logging via `pino-http` with redacted auth headers.

### Metrics layer

The metrics system tracks active sessions without a database:

- `activeSessions: Map<sessionId, timestamp>` — in-memory, pruned on 45s TTL
- `totalSubscribers: number` — persisted to `/tmp/r3-metrics.json` across restarts
- `sseClients: Set<Response>` — active SSE connections receive broadcast on any session change
- Background interval prunes stale sessions every 15 seconds

### Agent route

The `/api/agent/chat` route is a transparent SSE proxy to the Anthropic Streaming API. Critical implementation detail: `MessageStream` in the Anthropic SDK is both an `EventEmitter` and a `Promise`-like. Both paths must be handled:

```typescript
stream.on("error", handler); // EventEmitter path — real errors
stream.on("abort", () => {}); // abort event — prevents intentional unhandled rejection
// on client disconnect
```

Without the `abort` listener, `_emit('abort')` calls `Promise.reject(error)` when no abort listeners are registered, producing an unhandled rejection that kills the process.

---

## Shared libraries (`lib/`)

### `lib/api-spec`

Contains the OpenAPI YAML definition and `orval.config.ts`. Running the code generator here produces both `lib/api-zod` and `lib/api-client-react`. This is the only place API contracts are manually authored.

### `lib/api-zod`

Auto-generated Zod schemas matching every request and response type in the OpenAPI spec. Used by `api-server` to validate incoming request bodies at the route layer.

### `lib/api-client-react`

Auto-generated React Query hooks and TypeScript types. Used by `r3-agi` for all non-SSE API calls. The custom fetch wrapper in `src/custom-fetch.ts` handles base URL configuration and shared error handling.

### `lib/db`

Drizzle ORM schema and database client. Consumed only by `api-server`. Scripts:

| Script       | Purpose                                    |
| ------------ | ------------------------------------------ |
| `push`       | Push schema directly to DB (development)   |
| `push-force` | Force push, bypassing safety checks        |
| `generate`   | Generate migration file from schema diff   |
| `migrate`    | Apply pending migration files (production) |

---

## Security posture

### Supply chain

`pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` — no package version published less than 24 hours ago can be installed. This is a critical supply-chain attack defense. The only exclusions are `@replit/*` scoped packages.

### Dependency overrides

Platform-specific binary packages for esbuild, lightningcss, rollup, and tailwindcss/oxide are pinned to `-` (excluded) for all non-linux-x64 targets. This prevents unnecessary binary downloads and reduces attack surface.

### Runtime

- Auth headers and cookies are redacted from all pino log output
- `ANTHROPIC_API_KEY` is never forwarded to the client; the agent route is a server-side proxy
- `DATABASE_URL` is server-side only

---

## Data flow: agent chat request

```
1. User types message in AgentSuitePanel
2. useAGI store dispatches → POST /api/agent/chat
3. api-server validates messages array
4. api-server opens MessageStream to Anthropic
5. stream.on("text") → writes SSE chunk to response
6. r3-agi reads SSE stream → appends text delta to store
7. UI re-renders incrementally as chunks arrive
8. stream.once("finalMessage") → writes [DONE] → res.end()
9. If user navigates away:
   - browser closes connection
   - req.on("close") fires
   - stream.abort() called
   - stream.on("abort") fires (no-op — prevents process crash)
```
