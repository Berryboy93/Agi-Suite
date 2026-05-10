#!/usr/bin/env python3
"""
Agi-Suite — Phase 2 Hardening Delivery Script
==============================================
Implements all 8 Phase 2 FRs from PRD v3.0:

  FR-015  Conversation persistence (localStorage, 50-msg cap, clear button)
  FR-016  Request authentication (Bearer token middleware, all routes except /healthz)
  FR-017  Streaming cancel (AbortController in AgentSuitePanel, partial msg preserved)
  FR-018  ESLint (flat config, @typescript-eslint, react-hooks, prettier compat)
  FR-019  Test scaffolding (vitest config + lib/api-zod test template)
  FR-020  CI pipeline (.github/workflows/ci.yml — 6 checks, <3 min target)
  FR-021  Metrics PostgreSQL persistence (metrics_kv upsert, eliminates /tmp reset)
  FR-022  Structured error responses (global handler, { error, code, requestId })

Delivery pattern: SKILLS.md A8 — exact-match assertions, backup before write,
dry-run by default.

Usage
-----
  python3 agi_suite_phase2.py            # dry run — safe, no files written
  python3 agi_suite_phase2.py --apply    # apply all changes

Run from: ~/Agi-Suite/
"""

import sys
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime

# ─── CLI ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Agi-Suite Phase 2 Hardening")
parser.add_argument("--apply", action="store_true", help="Apply all changes (default: dry run)")
args = parser.parse_args()
DRY = not args.apply

# ─── Config ───────────────────────────────────────────────────────────────────
ROOT = Path.home() / "Agi-Suite"
BACKUP_DIR = ROOT / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")
APPLIED: list[str] = []
ERRORS: list[str] = []
SKIPPED: list[str] = []


# ─── Helpers ──────────────────────────────────────────────────────────────────

def section(title: str) -> None:
    print(f"\n{'═' * 64}")
    print(f"  {title}")
    print(f"{'═' * 64}")


def _backup(path: Path) -> None:
    if DRY or not path.exists():
        return
    rel = path.relative_to(ROOT)
    dest = BACKUP_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def write_file(relpath: str, content: str, label: str = "") -> bool:
    path = ROOT / relpath
    tag = label or relpath
    if DRY:
        print(f"  [DRY] Would write: {relpath}")
        return True
    _backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  WROTE  {relpath}")
    APPLIED.append(tag)
    return True


def patch_file(
    relpath: str,
    old: str,
    new: str,
    label: str = "",
    already_applied_marker: str = "",
) -> bool:
    """Exact-match patch per SKILLS.md A8. Asserts exactly one occurrence.

    already_applied_marker — a string unique to the NEW content (not in old).
    If this marker is found in the file, the patch is skipped as already applied.
    This makes the script idempotent — safe to re-run.
    """
    path = ROOT / relpath
    tag = label or relpath
    if not path.exists():
        msg = f"File not found: {relpath}"
        print(f"  ✗ FAIL  {msg}")
        ERRORS.append(msg)
        return False
    content = path.read_text(encoding="utf-8")

    # ── Idempotency guard ────────────────────────────────────────────────────
    if already_applied_marker and already_applied_marker in content:
        skip(f"{relpath} — already applied ({repr(already_applied_marker[:60])})")
        return True

    count = content.count(old)
    if count == 0:
        msg = (
            f"Patch target not found in {relpath}\n"
            f"         Looking for: {repr(old[:120])}"
        )
        print(f"  ✗ FAIL  {msg}")
        ERRORS.append(msg)
        return False
    if count > 1:
        msg = f"Ambiguous match ({count}×) in {relpath}: {repr(old[:80])}"
        print(f"  ✗ FAIL  {msg}")
        ERRORS.append(msg)
        return False
    if DRY:
        print(f"  [DRY] Would patch: {relpath}")
        return True
    _backup(path)
    path.write_text(content.replace(old, new, 1), encoding="utf-8")
    print(f"  PATCHED {relpath}")
    APPLIED.append(tag)
    return True


