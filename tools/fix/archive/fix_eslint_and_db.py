#!/usr/bin/env python3
"""
Agi-Suite Phase 2 — ESLint + db-metrics fix
============================================
Fixes two issues from pnpm lint / pnpm typecheck output:

ISSUE 1 — ESLint: 111 errors (parserOptions.project in monorepo)
  Root cause: eslint.config.js used `project: "./tsconfig.json"` which only
  covers files included in the ROOT tsconfig. All workspace package files
  (apps/api-server/**, apps/r3-agi/**, lib/**) are excluded from the root
  tsconfig and fail with "file was not found in any of the provided project(s)".

  Fix A: Replace `project: "./tsconfig.json"` with `projectService: true`
         (@typescript-eslint v8 API — auto-discovers the nearest tsconfig.json
         for each file being linted. Correct for monorepos with multiple tsconfigs.)

  Fix B: Rename eslint.config.js → eslint.config.mjs (explicit ESM extension)
         This eliminates the MODULE_TYPELESS_PACKAGE_JSON Node warning without
         requiring "type": "module" in root package.json (which would break
         the .js tool files in tools/**).

ISSUE 2 — TypeScript: 3 errors in db-metrics.ts
  Root cause: guessed import paths that don't match the actual workspace layout.
    Wrong: import { db } from "./db.js"            → api-server has no local db.ts
    Wrong: import { metricsKv } from "@workspace/db/schema"  → /schema not exported
    Wrong: db.query.metricsKv.findFirst({ where: (t, { eq }) => ... })
           → relational API requires schema passed to drizzle(); implicit any on (t, eq)

  Fix: correct imports + standard query builder (no relational API).
    Right: import { db, metricsKv } from "@workspace/db"  (package root exports both)
    Right: db.select().from(metricsKv).where(eq(metricsKv.key, key)).limit(1)

  NOTE: If metricsKv is not yet in @workspace/db's schema (it's a Phase 2 addition),
  you must also add it to lib/db/src/schema/index.ts and run drizzle-kit generate
  + migrate before db-metrics.ts will fully typecheck. See instructions at the end.

Usage:
  python3 fix_eslint_and_db.py           # dry run
  python3 fix_eslint_and_db.py --apply   # apply
"""

import sys
import os
import shutil
import json
import argparse
from pathlib import Path
from datetime import datetime

parser = argparse.ArgumentParser()
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()
DRY = not args.apply

ROOT = Path.home() / "Agi-Suite"
BACKUP_DIR = ROOT / ".patch-backups" / datetime.now().strftime("%Y%m%dT%H%M%S")
APPLIED: list[str] = []
ERRORS: list[str] = []


def ok(msg: str) -> None:
    APPLIED.append(msg)
    print(f"  ✓  {msg}")


def err(msg: str) -> None:
    ERRORS.append(msg)
    print(f"  ✗  {msg}")


def _backup(path: Path) -> None:
    if DRY or not path.exists():
        return
    rel = path.relative_to(ROOT)
    dest = BACKUP_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def write(relpath: str, content: str, label: str = "") -> None:
    path = ROOT / relpath
    tag = label or relpath
    if DRY:
        print(f"  [DRY] Would write: {relpath}")
        return
    _backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    ok(tag)


def delete(relpath: str, label: str = "") -> None:
    path = ROOT / relpath
    tag = label or relpath
    if not path.exists():
        print(f"  ~    Already gone: {relpath}")
        return
    if DRY:
        print(f"  [DRY] Would delete: {relpath}")
        return
    _backup(path)
    path.unlink()
    ok(tag)


