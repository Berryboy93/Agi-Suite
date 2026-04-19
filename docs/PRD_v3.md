# Agi-Suite — Product Requirements Document (v3.0)

**Codename:** Autonomous Engineering System  
**Version:** 3.0  
**Date:** 2026-04-18  
**Supersedes:** PRD v2.0  
**Status:** Active — forward-looking specification

---

## Audit of Source Material (agi_suite_upgrade.txt)

Before proceeding: the uploaded v3–v5 vision document was triple-checked. 23 bugs and gaps were identified and resolved in this PRD. Key issues corrected:

| Category            | Problem                                                              | Resolution                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version numbering   | Jumps v2→v3→v4(AGI-CMD)→v5, no v4 PRD                                | Linear v2→v3 with clear phase names                                                                                                                 |
| Current state       | Marks multi-agent/evolution/meta-evolution ✅ DONE                   | Correctly mapped: none of these are built                                                                                                           |
| Ephemeral state ×4  | StrategyStore, KnowledgeBase, Reputation, MetaRegistry all in-memory | All persisted to PostgreSQL                                                                                                                         |
| Divide by zero      | `stats.success / stats.total` when total===0                         | Guard: `total === 0 ? 0 : success / total`                                                                                                          |
| Selector edge case  | `baselineScore * 1.1` fails when baselineScore===0                   | Floor: `Math.max(baselineScore * 1.1, MIN_ADOPTION_SCORE)`                                                                                          |
| Undefined functions | `generatePatch`, `ctx.runWithConfig`, `ctx.sampleTask`               | Specified in FR-029 (Planning Engine), FR-031 (Simulation Engine), FR-037 (Meta-Evolution — sample task defined as most recent evolution log entry) |
| Execution counter   | `executionCount % 20` never defined or persisted                     | Persisted to `system_state` table                                                                                                                   |
| Policy context type | `condition: (context) => boolean` untyped                            | `PolicyContext` fully typed in FR-027                                                                                                               |
| Trust escalation    | L0–L5 with no escalation mechanism                                   | Explicit escalation protocol in FR-028                                                                                                              |
| Simulation engine   | "Apply in memory" undefined for filesystem patches                   | Defined as in-process string diff + test runner                                                                                                     |
| Drizzle string ref  | `db.select().from("evolution_logs")` is a TS error                   | All tables use typed Drizzle schema references                                                                                                      |
| Governance type     | `metaChange.affects` untyped                                         | `MetaChange` type fully defined in FR-037                                                                                                           |
| No sync transport   | push/pull with no protocol                                           | HTTP REST + ed25519 node identity in FR-040                                                                                                         |
| No node auth        | Any node can poison knowledge base                                   | Signed payloads + reputation filtering in FR-041                                                                                                    |
| No DB schema        | `evolution_logs` has no schema                                       | Full Drizzle schema in Section 12                                                                                                                   |
| System conflation   | AGI-CMD and Agi-Suite treated as same                                | Separated: Agi-Suite is the platform; AGI-CMD is one subsystem                                                                                      |
| Multi-agent unspec. | Roles named, communication undefined                                 | Typed `AgentMessage` in-process bus in FR-030                                                                                                       |
| Validator gap       | Only checks `length===0`, no swing detection                         | Delta threshold enforcement in FR-035                                                                                                               |

---

## Table of Contents