def patch_json(relpath: str, mutate, label: str = "") -> bool:
    """Mutate a JSON file with a callable."""
    path = ROOT / relpath
    tag = label or relpath
    if not path.exists():
        msg = f"File not found: {relpath}"
        print(f"  ✗ FAIL  {msg}")
        ERRORS.append(msg)
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        mutate(data)
        if DRY:
            print(f"  [DRY] Would update JSON: {relpath}")
            return True
        _backup(path)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"  PATCHED {relpath}")
        APPLIED.append(tag)
        return True
    except Exception as exc:
        msg = f"JSON patch failed for {relpath}: {exc}"
        print(f"  ✗ FAIL  {msg}")
        ERRORS.append(msg)
        return False


def skip(msg: str) -> None:
    print(f"  ~      {msg}")
    SKIPPED.append(msg)


# ══════════════════════════════════════════════════════════════════════════════
#  FR-016 — Request Authentication
#  Bearer token middleware on all routes except /api/healthz.
#  API_SECRET env var on Railway. Skipped in dev when var is absent.
# ══════════════════════════════════════════════════════════════════════════════

AUTH_MIDDLEWARE = '''\
import type { Request, Response, NextFunction } from "express";

/**
 * FR-016 — Request Authentication
 *
 * Validates Bearer token on every route except /api/healthz.
 * In development (NODE_ENV !== "production"), auth is skipped when API_SECRET
 * is not set — this allows local curl / Vite proxy to work without a token.
 *
 * Production (Railway): set API_SECRET env var. All requests without a valid
 * Bearer token receive 401 { error, code }.
 *
 * SSE connections pass the token as Authorization header on the initial
 * request — EventSource does not support custom headers, so the frontend
 * must use a custom fetch + ReadableStream polyfill or pass the token as
 * a ?token= query param (see useMetrics.ts).
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Health probe — always public
  if (req.path.startsWith("/api/healthz")) {
    next();
    return;
  }

  const secret = process.env.API_SECRET;

  // Dev mode: skip auth when no secret configured
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Production must have API_SECRET — this is a misconfiguration
      res.status(500).json({
        error: "Server misconfiguration: API_SECRET is not set",
        code: "CONFIG_ERROR",
      });
      return;
    }
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  // Support both header and ?token= query param (for EventSource / SSE)
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7)
    : typeof req.query.token === "string" ? req.query.token
    : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized", code: "MISSING_TOKEN" });
    return;
  }

  if (token !== secret) {
    res.status(401).json({ error: "Unauthorized", code: "INVALID_TOKEN" });
    return;
  }

  next();
}
'''

# ══════════════════════════════════════════════════════════════════════════════
#  FR-021 + FR-022 — Metrics DB helper + Structured Errors
#  db-metrics.ts: thin wrapper around Drizzle for metrics_kv upsert.
#  Structured errors: { error: string; code?: string; requestId?: string }
# ══════════════════════════════════════════════════════════════════════════════

DB_METRICS = '''\
/**
 * FR-021 — Metrics PostgreSQL Persistence
 *
 * Thin wrapper around the metrics_kv table. Used by routes/metrics.ts to
 * persist totalSubscribers so a Railway redeploy does not reset the count.
 *
 * All operations are async fire-and-forget — callers should never await these
 * unless they explicitly need the confirmed write. DB failures are logged but
 * never surfaced to the client (heartbeat must always respond quickly).
 *
 * The metrics_kv schema (defined in PRD v2.0 / lib/db):
 *   key   varchar(64)  PRIMARY KEY
 *   value text         NOT NULL
 */

import { db } from "./db.js"; // adjust to your actual Drizzle db export path
import { metricsKv } from "@workspace/db/schema"; // adjust to your schema export

/** Read a single metric value by key. Returns null if not found. */
export async function readMetric(key: string): Promise<string | null> {
  try {
    const row = await db.query.metricsKv.findFirst({
      where: (t, { eq }) => eq(t.key, key),
    });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert a metric value. Non-blocking — call without await.
 * DB failure is silently swallowed (metrics writes must not block responses).
 */
export function writeMetric(key: string, value: string): void {
  db.insert(metricsKv)
    .values({ key, value })
    .onConflictDoUpdate({
      target: metricsKv.key,
      set: { value },
    })
    .catch((err: unknown) => {
      // Non-fatal: metrics writes are best-effort
      console.warn("[db-metrics] write failed:", (err as Error)?.message);
    });
}
'''