def patch_json(relpath: str, mutate, label: str = "") -> None:
    path = ROOT / relpath
    tag = label or relpath
    if not path.exists():
        err(f"File not found: {relpath}")
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        mutate(data)
        if DRY:
            print(f"  [DRY] Would update JSON: {relpath}")
            return
        _backup(path)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        ok(tag)
    except Exception as exc:
        err(f"JSON patch failed for {relpath}: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
#  FIX 1 — eslint.config.mjs (replaces eslint.config.js)
# ══════════════════════════════════════════════════════════════════════════════

ESLINT_CONFIG_MJS = '''\
// eslint.config.mjs — FR-018
// .mjs extension = always ESM, no "type":"module" needed in package.json.
//
// Key change from original: parserOptions.project → parserOptions.projectService
// projectService (v8 API) auto-discovers the nearest tsconfig.json for each file.
// This is correct for monorepos where each workspace package has its own tsconfig.
// The old `project: "./tsconfig.json"` only covered files in the root tsconfig —
// every file in apps/** and lib/** failed with "file not found in project".

import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ESM equivalent of __dirname (import.meta.dirname is Node 21.2+ only)
const __dirname = dirname(fileURLToPath(import.meta.url));

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
      // Auto-generated by orval — do not lint
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
      // Plain JS tools — not TypeScript, skip type-aware linting
      "tools/**/*.js",
      "ecosystem.config.cjs",
    ],
  },

  // ── TypeScript source files (all workspace packages) ─────────────────────
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // projectService: true — monorepo-safe.
        // For each file being linted, ESLint resolves the nearest tsconfig.json
        // in the file's ancestor directories. Each workspace package's own
        // tsconfig is used for type-aware rules on files within that package.
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Recommended rules (not type-checked — applied to all TS files safely)
      ...tsPlugin.configs["recommended"].rules,

      // Type-aware rules (require projectService — safe in monorepo with v8)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },

  // ── React / frontend (react-hooks plugin) ────────────────────────────────
  {
    files: ["apps/r3-agi/src/**/*.ts", "apps/r3-agi/src/**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // ── Prettier compat — must be last ───────────────────────────────────────
  prettierConfig,
];
'''

# ══════════════════════════════════════════════════════════════════════════════
#  FIX 2 — db-metrics.ts (corrected imports + query builder)
# ══════════════════════════════════════════════════════════════════════════════

DB_METRICS_FIXED = '''\
/**
 * FR-021 — Metrics PostgreSQL Persistence
 *
 * Thin Drizzle wrapper for the metrics_kv table. Used by routes/metrics.ts to
 * persist totalSubscribers across Railway deploys (eliminates /tmp reset).
 *
 * Import path fix (v1 had wrong paths):
 *   Wrong: import { db } from "./db.js"              → no local db.ts in api-server
 *   Wrong: import { metricsKv } from "@workspace/db/schema"  → /schema not exported
 *   Right: import { db, metricsKv } from "@workspace/db"     → package root exports both
 *
 * Query builder fix:
 *   Wrong: db.query.metricsKv.findFirst({ where: (t, { eq }) => ... })
 *          → relational API; requires schema passed to drizzle(); implicit any
 *   Right: db.select().from(metricsKv).where(eq(metricsKv.key, key)).limit(1)
 *
 * PREREQUISITE — If metrics_kv is not yet in your schema, add it first:
 *
 *   // lib/db/src/schema/index.ts — add this table:
 *   export const metricsKv = pgTable("metrics_kv", {
 *     key:       varchar("key", { length: 64 }).primaryKey(),
 *     value:     text("value").notNull(),
 *     updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
 *   });
 *
 *   Then: pnpm --filter @workspace/db drizzle-kit generate
 *         pnpm --filter @workspace/db drizzle-kit migrate  (or push for local dev)
 *
 * All write operations are fire-and-forget — callers never await these.
 * DB failures are warned but never surfaced to the heartbeat client.
 */

import { db, metricsKv } from "@workspace/db";
import { eq } from "drizzle-orm";

/** Read a metric value by key. Returns null if not found or DB unavailable. */
export async function readMetric(key: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ value: metricsKv.value })
      .from(metricsKv)
      .where(eq(metricsKv.key, key))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert a metric. Non-blocking — call without await.
 * DB failure is swallowed (metrics writes must not block responses per FR-021).
 */
export function writeMetric(key: string, value: string): void {
  db.insert(metricsKv)
    .values({ key, value })
    .onConflictDoUpdate({
      target: metricsKv.key,
      set: { value },
    })
    .catch((err: unknown) => {
      console.warn("[db-metrics] write failed:", (err as Error)?.message);
    });
}
'''

# ══════════════════════════════════════════════════════════════════════════════
#  Root package.json — update lint script to use .mjs if needed
# ══════════════════════════════════════════════════════════════════════════════

def mutate_package_json(data: dict) -> None:
    """
    ESLint auto-discovers eslint.config.mjs — no script change needed.
    But update the pre-push hook if it was set to just pnpm typecheck
    (it should be pnpm typecheck && pnpm lint per FR-018).
    """
    hooks = data.get("simple-git-hooks", {})
    prepush = hooks.get("pre-push", "")
    if "pnpm lint" not in prepush:
        hooks["pre-push"] = "pnpm typecheck && pnpm lint"
        data["simple-git-hooks"] = hooks
        print("    Updated pre-push hook to include lint")


# ══════════════════════════════════════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════════════════════════════════════

def main() -> int:
    if DRY:
        print("\n[DRY RUN] No files written. Pass --apply to execute.\n")
    else:
        print(f"\n[APPLY] Writing to {ROOT}")
        print(f"[APPLY] Backups: {BACKUP_DIR}\n")

    if not (ROOT / "package.json").exists():
        print(f"\n✗  ABORT: {ROOT}/package.json not found. Run from ~/Agi-Suite.\n")
        return 1

    # ── Fix 1: ESLint config ─────────────────────────────────────────────────
    print("\n── Fix 1: ESLint config (parserOptions.project → projectService) ──────")
    write("eslint.config.mjs", ESLINT_CONFIG_MJS, "eslint.config.mjs (monorepo-safe)")
    delete("eslint.config.js", "eslint.config.js (removed — replaced by .mjs)")

    # ── Fix 2: db-metrics.ts ─────────────────────────────────────────────────
    print("\n── Fix 2: db-metrics.ts (correct imports + query builder) ──────────────")
    write(
        "apps/api-server/src/lib/db-metrics.ts",
        DB_METRICS_FIXED,
        "db-metrics.ts — corrected imports",
    )

    # ── Fix 3: package.json pre-push hook ────────────────────────────────────
    print("\n── Fix 3: package.json pre-push hook ────────────────────────────────────")
    patch_json("package.json", mutate_package_json, "package.json — pre-push hook")

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n" + "═" * 64)
    if APPLIED:
        print(f"  ✓  Applied ({len(APPLIED)}): {', '.join(APPLIED)}")
    if ERRORS:
        print(f"  ✗  Errors ({len(ERRORS)}): {', '.join(ERRORS)}")
    if DRY:
        print("\n[DRY RUN] Pass --apply to execute.\n")
    else:
        print("""
[Done]

Next steps:

  1. Re-run lint:
       pnpm lint

     Expected result: 0 errors. If you see @typescript-eslint errors about
     specific code issues (not "file not found in project"), those are real
     TypeScript problems to fix.

  2. Re-run typecheck:
       pnpm typecheck

     If db-metrics.ts still errors on "Cannot find module '@workspace/db'",
     the db package does not export `db` or `metricsKv` from its index.
     Check: cat lib/db/src/index.ts

     If metricsKv is not in the schema yet, add it (see comment in db-metrics.ts)
     and run drizzle-kit generate + migrate.

  3. Schema prerequisite — add metrics_kv to lib/db/src/schema/index.ts:

       export const metricsKv = pgTable("metrics_kv", {
         key:       varchar("key", { length: 64 }).primaryKey(),
         value:     text("value").notNull(),
         updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
       });

     Then:
       pnpm --filter @workspace/db drizzle-kit generate
       # For local dev (no migration file):
       pnpm --filter @workspace/db drizzle-kit push
""")
    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