1. [What Changed (v2 → v3)](#1-what-changed)
2. [Product Vision](#2-product-vision)
3. [Closed-Loop Engineering Principle](#3-closed-loop-engineering-principle)
4. [System Architecture — Five Tiers](#4-system-architecture--five-tiers)
5. [Current State — Honest Baseline](#5-current-state--honest-baseline)
6. [Feature Requirements — Phase 2 (Hardening)](#6-feature-requirements--phase-2-hardening)
7. [Feature Requirements — Phase 3 (Intelligence)](#7-feature-requirements--phase-3-intelligence)
8. [Feature Requirements — Phase 4 (Autonomy)](#8-feature-requirements--phase-4-autonomy)
9. [Feature Requirements — Phase 5 (Self-Evolution)](#9-feature-requirements--phase-5-self-evolution)
10. [Feature Requirements — Phase 6 (Distributed)](#10-feature-requirements--phase-6-distributed)
11. [Technical Requirements](#11-technical-requirements)
12. [Data Model](#12-data-model)
13. [Security Model](#13-security-model)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Success Metrics](#15-success-metrics)
16. [Release Phases](#16-release-phases)
17. [Decisions Log](#17-decisions-log)

---

## 1. What Changed

This is a category upgrade, not an iteration. v2.0 described a well-built engineering dashboard with an embedded AI chat panel. v3.0 specifies the path from that dashboard to a self-operating engineering system.

| Dimension     | v2.0                           | v3.0                                                                                     |
| ------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| System role   | Dashboard + AI chat            | Closed-loop autonomous engineering system                                                |
| AI capability | Streaming chat                 | State-aware agent with tool use, planning, and authority layers                          |
| QA model      | Manual checklist + verify view | Continuous verification engine (always-on)                                               |
| Dev loop      | Human-driven                   | Progressively autonomous with governed execution gates                                   |
| Metrics       | Observability display          | Decision-driving intelligence: health score, drift detection, anomaly alerts             |
| Safety        | Documented rules               | Formalized Policy Engine with typed context and execution gates                          |
| Architecture  | Two-service monorepo           | Five-tier system: Infrastructure → Observability → Execution → Intelligence → Governance |

---

## 2. Product Vision

**v2.0:** "The only interface needed to develop, operate, and evolve R3 v4 — from writing code to shipping deploys, all from a single browser-based dashboard with an AI co-pilot."

**v3.0 extension:** Agi-Suite becomes a self-operating engineering system that can observe itself, diagnose issues, propose and execute fixes, verify outcomes, and improve its own decision-making — all within governed safety boundaries. The developer's role shifts from executing tasks to approving decisions.

**The critical distinction:** This is not AGI. It is a bounded, self-improving engineering system — controlled adaptive optimization with hard containment walls. The system proposes; humans gate high-risk actions. Every change is logged, reversible, and diagnosable. Going beyond these bounds does not mean more power — it means more risk, more unpredictability, and harder debugging.

---

## 3. Closed-Loop Engineering Principle

**v2.0 model (human-driven loop):**

```
Human: observe → think → act → verify → repeat
```

**v3.0 model (system-driven, human-gated on risk):**

```
SYSTEM LOOP (continuous)

  observe → analyze → plan → [gate: human?] → execute → verify → record → update model
     ↑                             ↓ deny                                        |
     └─────────────────────────────────────────────────────────────────────────┘

Gate behavior by action risk:
  Safe tools      → auto-execute (no gate)
  Controlled tools → policy check (auto if passes)
  Restricted tools → human confirmation always required
```

The loop is a first-class system component. The developer's role at each risk tier:

- **Safe:** Observer — system acts, developer reviews asynchronously
- **Controlled:** Approver — system shows plan, developer approves before execution
- **Restricted:** Authorizer — developer explicitly triggers with full diff preview

---

## 4. System Architecture — Five Tiers

```
┌──────────────────────────────────────────────────────────────────────────┐
│  L5 — AUTONOMOUS GOVERNANCE LAYER                                         │
│  PolicyEngine · ExecutionGate · TrustAuthority · AuditLog                │
├──────────────────────────────────────────────────────────────────────────┤
│  L4 — AGENT INTELLIGENCE LAYER                                            │
│  PlanningEngine · MultiAgentSystem · EvolutionCycle · MetaEvolution      │
├──────────────────────────────────────────────────────────────────────────┤
│  L3 — EXECUTION & TOOLING LAYER                                           │
│  SafeTools · ControlledTools · RestrictedTools · SimulationEngine        │
├──────────────────────────────────────────────────────────────────────────┤
│  L2 — OBSERVABILITY LAYER                                                 │
│  HealthScore · DriftDetection · AnomalyDetection · MetricsHistory        │
├──────────────────────────────────────────────────────────────────────────┤
│  L1 — INFRASTRUCTURE LAYER                                                │
│  Express API · PostgreSQL · Vite Frontend · Railway · pnpm Workspace     │
└──────────────────────────────────────────────────────────────────────────┘
```

L1 is fully built. L2–L5 are the v3.0 build-out, sequenced across Phases 2–6.

---

## 5. Current State — Honest Baseline

As of v2.0 (2026-04-18), the following is confirmed built and verified:

| Capability                    | Status       | Notes                                      |
| ----------------------------- | ------------ | ------------------------------------------ |
| Dashboard UI (12 views)       | ✅ Built     | All views rendered, typecheck clean        |
| SSE metrics stream            | ✅ Built     | Active users, subscriber count             |
| Agent chat (streaming)        | ✅ Built     | Single-turn and multi-turn                 |
| Agent abort handling          | ✅ Built     | `stream.on("abort")` — confirmed in source |
| tsx watch hot reload          | ✅ Built     | Sub-500ms restart                          |
| Git hooks                     | ✅ Built     | Pre-commit prettier, pre-push typecheck    |
| DB migrate/generate scripts   | ✅ Built     | Drizzle migration workflow                 |
| Vitest workspace              | ✅ Built     | Runner configured, zero test files yet     |
| Agent tool use                | ❌ Not built | FR-014 — Phase 3                           |
| Request authentication        | ❌ Not built | FR-016 — Phase 2                           |
| Conversation persistence      | ❌ Not built | FR-015 — Phase 2                           |
| System health score           | ❌ Not built | FR-023 — Phase 3                           |
| Drift detection               | ❌ Not built | FR-024 — Phase 3                           |
| Planning engine               | ❌ Not built | FR-029 — Phase 4                           |
| Multi-agent system            | ❌ Not built | FR-030 — Phase 4                           |
| Policy Engine (L5 governance) | ❌ Not built | FR-027 — Phase 4                           |
| Self-evolution                | ❌ Not built | FR-034 — Phase 5                           |
| Meta-evolution                | ❌ Not built | FR-037 — Phase 5                           |
| Distributed intelligence      | ❌ Not built | FR-039 — Phase 6                           |

---

## 6. Feature Requirements — Phase 2 (Hardening)

_Target: 4 weeks. Prerequisite gate for all subsequent phases._

### FR-016: Request Authentication

Bearer token middleware on all routes except `/api/healthz`. `API_SECRET` env var on Railway. `VITE_API_SECRET` in Vite env config, injected into the custom fetch wrapper in `lib/api-client-react`. SSE connections pass token as `Authorization` header on the initial request. `401` responses handled by frontend as error state.

### FR-015: Conversation Persistence (Phase 1 — localStorage)

localStorage-backed conversation history. Restores on page reload. Capped at 50 messages with graceful truncation. Clear button empties both Zustand store and localStorage. Required before agent tool use — tool results must persist in history for correct follow-up reasoning.

### FR-017: Streaming Cancel

`AbortController` per request in `AgentSuitePanel`. Cancel button visible only during active streaming. Partial response preserved in chat history on cancel. No server changes needed — server already handles `req.on("close")` correctly.

### FR-018: ESLint

Flat config (`eslint.config.js`) at workspace root. Plugins: `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks`, `eslint-config-prettier`. Zero lint errors on current codebase before enabling. `"lint": "eslint ."` added to root scripts. `pre-push` hook updated: `pnpm typecheck && pnpm lint`.

### FR-019: Test Coverage — `lib/api-zod`

Unit tests for every Zod schema. Parse valid inputs, reject invalid inputs, verify error messages. 80% line coverage threshold enforced in `vitest.config.ts`. Tests colocated with source: `schema.test.ts` beside `schema.ts`.

### FR-020: CI Pipeline

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

Target: under 3 minutes. All six checks must pass for green CI.

### FR-021: Metrics Persistence to PostgreSQL

`metrics_kv` table. Upsert on every increment (async, non-blocking). DB write failure does not block heartbeat response. Eliminates the `/tmp/r3-metrics.json` reset-on-deploy issue.

### FR-022: Structured Error Responses

All routes return `{ error: string; code?: string; requestId?: string }`. Global error handler added to `app.ts`. Type defined in `lib/api-spec/openapi.yaml` and regenerated downstream. No route returns HTML for any error condition.

---

## 7. Feature Requirements — Phase 3 (Intelligence)

_Target: 8 weeks. Requires Phase 2 complete and CI green._

### FR-014: Agent Tool Use

Server-side tool execution via Anthropic tool_use API. Three risk tiers with clear trust requirements.

**Safe Tools — auto-execute at L2 (default trust):**

| Tool             | Implementation            | Constraint                  |
| ---------------- | ------------------------- | --------------------------- |
| `read_file`      | `fs.readFile`             | Sandboxed to workspace root |
| `list_directory` | `fs.readdir` recursive    | Sandboxed to workspace root |
| `get_metrics`    | In-memory metrics state   | No I/O                      |
| `list_routes`    | Introspect Express router | No I/O                      |

**Sandbox enforcement (applies to all file tools):**

```typescript
function assertSandboxed(requestedPath: string, root: string): void {
  const resolved = path.resolve(requestedPath);
  if (!resolved.startsWith(root)) {
    throw new Error(`Path escape blocked: ${requestedPath}`);
  }
}
```

**Controlled Tools — require L3 trust or inline confirmation:**

| Tool            | Implementation                                                     | Timeout |
| --------------- | ------------------------------------------------------------------ | ------- |
| `run_typecheck` | `child_process.exec('pnpm typecheck')`, stdout returned            | 60s     |
| `run_tests`     | `child_process.exec('pnpm test --run')`, parsed Vitest JSON output | 120s    |
| `query_db`      | Drizzle raw query inside `SET TRANSACTION READ ONLY`               | 10s     |

**Phase 3 confirmation mechanism (pre-Planning Engine):** Before any controlled tool executes, the agent emits a `confirm_required` SSE event to the frontend with the tool name and arguments. The `AgentSuitePanel` renders a confirmation prompt inline in the chat. The tool does not execute until the user clicks "Confirm" or "Cancel". The full Planning Engine (FR-029) replaces this with a richer step-by-step plan UI in Phase 4.

`query_db` DDL guard:

```typescript
const FORBIDDEN = /^\s*(DROP|CREATE|ALTER|TRUNCATE|INSERT|UPDATE|DELETE)/i;
if (FORBIDDEN.test(sql)) throw new Error("DDL and write queries are forbidden");
```

**Restricted Tools — require L4 trust + human confirmation (Phase 4+):**
`write_file`, `apply_patch`, `run_migration`, `trigger_deploy`

**Tool result streaming:** `tool_use` and `tool_result` SSE events emitted inline alongside `text_delta`. Frontend renders tool call blocks as distinct UI elements in chat.

### FR-023: System Health Score

Composite 0–100 score. Computed on-demand, cached 60 seconds. Triggered by: deploy, agent action, manual request. Never computed on a background interval — compute is triggered, not polling.

```typescript
interface HealthScore {
  score: number; // 0–100 weighted composite
  components: {
    typecheck: number; // 0 or 100
    testPassRate: number | null; // 0–100, null if no test files exist yet
    buildSuccess: number; // 0 or 100
    errorRate: number; // 0–100 (inverted: 0 errors = 100)
    agentSuccessRate: number | null; // 0–100, null until Phase 4 agent actions exist
  };
  trend: "improving" | "stable" | "degrading";
  computedAt: string;
}
```

Surfaced in `OverviewView` as a prominent score with component breakdown.

### FR-024: Drift Detection

Rolling 24-hour window. Alerts on:

- Error rate increases > 50% vs. prior period
- Build time increases > 100% vs. 7-day average
- Test pass rate drops > 10 percentage points

Alerts are non-blocking warnings in `OverviewView`. No automated action — human decides response. Stored in `system_health_snapshots` for trend history.

### FR-025: Metrics History

`metrics_events` time-series table. `GET /api/metrics/history?period=7d`. Line chart in `OverviewView` using recharts.

### FR-026: Conversation Persistence (Phase 2 — Database)

`conversations` and `messages` tables. POST each conversation turn to `/api/agent/conversations`. Load history on mount from `/api/agent/conversations/:id`. Required before multi-agent (Phase 4) — agents need shared conversation context.

---

## 8. Feature Requirements — Phase 4 (Autonomy)

_Target: 12 weeks. Requires Phase 3 stable in production for 14 days._

### FR-027: Policy Engine (L5 Governance)

Every agent action passes through the Policy Engine before execution. The engine is typed, testable, and cannot be modified by agent actions.

```typescript
interface PolicyContext {
  action: AgentAction;
  trust: TrustLevel;
  systemHealthScore: number;
  testPassRate: number | null;
  lastDeployStatus: "success" | "failure" | "unknown";
  pendingMigrations: number;
  agentSuccessRate7d: number | null;
  openPolicyViolations: number;
}

type PolicyVerdict = "allow" | "deny" | "require_confirmation";

interface Policy {
  id: string;
  description: string;
  condition: (ctx: PolicyContext) => boolean;
  verdict: PolicyVerdict;
  reason: string;
}
```

**Default policies (non-negotiable, not configurable at runtime):**

```typescript
const DEFAULT_POLICIES: Policy[] = [
  {
    id: "no-deploy-low-tests",
    description: "Block deploy if test pass rate < 95%",
    condition: (ctx) =>
      ctx.action.type === "trigger_deploy" && (ctx.testPassRate ?? 0) < 95,
    verdict: "deny",
    reason: "Test pass rate below 95% threshold",
    // NOTE: when testPassRate is null (no test files exist yet), null ?? 0 = 0 < 95 = true.
    // This intentionally blocks all deploys until a test suite exists.
    // Acceptance: first deploy after FR-019 is complete.
  },
  {
    id: "no-migration-without-confirmation",
    description: "All migrations require explicit confirmation",
    condition: (ctx) => ctx.action.type === "run_migration",
    verdict: "require_confirmation",
    reason: "Migrations are irreversible — explicit approval required",
  },
  {
    id: "no-write-degrading-health",
    description: "Block file writes when system health < 60",
    condition: (ctx) =>
      ctx.action.type === "write_file" && ctx.systemHealthScore < 60,
    verdict: "deny",
    reason: "System health too low for write operations",
  },
  {
    id: "no-deploy-degrading-trend",
    description: "Require confirmation for deploy when health degrading",
    condition: (ctx) =>
      ctx.action.type === "trigger_deploy" && ctx.systemHealthScore < 70,
    verdict: "require_confirmation",
    reason:
      "System health degrading — explicit approval required before deploy",
  },
];
```

**Execution Gate flow:**

```
Agent → proposed AgentAction
  → PolicyEngine.evaluate(action, context) → verdict
    "allow"               → execute immediately, log to audit_log
    "require_confirmation" → surface to UI, await typed acknowledgment, log
    "deny"                → reject with reason, log to audit_log, no execution
```

All verdicts are logged to `audit_log`. The audit log is append-only.

### FR-028: Trust Authority Model

Trust levels are not granted automatically. Escalation requires explicit operator action.

```typescript
type TrustLevel = "L0" | "L1" | "L2" | "L3" | "L4";
// L0: Read-only (no file content, no metrics writes)
// L1: Suggest actions only — no tool execution
// L2: Execute safe tools automatically (DEFAULT)
// L3: Execute controlled tools subject to policy check
// L4: Execute restricted tools with human confirmation gate
```

**Escalation protocol:**

- L2 is the default. Set by omitting `AGENT_TRUST_LEVEL` env var.
- L3: Set `AGENT_TRUST_LEVEL=L3`. Restart server. No other steps.
- L4: Set `AGENT_TRUST_LEVEL=L4` AND `AGENT_DEPLOY_CONFIRMED=true`. Restart server.
- No runtime escalation — prevents prompt injection attacks from elevating trust within a session.
- Trust level is read once at startup and never changed until next restart.

### FR-029: Planning Engine

Before executing any multi-step or controlled/restricted action, the agent creates a structured plan. The plan is shown to the developer before any tool calls are made.

```typescript
interface AgentPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  estimatedRisk: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  status: "pending" | "approved" | "running" | "complete" | "rejected";
  createdAt: string;
  approvedAt: string | null;
}

interface PlanStep {
  index: number;
  description: string;
  tool: string | null;
  toolArgs: Record<string, unknown> | null;
  riskLevel: "safe" | "controlled" | "restricted";
  status: "pending" | "running" | "complete" | "failed" | "skipped";
}
```

`AgentSuitePanel` renders the plan as an interactive step list before execution. User can: approve entire plan, reject, or reject individual steps. Approved plan is persisted to `agent_plans` table. Rejected plans are logged but not executed.

### FR-030: Multi-Agent System

Four specialized roles communicating via an in-process typed message bus. All roles run in the same Node process. No separate services. Opt-in via `MULTI_AGENT_MODE=true` env var — defaults to single-agent mode.

```typescript
type AgentRole = "Builder" | "Auditor" | "Operator" | "Analyst";

interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole | "broadcast";
  type: "task" | "result" | "critique" | "decision" | "status";
  payload: unknown;
  timestamp: string;
}
```

**Role definitions:**

| Agent    | Responsibility                                               | Tool access                                                               |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Analyst  | Reads system state, computes health, surfaces anomalies      | `get_metrics`, `list_routes`, `query_db`(read)                            |
| Builder  | Generates solution strategies from the strategy store        | `read_file`, `list_directory`                                             |
| Auditor  | Critiques Builder output for correctness, risk, side-effects | `read_file`, `run_typecheck`                                              |
| Operator | Executes the approved plan, handles deploy                   | `run_tests`, `apply_patch`(L4), `run_migration`(L4), `trigger_deploy`(L4) |

**Coordination flow:**

```
User request
  → Analyst: assess system state, compute context
  → Builder: generate N solution strategies (using strategy store weights)
  → Auditor: score each strategy for correctness, risk, side-effects
  → PolicyEngine: gate execution based on scores and context
  → [Human confirmation if required_confirmation]
  → Operator: execute approved plan step by step
  → Analyst: verify outcome, update health score
  → EvolutionTracker: record result
```

### FR-031: Simulation Engine

Before any restricted tool executes, a simulation pass runs first. "Simulation" is defined concretely for each tool type:

| Tool                         | Simulation                                                                    | Accept condition           |
| ---------------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| `write_file` / `apply_patch` | Apply changes in a temp copy of the file, run `pnpm typecheck --noEmit` on it | Zero new TypeScript errors |
| `run_migration`              | Run `drizzle-kit generate --check` to verify migration is valid               | No generation errors       |
| `trigger_deploy`             | Run `pnpm build` against current source                                       | Build succeeds             |

Simulation failures block execution and surface the failure reason in the plan UI. The original file is never touched during simulation.

### FR-032: Rollback System

Every restricted tool execution records a rollback snapshot before acting. `apply_patch` captures the original file content. `run_migration` records the migration version before applying. On failure, the Operator agent calls `rollback(planId)` which restores the pre-action state. Rollback records are stored in `audit_log` alongside the original action. Rollback is always available for 72 hours after execution.

### FR-033: Agent Action History View

New dashboard view (`ActionHistoryView`) showing a filterable, paginated log of all agent actions pulled from `audit_log`. Columns: timestamp, agent role, action type, tool, policy verdict, outcome. Clicking any row expands to show full payload and result. Replaces the need to query the DB directly for audit information. Added to sidebar nav alongside existing views.

---

## 9. Feature Requirements — Phase 5 (Self-Evolution)

_Target: 20 weeks. Requires Phase 4 stable in production for 30 days._

### FR-034: Evolution Tracker

Records every agent action outcome. Persisted to PostgreSQL. This is the ground truth for all strategy optimization.

```typescript
// lib/db/src/schema/index.ts
export const evolutionLogs = pgTable("evolution_logs", {
  id: serial("id").primaryKey(),
  strategy: varchar("strategy", { length: 128 }).notNull(),
  input: text("input").notNull(),
  success: boolean("success").notNull(),
  score: numeric("score", { precision: 5, scale: 4 }).notNull(),
  durationMs: integer("duration_ms").notNull(),
  rollback: boolean("rollback").notNull().default(false),
  agentRole: varchar("agent_role", { length: 32 }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
});
```

### FR-035: Strategy Store + Evolution Cycle

Strategy weights persisted to PostgreSQL. Updated via evolution cycles. The cycle runs every N agent executions (default N=20, persisted to `system_state`).

```typescript
export const strategyWeights = pgTable("strategy_weights", {
  strategy: varchar("strategy", { length: 128 }).primaryKey(),
  weight: numeric("weight", { precision: 5, scale: 4 }).notNull(),
  sampleSize: integer("sample_size").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const systemState = pgTable("system_state", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  // key: "execution_count" → { count: number }
  // key: "last_evolution"  → { at: string, strategiesUpdated: number }
});
```

**Performance analysis — divide-by-zero guarded:**

```typescript
function analyzePerformance(entries: EvolutionLog[]): StrategyAnalysis[] {
  const byStrategy = new Map<string, { success: number; total: number }>();
  for (const e of entries) {
    const s = byStrategy.get(e.strategy) ?? { success: 0, total: 0 };
    s.total++;
    if (e.success) s.success++;
    byStrategy.set(e.strategy, s);
  }
  return Array.from(byStrategy.entries()).map(([strategy, stats]) => ({
    strategy,
    successRate: stats.total === 0 ? 0 : stats.success / stats.total,
    sampleSize: stats.total,
  }));
}
```

**Winner selection — edge case fixed:**

```typescript
const MIN_SAMPLE_SIZE = 10; // never update weights with fewer than 10 observations
const MIN_DELTA_IMPROVEMENT = 0.1; // require 10%+ improvement
const MIN_ADOPTION_SCORE = 0.05; // absolute floor — fixes baselineScore===0 edge case

function selectWinner(
  evaluated: { variant: Config; score: number }[],
  baselineScore: number,
): Config | null {
  if (evaluated.length === 0) return null; // guard: no candidates to evaluate
  const best = [...evaluated].sort((a, b) => b.score - a.score)[0];
  const threshold = Math.max(
    baselineScore * (1 + MIN_DELTA_IMPROVEMENT),
    MIN_ADOPTION_SCORE,
  );
  return best.score > threshold ? best.variant : null;
}
```

**Drastic swing protection — actually implemented:**

```typescript
const MAX_DELTA_PER_CYCLE = 0.3;

function validateEvolution(
  oldWeights: Map<string, number>,
  newWeights: Map<string, number>,
): void {
  if (newWeights.size === 0) {
    throw new Error("Invalid evolution: strategy store cannot be empty");
  }
  for (const [strategy, newWeight] of newWeights) {
    const oldWeight = oldWeights.get(strategy) ?? 0.5;
    const delta = Math.abs(newWeight - oldWeight);
    if (delta > MAX_DELTA_PER_CYCLE) {
      throw new Error(
        `Strategy "${strategy}" weight changed by ${delta.toFixed(3)} ` +
          `— exceeds ${MAX_DELTA_PER_CYCLE} drastic-swing threshold. ` +
          `Evolution cycle rejected.`,
      );
    }
  }
  // Ensure at least 3 strategies retain meaningful weight
  const meaningful = [...newWeights.values()].filter((w) => w > 0.1).length;
  if (meaningful < 3) {
    throw new Error(
      "Evolution would reduce viable strategies below minimum of 3",
    );
  }
}
```

**Hard safety constraints (not configurable):**

1. Minimum `MIN_SAMPLE_SIZE` observations before updating any strategy weight
2. Maximum weight delta of `MAX_DELTA_PER_CYCLE` per evolution cycle
3. Always maintain at least 3 strategies with weight > 0.1
4. Evolution logic itself is not a valid target for agent modification
5. System cannot invent new tools — tool definitions are static at startup

### FR-036: Evolution Dashboard View

New dashboard view (`EvolutionView`) surfacing the live state of the strategy store. Shows: all active strategies with current weights as a bar chart, recent evolution cycle results (before/after weights), evolution log entries for the last 100 executions, and the next scheduled evolution cycle countdown. Read-only — no agent actions triggered from this view. Added to sidebar nav.

### FR-037: Meta-Evolution (Contained)

The system evolves prompt strategies, scoring weights, and strategy selection logic through controlled A/B experiments. It does NOT modify: execution pipeline, security rules, governance policies, tool definitions.

```typescript
// Fully typed — prevents runtime string comparison bugs
type MetaChangeTarget =
  | "prompt_strategy"
  | "scoring_weights"
  | "strategy_selection";
// NOTE: "execution_engine", "security", "governance" are NOT valid MetaChangeTarget values
// This is enforced by the TypeScript type system, not by runtime string comparison

interface MetaChange {
  affects: MetaChangeTarget;
  fromConfig: MetaConfig;
  toConfig: MetaConfig;
  experimentScore: number;
  baselineScore: number;
  sampleSize: number; // must be >= 50 before meta-evolution runs
}

// MetaRegistry persisted to DB — never in-memory
export const metaConfig = pgTable("meta_config", {
  id: serial("id").primaryKey(),
  config: jsonb("config").notNull(),
  source: varchar("source", { length: 32 }).notNull(), // "default" | "experiment"
  experimentId: varchar("experiment_id", { length: 64 }),
  adoptedAt: timestamp("adopted_at", { withTimezone: true }).defaultNow(),
});
```

**Meta-evolution runs every 20 agent executions, only if:**

- Sample size in `evolution_logs` >= 50
- No active meta-experiment already running
- System health score >= 70 (no experiments during degraded state)

**`ctx.sampleTask` definition:** The sample task used for meta-evolution experiments is the most recent entry in `evolution_logs` where `success = true`. This provides a real, representative task from actual system operation — not a synthetic benchmark. If no successful entries exist, meta-evolution is skipped for that cycle.

---

## 10. Feature Requirements — Phase 6 (Distributed)

_Target: 32+ weeks. Requires Phase 5 stable in production for 30 days AND a second operational node._

### Prerequisite gate

Phase 6 does not begin until:

1. Phase 5 single-node system is stable in production for 30 days with no P0 incidents
2. A genuine second node exists (second R3 v4 environment or sister project)
3. Operator has reviewed and accepted the security model for cross-node data sharing

Distributing an unstable single-node system creates distributed instability.

### FR-038: Node Identity Management

Before Phase 6 can begin, each node requires a permanent ed25519 identity. `AGENT_NODE_KEY` env var holds the private key (hex or PEM). On startup, the server derives the public key, computes the SHA-256 node ID, and logs it. A CLI utility (`scripts/generate-node-key.ts`) generates a keypair and prints the private key for setting as the env var. Keys are never stored in the codebase or committed to git.

### FR-039: Shared Insight Model

Nodes share validated strategy metadata — not code, not secrets, not file content.

```typescript
interface SharedInsight {
  nodeId: string; // SHA-256 of node identity public key — no PII
  strategy: string; // strategy name only — no prompt content
  successRate: number;
  sampleSize: number; // must be >= 20 to be shareable
  context: "patch" | "typecheck" | "migration" | "deploy" | "query";
  timestamp: number;
  signature: string; // ed25519 signature of the above fields
}
```

**What NEVER gets shared:**

- Raw codebase or file contents
- Secrets or environment variables
- Agent conversation history
- Database rows or query results
- Prompt text (only strategy names and success rates)
- Node identity beyond the hashed public key

### FR-040: Sync Protocol

HTTP REST between nodes. Authenticated via ed25519 node identity keys.

```
POST /api/sync/insights   — push local validated insights (signed)
GET  /api/sync/insights   — pull global top-10 insights (filtered by reputation)
GET  /api/sync/reputation — reputation scores for known nodes
```

**Node identity:** Each node has `AGENT_NODE_KEY` (ed25519 private key, env var). Public key is the node's permanent identity. All pushed insights are signed. Receiving node verifies signature before storing.

### FR-041: Reputation System

Persisted to PostgreSQL. Not in-memory.

```typescript
export const nodeReputation = pgTable("node_reputation", {
  nodeId: varchar("node_id", { length: 64 }).primaryKey(), // SHA-256 hex of public key
  score: numeric("score", { precision: 4, scale: 3 })
    .notNull()
    .default("0.500"),
  interactions: integer("interactions").notNull().default(0),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow(),
});
// Signature encoding: base64url throughout (ed25519 sig = 64 bytes = 86 base64url chars + padding)
// varchar(96) provides safe margin for base64url-encoded ed25519 signatures
```

Score updates: +0.05 when an adopted strategy succeeds, -0.05 when it fails. Nodes with score < 0.7 are filtered before insights are added to the local strategy pool. Local scoring always takes precedence — global insights are a weighted prior, never an override.

### FR-042: Knowledge Base

Persisted to PostgreSQL. Insights expire after 30 days.

```typescript
export const globalInsights = pgTable("global_insights", {
  id: serial("id").primaryKey(),
  nodeId: varchar("node_id", { length: 64 }).notNull(),
  strategy: varchar("strategy", { length: 128 }).notNull(),
  successRate: numeric("success_rate", { precision: 5, scale: 4 }).notNull(),
  sampleSize: integer("sample_size").notNull(),
  context: varchar("context", { length: 32 }).notNull(),
  signature: varchar("signature", { length: 96 }).notNull(), // base64url ed25519 signature
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
```

**Conflict resolution:** When local and global strategies conflict, local scoring decides. Global insights expand the strategy pool — they never replace local strategy weights.

---

## 11. Technical Requirements

### Stack constraints (non-negotiable)

| Layer           | Technology                 | Constraint                                            |
| --------------- | -------------------------- | ----------------------------------------------------- |
| Frontend        | React 19 + Vite 7          | Fixed                                                 |
| CSS             | Tailwind CSS 4             | Fixed                                                 |
| Components      | shadcn/ui                  | Fixed                                                 |
| Backend         | Express 5                  | Fixed                                                 |
| Runtime         | Node.js 22                 | Minimum — esbuild transform requires 22+              |
| ORM             | Drizzle ORM                | Fixed — all table refs are typed, never string        |
| Database        | PostgreSQL                 | Fixed                                                 |
| AI SDK          | `@anthropic-ai/sdk`        | Fixed                                                 |
| AI model        | `claude-sonnet-4-20250514` | Default; configurable per feature                     |
| Package manager | pnpm 10                    | Fixed                                                 |
| Language        | TypeScript strict          | Fixed — no `any` without explicit suppression comment |

### Stateful components — persistence requirements

Every component driving agent decisions MUST be persisted to PostgreSQL. In-memory is never acceptable for stateful components. Complete list:

| Component         | Table                       | Phase |
| ----------------- | --------------------------- | ----- |
| Strategy weights  | `strategy_weights`          | 5     |
| Evolution logs    | `evolution_logs`            | 5     |
| Execution counter | `system_state`              | 5     |
| Meta config       | `meta_config`               | 5     |
| Agent plans       | `agent_plans`               | 4     |
| Audit log         | `audit_log`                 | 4     |
| Node reputation   | `node_reputation`           | 6     |
| Global insights   | `global_insights`           | 6     |
| Health snapshots  | `system_health_snapshots`   | 3     |
| Metrics history   | `metrics_events`            | 3     |
| Conversations     | `conversations`, `messages` | 3     |
| Tool call logs    | `agent_tool_calls`          | 3     |

### Agent execution constraints (hard rules)

- All agent file operations sandboxed to workspace root via `path.resolve` + `startsWith`
- All agent DB queries run in `READ ONLY` transaction unless `L4` trust + policy gate
- All agent subprocesses have hard timeouts (`run_typecheck`: 60s, `run_tests`: 120s)
- No agent action modifies the evolution system, governance rules, or tool definitions
- No trust escalation without process restart
- No meta-change target can be "execution_engine", "security", or "governance" — enforced by TypeScript type, not runtime string check

---

## 12. Data Model

Complete schema progression across all phases. Each phase adds tables; no existing tables are modified destructively.

### Phase 2

```typescript
// metrics_kv — totalSubscribers persistence (FR-021)
// (defined in PRD v2.0 — unchanged)
// NOTE: metrics_events (time-series history) is Phase 3 (FR-025).
// conversations and messages tables are Phase 3 (FR-026), not Phase 2.
// Phase 2 conversation persistence uses localStorage only (FR-015).
```

### Phase 3

```typescript
export const agentToolCalls = pgTable("agent_tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  tool: varchar("tool", { length: 64 }).notNull(),
  args: jsonb("args").notNull(),
  result: jsonb("result"),
  success: boolean("success"),
  durationMs: integer("duration_ms"),
  calledAt: timestamp("called_at", { withTimezone: true }).defaultNow(),
});

export const systemHealthSnapshots = pgTable("system_health_snapshots", {
  id: serial("id").primaryKey(),
  score: integer("score").notNull(),
  components: jsonb("components").notNull(),
  trend: varchar("trend", { length: 16 }).notNull(),
  snapAt: timestamp("snap_at", { withTimezone: true }).defaultNow(),
});
```

### Phase 4

```typescript
export const agentPlans = pgTable("agent_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  goal: text("goal").notNull(),
  steps: jsonb("steps").notNull(),
  estimatedRisk: varchar("estimated_risk", { length: 16 }).notNull(),
  requiresConfirmation: boolean("requires_confirmation").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actionType: varchar("action_type", { length: 64 }).notNull(),
  agentRole: varchar("agent_role", { length: 32 }),
  trustLevel: varchar("trust_level", { length: 4 }).notNull(),
  policyVerdict: varchar("policy_verdict", { length: 32 }).notNull(),
  policyId: varchar("policy_id", { length: 64 }),
  payload: jsonb("payload"),
  result: jsonb("result"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow(),
});
```

### Phase 5

```typescript
export const evolutionLogs = pgTable("evolution_logs", {
  /* see FR-034 */
});
export const strategyWeights = pgTable("strategy_weights", {
  /* see FR-035 */
});
export const systemState = pgTable("system_state", {
  /* see FR-035 */
});
export const metaConfig = pgTable("meta_config", {
  /* see FR-037 */
});
```

### Phase 6

```typescript
export const nodeReputation = pgTable("node_reputation", {
  /* see FR-041 */
});
export const globalInsights = pgTable("global_insights", {
  /* see FR-042 */
});
```

---

## 13. Security Model

### Zero-trust agent

The agent is treated as an external actor. No action executes without passing through the Policy Engine. Every action is logged. Every failure is diagnosable. The audit log is append-only.

### Immutable rules (cannot be modified by any agent action, at any trust level)

1. The Policy Engine and its default policies are read-only to the agent
2. Tool definitions are static — the agent cannot create new tools
3. Trust levels are static per process lifetime — no runtime escalation
4. The governance layer cannot govern itself
5. Meta-evolution cannot target the execution pipeline, security rules, or governance
6. No path traversal outside workspace root, regardless of trust level
7. No DB writes in `READ ONLY` transactions, regardless of trust level

### Trust levels and capabilities

```
L0  Observe     — no tool access, suggestions only (displayed to human)
L1  Suggest     — no tool execution, plan display only
L2  Execute     — safe tools auto-run (DEFAULT)
L3  Control     — controlled tools subject to policy check
L4  Restrict    — restricted tools with human confirmation + policy gate
```

### Distributed security (Phase 6)

- Node identity: ed25519 keypair — private key in `AGENT_NODE_KEY` env var
- All pushed insights are signed; signature verified before storage
- Nodes with reputation < 0.7 filtered by federation layer
- No remote execution — nodes share metadata, never executable code
- No shared secrets, env vars, file access, or database rows

---

## 14. Non-Functional Requirements

### Performance targets

| Metric                   | Target                     |
| ------------------------ | -------------------------- |
| Safe tool response       | < 200ms p99                |
| Controlled tool response | < 30s (bounded by timeout) |
| Health score computation | < 2s                       |
| Policy evaluation        | < 10ms                     |
| Evolution cycle          | < 10s                      |
| Agent plan generation    | < 5s                       |

### Reliability guarantees

| Guarantee                 | Mechanism                                                                 |
| ------------------------- | ------------------------------------------------------------------------- |
| No silent failures        | Every agent action logged to `audit_log`                                  |
| No unverified execution   | All actions pass PolicyEngine                                             |
| No untracked changes      | `audit_log` is append-only                                                |
| Every change reversible   | `apply_patch` requires diff preview; rollback tracked in `evolution_logs` |
| Every failure diagnosable | Structured error + `audit_log` entry + source maps                        |

### Self-healing scope

**Within scope (L2–L3 trust, subject to policy gate):**

- TypeScript errors in non-governance source files (after human confirms plan)
- Failing tests caused by stale snapshots or minor interface drift
- Metric anomalies with diagnosable root causes

**Out of scope (never autonomous):**

- Governance rules and policies
- Security configuration
- Core execution pipeline
- Database schema (requires migration + human approval)
- Deployment configuration
- Tool definitions

---

## 15. Success Metrics

### Phase 2

| Metric                    | Target             |
| ------------------------- | ------------------ |
| Server uptime             | > 99.5% / 7 days   |
| CI pass rate              | > 98% on first run |
| TypeScript errors on main | 0 at all times     |

### Phase 3

| Metric                           | Target      |
| -------------------------------- | ----------- |
| Agent tool success rate          | > 90%       |
| Health score computation latency | < 2s        |
| `lib/api-zod` test coverage      | > 80% lines |

### Phase 4

| Metric                              | Target |
| ----------------------------------- | ------ |
| Policy gate false-deny rate         | < 5%   |
| Human interventions per agent cycle | < 30%  |
| All agent actions logged            | 100%   |

### Phase 5

| Metric                                 | Target                                  |
| -------------------------------------- | --------------------------------------- |
| Strategy drastic swings                | 0 (validator enforces)                  |
| Self-healed issues (no human required) | > 40% of L2-eligible failures           |
| Agent success rate trend               | Measurably improving over 30-day window |
| Evolution cycle runtime                | < 10s                                   |

### Phase 6

| Metric                               | Target                         |
| ------------------------------------ | ------------------------------ |
| Cross-node strategy adoption success | > 70%                          |
| Node independence violations         | 0                              |
| Security incidents                   | 0                              |
| Bad strategy propagation             | 0 (reputation filter prevents) |

---

## 16. Release Phases

| Phase | Name           | Target                 | Gate to next phase                                         |
| ----- | -------------- | ---------------------- | ---------------------------------------------------------- |
| 1     | Foundation     | ✅ Complete 2026-04-18 | —                                                          |
| 2     | Hardening      | +4 weeks               | All FRs passing CI, zero P0                                |
| 3     | Intelligence   | +8 weeks               | Tool use stable, health score live for 14 days             |
| 4     | Autonomy       | +12 weeks              | Policy Engine + multi-agent stable for 14 days             |
| 5     | Self-Evolution | +20 weeks              | Phase 4 in production for 30 days, no P0                   |
| 6     | Distributed    | +32 weeks              | Phase 5 in production for 30 days, second node operational |

**Phase gate rule:** No phase begins until the prior phase is stable in production for the gated duration with zero P0 incidents.

---

## 17. Decisions Log

| Date       | Decision                                                       | Rationale                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-18 | All stateful AI components persisted to PostgreSQL             | StrategyStore, KnowledgeBase, Reputation, MetaRegistry cannot live in-memory. Process restarts would reset all learning. Accepted no exceptions.                                                                      |
| 2026-04-18 | Trust escalation requires server restart                       | Prevents prompt injection attacks from elevating agent trust at runtime. The attack surface is too large to allow runtime escalation.                                                                                 |
| 2026-04-18 | Multi-agent: in-process message bus, not separate services     | Current scale doesn't justify separate process overhead. One Node process per deployment. Revisit in Phase 6 if needed.                                                                                               |
| 2026-04-18 | `PolicyContext` fully typed — no `any`                         | Untyped policy conditions are unimplementable, untestable, and unsafe. Type safety is non-negotiable for governance code.                                                                                             |
| 2026-04-18 | `MetaChangeTarget` is a union type, not a runtime string check | The governance lock in the source doc used string comparison (`metaChange.affects === "execution_engine"`). This is unsafe — a typo bypasses it silently. TypeScript union type enforcement is the correct mechanism. |
| 2026-04-18 | Min 10 samples before strategy weight update                   | Prevents premature optimization from small-N noise. A strategy that succeeded 3 times is not a reliable strategy.                                                                                                     |
| 2026-04-18 | Max 0.3 weight delta per evolution cycle                       | Allows meaningful adaptation while preventing runaway optimization. Recoverable within 3–4 cycles if wrong direction.                                                                                                 |
| 2026-04-18 | MIN_ADOPTION_SCORE = 0.05 floor on selectWinner                | When baselineScore===0 (new system), `baselineScore * 1.1 = 0` means nothing ever wins. Absolute floor ensures new systems can adopt better strategies.                                                               |
| 2026-04-18 | Global insights are advisory — local scoring always primary    | Prevents bad-strategy-spreads failure mode. A poisoned or miscalibrated remote node cannot override local decision-making.                                                                                            |
| 2026-04-18 | Phase 6 gated on 30 days of stable Phase 5                     | Distributing an unstable single-node system creates distributed instability. Stability must be proven before adding coordination complexity.                                                                          |
| 2026-04-18 | System conflation from source doc rejected                     | AGI-CMD is one subsystem of Agi-Suite. Agi-Suite is the platform. Treating them as identical creates confused ownership, lifecycle management, and security boundaries.                                               |
| 2026-04-18 | Self-healing scope explicitly bounded                          | The "what NOT to automate" question is as important as what to automate. Governance, security, schema, and deployment remain human-controlled at all phases.                                                          |