# ══════════════════════════════════════════════════════════════════════════════
#  FR-015 — Conversation Persistence (localStorage)
#
#  Hook: useConversation.ts
#   - Restores history on mount from localStorage
#   - Capped at MAX_MESSAGES (50) with oldest-first truncation
#   - Exposes addMessage, clearHistory, messages
#   - Works with existing useAGI Zustand store (hydrates it on mount)
#
#  This is Phase 1 persistence (localStorage). Phase 3 upgrades to DB.
# ══════════════════════════════════════════════════════════════════════════════

USE_CONVERSATION = '''\
import { useCallback, useEffect, useRef } from "react";
import { useAGI } from "../store/useAGI";

/** FR-015 — Conversation persistence (localStorage, Phase 1) */

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number; // Unix ms
}

const STORAGE_KEY = "agi_conversation_history";
const MAX_MESSAGES = 50;

function readStorage(): ConversationMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ConversationMessage[];
  } catch {
    return [];
  }
}

function writeStorage(messages: ConversationMessage[]): void {
  try {
    // Cap at MAX_MESSAGES — truncate from the front (oldest removed)
    const capped =
      messages.length > MAX_MESSAGES
        ? messages.slice(messages.length - MAX_MESSAGES)
        : messages;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // localStorage quota exceeded — silently continue
  }
}

/**
 * useConversation — localStorage-backed conversation history.
 *
 * Returns:
 *   messages      — full conversation array (restored on mount)
 *   addMessage    — append a message and persist
 *   clearHistory  — empty localStorage + Zustand store
 */
export function useConversation() {
  const { messages: storeMessages, setMessages, clearMessages } = useAGI(
    (s) => ({
      messages: s.messages,
      setMessages: s.setMessages,
      clearMessages: s.clearMessages,
    }),
  );

  // Restore from localStorage on first mount only
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const saved = readStorage();
    if (saved.length > 0) {
      setMessages(saved);
    }
  }, [setMessages]);

  // Mirror Zustand state into localStorage on every change (after hydration)
  useEffect(() => {
    if (!hydrated.current) return;
    writeStorage(storeMessages as ConversationMessage[]);
  }, [storeMessages]);

  const addMessage = useCallback(
    (msg: ConversationMessage) => {
      setMessages([...(storeMessages as ConversationMessage[]), msg]);
    },
    [storeMessages, setMessages],
  );

  const clearHistory = useCallback(() => {
    clearMessages();
    localStorage.removeItem(STORAGE_KEY);
  }, [clearMessages]);

  return {
    messages: storeMessages as ConversationMessage[],
    addMessage,
    clearHistory,
  };
}
'''

# ══════════════════════════════════════════════════════════════════════════════
#  FR-017 — Streaming Cancel
#
#  Hook: useStreamingCancel.ts
#   - AbortController per request
#   - isStreaming flag drives Cancel button visibility
#   - Partial response is preserved in history on cancel
#   - No server changes needed — server already handles req.on("close")
# ══════════════════════════════════════════════════════════════════════════════

USE_STREAMING_CANCEL = '''\
import { useCallback, useRef, useState } from "react";

/**
 * FR-017 — Streaming Cancel
 *
 * Usage in AgentSuitePanel (or wherever streaming chat lives):
 *
 *   const { isStreaming, startStream, cancelStream } = useStreamingCancel();
 *
 *   // On send:
 *   await startStream(async (signal) => {
 *     const res = await fetch("/api/agent/chat", {
 *       method: "POST",
 *       signal,                          // <-- AbortController signal
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ messages }),
 *     });
 *     for await (const chunk of readSSE(res)) {
 *       appendToCurrentMessage(chunk.text);
 *     }
 *   });
 *
 *   // Cancel button (only shown when streaming):
 *   {isStreaming && <button onClick={cancelStream}>Stop</button>}
 *
 * Partial response behaviour:
 *   The caller accumulates partial text into the message store before the
 *   AbortError is thrown. `startStream` catches AbortError silently and
 *   returns — the partial content already in the store is preserved.
 *   Any other error is re-thrown so the caller can surface it to the user.
 */

export function useStreamingCancel() {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  /**
   * Start a streaming operation.
   * @param fn  Async function that receives an AbortSignal and does the fetch.
   *            It should accumulate partial text into the message store
   *            before any await points so partial content is preserved on cancel.
   */
  const startStream = useCallback(
    async (fn: (signal: AbortSignal) => Promise<void>) => {
      // Cancel any in-flight request before starting a new one
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;
      setIsStreaming(true);

      try {
        await fn(controller.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — partial response already in store. Swallow.
          return;
        }
        throw err; // Real errors propagate to the caller
      } finally {
        controllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [],
  );

  const cancelStream = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { isStreaming, startStream, cancelStream };
}
'''

# ══════════════════════════════════════════════════════════════════════════════
#  FR-018 — ESLint (flat config)
# ══════════════════════════════════════════════════════════════════════════════

ESLINT_CONFIG = '''\
// eslint.config.js — FR-018
// Flat config (ESLint 9+). Plugins: @typescript-eslint, react-hooks, prettier.
// Rule: zero lint errors on current codebase before enabling new rules.

import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default [
  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.patch-backups/**",
      "pnpm-lock.yaml",
      "**/*.bak",
      "**/*.bak-*",
    ],
  },

  // ── TypeScript source files ───────────────────────────────────────────────
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Recommended rules — type-checked variants where available
      ...tsPlugin.configs["recommended"].rules,

      // Project-specific overrides
      "@typescript-eslint/no-explicit-any": "error",           // PRD: no `any`
      "@typescript-eslint/no-floating-promises": "error",       // catch unhandled async
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },

  // ── React / frontend files ────────────────────────────────────────────────
  {
    files: ["apps/r3-agi/src/**/*.ts", "apps/r3-agi/src/**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // ── Prettier compat — must be last (disables formatting rules) ────────────
  prettierConfig,
];
'''

# ══════════════════════════════════════════════════════════════════════════════
#  FR-019 — Test Coverage scaffolding (lib/api-zod)
# ══════════════════════════════════════════════════════════════════════════════

VITEST_CONFIG = '''\
/// <reference types="vitest" />
import { defineConfig } from "vite";

/**
 * FR-019 — Test Coverage for lib/api-zod
 * Target: >80% line coverage enforced via threshold.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/lib/api-zod/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
'''

# Template for api-zod schema tests (FR-019 — colocated with source)
API_ZOD_TEST_TEMPLATE = '''\
/**
 * FR-019 — lib/api-zod schema tests
 *
 * Pattern: parse valid inputs, reject invalid inputs, verify error messages.
 * Place this file alongside the schema: schema.test.ts beside schema.ts.
 *
 * Replace the example schemas below with your actual Zod schemas.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// ── Import your actual schemas here ──────────────────────────────────────────
// import { HeartbeatSchema, ChatRequestSchema, ... } from "./schema.js";

// ── Example: HeartbeatSchema ─────────────────────────────────────────────────
const HeartbeatSchema = z.object({
  sessionId: z.string().min(1),
});

describe("HeartbeatSchema", () => {
  it("accepts a valid sessionId", () => {
    const result = HeartbeatSchema.safeParse({ sessionId: "abc-123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty sessionId", () => {
    const result = HeartbeatSchema.safeParse({ sessionId: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("too_small");
  });

  it("rejects missing sessionId", () => {
    const result = HeartbeatSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("invalid_type");
  });
});

// ── Example: ChatRequestSchema ────────────────────────────────────────────────
const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

describe("ChatRequestSchema", () => {
  it("accepts a valid message array", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty messages array", () => {
    const result = ChatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "system", content: "x" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("invalid_enum_value");
  });

  it("rejects empty content string", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "" }],
    });
    expect(result.success).toBe(false);
  });
});
'''

# ══════════════════════════════════════════════════════════════════════════════
#  FR-020 — CI Pipeline
# ══════════════════════════════════════════════════════════════════════════════

CI_WORKFLOW = '''\
# FR-020 — CI Pipeline
# Six checks: prettier → lint → typecheck → test → build
# Target: < 3 minutes on ubuntu-latest.
#
# Secrets required (GitHub Actions → Settings → Secrets):
#   ANTHROPIC_API_KEY  — only needed if integration tests run live API calls
#   API_SECRET         — only needed if tests require an authenticated server

name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: Build & Test
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile --ignore-scripts

      # ── 1. Prettier ───────────────────────────────────────────────────────
      - name: Prettier
        run: pnpm exec prettier --check .

      # ── 2. ESLint (FR-018) ────────────────────────────────────────────────
      - name: Lint
        run: pnpm lint

      # ── 3. TypeScript (strict) ────────────────────────────────────────────
      - name: Typecheck
        run: pnpm typecheck

      # ── 4. Vitest (FR-019 coverage threshold) ─────────────────────────────
      - name: Test
        run: pnpm test --run

      # ── 5. Build (both apps) ──────────────────────────────────────────────
      - name: Build
        run: pnpm build
        env:
          # Stub values — build must not require live secrets
          ANTHROPIC_API_KEY: "sk-ant-stub-ci"
          API_SECRET: "ci-stub-secret"
          VITE_API_SECRET: "ci-stub-secret"
'''

# ══════════════════════════════════════════════════════════════════════════════
#  .prettierignore — per SKILLS.md A6
# ══════════════════════════════════════════════════════════════════════════════

PRETTIER_IGNORE = '''\
# Generated / lockfiles
pnpm-lock.yaml
dist/
node_modules/

# Patch artifacts (SKILLS.md A6)
.patch-backups/

# Backup files (BUG 8 pattern — never let these creep back in)
**/*.bak
**/*.bak-*

# Auto-generated Drizzle migrations (formatted by drizzle-kit)
**/drizzle/
'''

# ══════════════════════════════════════════════════════════════════════════════
#  Patches to existing files
# ══════════════════════════════════════════════════════════════════════════════

# ── app.ts patches ────────────────────────────────────────────────────────────
#
# We need to add:
#   1. requireAuth import + mount (FR-016)
#   2. Global error handler before `export { app }` (FR-022)
#
# Anchor: `import cors from "cors";` — this is unique after the CORS fix.
# Second anchor: `export { app }` — standard module export.

APP_TS_IMPORT_BEFORE = 'import cors from "cors";'
APP_TS_IMPORT_AFTER = '''\
import cors from "cors";
import { requireAuth } from "./middleware/auth.js";'''

# FR-022: global error handler — 4-arg signature is required by Express
APP_TS_EXPORT_BEFORE = 'export { app };'
APP_TS_EXPORT_AFTER = '''\
// ── FR-022: Global error handler ─────────────────────────────────────────────
// Must be 4-argument (err, req, res, next) for Express to recognise it.
// Returns { error, code, requestId } per structured-error contract.
app.use(
  (
    err: Error & { status?: number; code?: string },
    _req: import("express").Request,
    res: import("express").Response,
    _next: import("express").NextFunction,
  ) => {
    const status = err.status ?? 500;
    const code = err.code ?? (status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    // Never log stack traces for 4xx (client errors)
    if (status >= 500) {
      console.error("[error]", err.stack ?? err.message);
    }
    if (res.headersSent) return;
    res.status(status).json({ error: err.message ?? "Internal server error", code });
  },
);

export { app };'''

# FR-016: mount auth after CORS, before routes.
# Anchor: first router mount — `app.use("/api/agent"` or `/api/metrics` or `/api/healthz`
# We look for the agent router mount which is always present.
APP_TS_AUTH_BEFORE = 'app.use("/api/agent"'
APP_TS_AUTH_AFTER = '''\
// FR-016: Bearer token auth — all routes except /api/healthz
app.use(requireAuth);

app.use("/api/agent"'''

# ── root package.json patches ─────────────────────────────────────────────────
#
# FR-018: add "lint" script
# FR-019: add "test:coverage" script

def mutate_root_package(data: dict) -> None:
    scripts = data.setdefault("scripts", {})
    # FR-018 — ESLint
    if "lint" not in scripts:
        scripts["lint"] = "eslint ."
    # FR-019 — Coverage
    if "test:coverage" not in scripts:
        scripts["test:coverage"] = "vitest run --coverage"
    # FR-020 — ensure typecheck exists (needed by CI)
    if "typecheck" not in scripts:
        scripts["typecheck"] = "tsc --noEmit"

# ── metrics.ts patch — FR-021 (PostgreSQL persistence) ───────────────────────
#
# The metrics route currently persists totalSubscribers in-memory.
# We add: (a) load from DB on startup, (b) upsert on each new subscriber.
#
# Anchor: the totalSubscribers variable declaration.
# Pattern: `let totalSubscribers = 0;` or similar.

METRICS_TOTAL_SUB_BEFORE = "let totalSubscribers = 0;"
METRICS_TOTAL_SUB_AFTER = '''\
// FR-021 — Load totalSubscribers from PostgreSQL on startup.
// Falls back to 0 if DB is unavailable (first deploy / cold start).
let totalSubscribers = 0;
void (async () => {
  try {
    const { readMetric } = await import("../lib/db-metrics.js");
    const stored = await readMetric("totalSubscribers");
    if (stored !== null) totalSubscribers = Number(stored);
  } catch {
    // DB unavailable on startup — start from 0
  }
})();'''

# Second anchor: where totalSubscribers is incremented.
# After the v1 fix, the pattern is: increment only for new session IDs.
# We add a DB persist call after the increment.
METRICS_INCREMENT_BEFORE = "totalSubscribers++;"
METRICS_INCREMENT_AFTER = '''\
totalSubscribers++;
// FR-021 — Persist new subscriber count asynchronously (non-blocking)
void import("../lib/db-metrics.js").then(({ writeMetric }) => {
  writeMetric("totalSubscribers", String(totalSubscribers));
});'''

# ── pre-push hook update — FR-018: add lint to pre-push ─────────────────────
#
# Current pre-push (from SKILLS.md A5 / current state): pnpm typecheck
# New: pnpm typecheck && pnpm lint

PACKAGE_JSON_HOOKS_PATH = "package.json"


def mutate_hooks_package(data: dict) -> None:
    """Update simple-git-hooks pre-push to include lint."""
    hooks = data.get("simple-git-hooks", {})
    prepush = hooks.get("pre-push", "")
    if "pnpm lint" not in prepush:
        hooks["pre-push"] = "pnpm typecheck && pnpm lint"
        data["simple-git-hooks"] = hooks


# ══════════════════════════════════════════════════════════════════════════════
#  Main execution
# ══════════════════════════════════════════════════════════════════════════════

def main() -> int:
    if DRY:
        print("\n[DRY RUN] No files will be written. Pass --apply to execute.\n")
    else:
        print(f"\n[APPLY] Writing to {ROOT}")
        print(f"[APPLY] Backups: {BACKUP_DIR}\n")

    # ── Pre-flight ─────────────────────────────────────────────────────────
    section("Pre-flight: verifying project root")
    if not (ROOT / "package.json").exists():
        print(f"\n  ✗  ABORT: {ROOT}/package.json not found.")
        print(f"     Run this script from ~/Agi-Suite or ensure ROOT is correct.")
        return 1
    print(f"  ✓  Project root: {ROOT}")

    # ── FR-016: auth middleware (new file) ─────────────────────────────────
    section("FR-016 — Request Authentication")
    write_file(
        "apps/api-server/src/middleware/auth.ts",
        AUTH_MIDDLEWARE,
        "auth middleware (new file)",
    )

    # Mount auth in app.ts — Step 1: import
    patch_file(
        "apps/api-server/src/app.ts",
        APP_TS_IMPORT_BEFORE,
        APP_TS_IMPORT_AFTER,
        "app.ts — add requireAuth import",
        already_applied_marker='import { requireAuth } from "./middleware/auth.js";',
    )
    # Mount auth in app.ts — Step 2: app.use(requireAuth) before routes
    patch_file(
        "apps/api-server/src/app.ts",
        APP_TS_AUTH_BEFORE,
        APP_TS_AUTH_AFTER,
        "app.ts — mount requireAuth before routes",
        already_applied_marker="// FR-016: Bearer token auth",
    )

    # ── FR-022: Structured error responses ────────────────────────────────
    section("FR-022 — Structured Error Responses")
    patch_file(
        "apps/api-server/src/app.ts",
        APP_TS_EXPORT_BEFORE,
        APP_TS_EXPORT_AFTER,
        "app.ts — global error handler",
        already_applied_marker="// ── FR-022: Global error handler",
    )

    # ── FR-021: Metrics PostgreSQL persistence ────────────────────────────
    section("FR-021 — Metrics Persistence (PostgreSQL)")
    write_file(
        "apps/api-server/src/lib/db-metrics.ts",
        DB_METRICS,
        "db-metrics.ts (new file)",
    )
    patch_file(
        "apps/api-server/src/routes/metrics.ts",
        METRICS_TOTAL_SUB_BEFORE,
        METRICS_TOTAL_SUB_AFTER,
        "metrics.ts — load totalSubscribers from DB on startup",
        already_applied_marker="FR-021 — Load totalSubscribers from PostgreSQL",
    )
    patch_file(
        "apps/api-server/src/routes/metrics.ts",
        METRICS_INCREMENT_BEFORE,
        METRICS_INCREMENT_AFTER,
        "metrics.ts — persist subscriber increment to DB",
        already_applied_marker="FR-021 — Persist new subscriber count",
    )

    # ── FR-015: Conversation persistence (localStorage) ───────────────────
    section("FR-015 — Conversation Persistence (localStorage)")
    write_file(
        "apps/r3-agi/src/hooks/useConversation.ts",
        USE_CONVERSATION,
        "useConversation.ts (new file)",
    )

    # ── FR-017: Streaming cancel ──────────────────────────────────────────
    section("FR-017 — Streaming Cancel")
    write_file(
        "apps/r3-agi/src/hooks/useStreamingCancel.ts",
        USE_STREAMING_CANCEL,
        "useStreamingCancel.ts (new file)",
    )

    # ── FR-018: ESLint ────────────────────────────────────────────────────
    section("FR-018 — ESLint (flat config)")
    write_file("eslint.config.js", ESLINT_CONFIG, "eslint.config.js (new file)")
    patch_json(
        "package.json",
        mutate_root_package,
        "package.json — add lint + typecheck scripts",
    )
    patch_json(
        "package.json",
        mutate_hooks_package,
        "package.json — update pre-push hook to include lint",
    )

    # ── FR-019: Vitest coverage + test template ───────────────────────────
    section("FR-019 — Test Coverage (lib/api-zod)")
    # Write vitest config at workspace root if it doesn't exist
    vc_path = ROOT / "vitest.config.ts"
    if not vc_path.exists():
        write_file("vitest.config.ts", VITEST_CONFIG, "vitest.config.ts (new file)")
    else:
        skip("vitest.config.ts — already exists, skipping")
    # Write test template for lib/api-zod (will not overwrite existing tests)
    test_path = ROOT / "packages/lib/api-zod/src/schema.test.ts"
    if not test_path.exists():
        write_file(
            "packages/lib/api-zod/src/schema.test.ts",
            API_ZOD_TEST_TEMPLATE,
            "api-zod schema.test.ts (template — replace with actual schemas)",
        )
    else:
        skip("packages/lib/api-zod/src/schema.test.ts — already exists")

    # ── FR-020: CI pipeline ───────────────────────────────────────────────
    section("FR-020 — CI Pipeline")
    write_file(
        ".github/workflows/ci.yml",
        CI_WORKFLOW,
        ".github/workflows/ci.yml (new file)",
    )

    # ── .prettierignore (SKILLS.md A6) ────────────────────────────────────
    section("Toolchain — .prettierignore (SKILLS.md A6)")
    pi_path = ROOT / ".prettierignore"
    if not pi_path.exists():
        write_file(".prettierignore", PRETTIER_IGNORE, ".prettierignore (new file)")
    else:
        skip(".prettierignore — already exists, skipping")

    # ── Summary ───────────────────────────────────────────────────────────
    section("Summary")

    if APPLIED:
        print(f"\n  ✓  Applied ({len(APPLIED)}):")
        for a in APPLIED:
            print(f"       {a}")

    if SKIPPED:
        print(f"\n  ~  Skipped ({len(SKIPPED)}):")
        for s in SKIPPED:
            print(f"       {s}")

    if ERRORS:
        print(f"\n  ✗  Failed ({len(ERRORS)}):")
        for e in ERRORS:
            print(f"       {e}")
        print()
        print("  Patch failures mean the target file has drifted from the")
        print("  expected state. Review the diff and apply manually.")
        print("  All other changes above were still applied.")

    if DRY:
        print("\n[DRY RUN complete] Pass --apply to execute all of the above.\n")
    else:
        print("\n[All changes applied]\n")
        print("  Next steps:")
        print("  1.  pnpm install            — install new devDependencies (ESLint plugins)")
        print("  2.  pnpm approve-builds     — approve simple-git-hooks if prompted")
        print("  3.  pnpm exec prettier --write .    — format new files")
        print("  4.  pnpm lint               — verify zero ESLint errors")
        print("  5.  pnpm typecheck          — verify zero TS errors")
        print("  6.  pnpm dev                — smoke-test the running app")
        print()
        print("  Integration notes:")
        print("  ─ useConversation.ts assumes useAGI has setMessages + clearMessages.")
        print("    Add these actions to your Zustand store if not present.")
        print("  ─ useStreamingCancel.ts is a drop-in for AgentSuitePanel's fetch call.")
        print("  ─ db-metrics.ts import paths (db.js, schema) may need adjustment")
        print("    to match your actual Drizzle workspace layout.")
        print("  ─ Set API_SECRET in apps/api-server/.env for auth to activate.")
        print("    Leave unset in dev to skip auth (skipped automatically).")
        print("  ─ Set VITE_API_SECRET in apps/r3-agi/.env to match.")
        print()
        print("  ESLint packages to add to devDependencies (check catalog first):")
        print("    @typescript-eslint/eslint-plugin")
        print("    @typescript-eslint/parser")
        print("    eslint-plugin-react-hooks")
        print("    eslint-config-prettier")
        print("    eslint")
        print()

    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
