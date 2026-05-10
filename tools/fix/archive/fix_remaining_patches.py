#!/usr/bin/env python3
"""
Agi-Suite Phase 2 — Remaining patch fixes
==========================================
Applies the 4 patches that failed in agi_suite_phase2.py --apply, now that
the actual file contents are known. Also adds the metrics_kv schema table
required by db-metrics.ts (lib/db/src/schema/index.ts was empty).

Changes:
  1. lib/db/src/schema/index.ts       — add metricsKv table (FR-021)
  2. apps/api-server/package.json      — ensure @workspace/db in deps
  3. apps/api-server/src/app.ts        — mount requireAuth (was imported, never used)
  4. apps/api-server/src/app.ts        — global error handler (FR-022)
  5. apps/api-server/src/routes/metrics.ts — load totalSubscribers from DB on startup
  6. apps/api-server/src/routes/metrics.ts — write to DB on each new subscriber

Usage:
  python3 fix_remaining_patches.py           # dry run
  python3 fix_remaining_patches.py --apply   # apply
"""

import sys
import json
import shutil
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


def skip(msg: str) -> None:
    print(f"  ~  {msg}")


def _backup(path: Path) -> None:
    if DRY or not path.exists():
        return
    rel = path.relative_to(ROOT)
    dest = BACKUP_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def write_file(relpath: str, content: str, label: str = "") -> None:
    path = ROOT / relpath
    tag = label or relpath
    if DRY:
        print(f"  [DRY] Would write: {relpath}")
        return
    _backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    ok(tag)


def patch_file(
    relpath: str,
    old: str,
    new: str,
    label: str = "",
    marker: str = "",
) -> bool:
    path = ROOT / relpath
    tag = label or relpath
    if not path.exists():
        err(f"File not found: {relpath}")
        return False
    content = path.read_text(encoding="utf-8")
    if marker and marker in content:
        skip(f"{relpath} — already applied ({repr(marker[:60])})")
        return True
    count = content.count(old)
    if count == 0:
        err(f"Target not found in {relpath}: {repr(old[:100])}")
        return False
    if count > 1:
        err(f"Ambiguous ({count}×) in {relpath}: {repr(old[:80])}")
        return False
    if DRY:
        print(f"  [DRY] Would patch: {relpath}")
        return True
    _backup(path)
    path.write_text(content.replace(old, new, 1), encoding="utf-8")
    ok(tag)
    return True


def patch_json(relpath: str, mutate, label: str = "") -> None:
    path = ROOT / relpath
    tag = label or relpath
    if not path.exists():
        err(f"File not found: {relpath}")
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        changed = mutate(data)
        if changed is False:
            skip(f"{tag} — already correct")
            return
        if DRY:
            print(f"  [DRY] Would update JSON: {relpath}")
            return
        _backup(path)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        ok(tag)
    except Exception as exc:
        err(f"JSON patch failed for {relpath}: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
#  1. lib/db/src/schema/index.ts — add metricsKv table
#
#  Root cause: schema/index.ts was `export {};` (boilerplate placeholder).
#  db-metrics.ts imports metricsKv from @workspace/db — needs it defined here.
#  @workspace/db's index.ts does `export * from "./schema"` so this propagates.
# ══════════════════════════════════════════════════════════════════════════════

DB_SCHEMA = '''\
/**
 * Agi-Suite database schema
 *
 * One export per table. Each table should define:
 *   - pgTable definition (the Drizzle table)
 *   - Zod insert schema (via createInsertSchema)
 *   - TypeScript types for Insert and Select
 *
 * Tables added per phase:
 *   Phase 2: metrics_kv  (FR-021 — persistent metrics storage)
 *   Phase 3: conversations, messages, agent_tool_calls, system_health_snapshots
 *   Phase 4: agent_plans, audit_log
 *   Phase 5: evolution_logs, strategy_weights, system_state, meta_config
 *   Phase 6: node_reputation, global_insights
 */

import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── FR-021: metrics_kv ────────────────────────────────────────────────────────
// Simple key-value store for persistent counters that must survive deploys.
// Currently used for: totalSubscribers
// Replaces: /tmp/r3-metrics.json (which resets on every Railway deploy)

export const metricsKv = pgTable("metrics_kv", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertMetricsKvSchema = createInsertSchema(metricsKv);
export type InsertMetricsKv = z.infer<typeof insertMetricsKvSchema>;
export type MetricsKv = typeof metricsKv.$inferSelect;
'''

# ══════════════════════════════════════════════════════════════════════════════
#  2. apps/api-server/src/app.ts patches
#
#  Patch A: mount requireAuth (it was imported but never app.use()'d)
#  Patch B: global error handler before export default app (FR-022)
#
#  Exact anchors from the real file content:
#    A: `app.use("/api", router);`   — unique, appears once
#    B: `export default app;`        — unique, appears once
# ══════════════════════════════════════════════════════════════════════════════

APP_AUTH_BEFORE = 'app.use("/api", router);'
APP_AUTH_AFTER = '''\
// FR-016: Bearer token auth — all routes except /api/healthz
// requireAuth was imported by the Phase 2 script but never mounted.
app.use(requireAuth);

app.use("/api", router);'''

APP_EXPORT_BEFORE = "export default app;"
APP_EXPORT_AFTER = '''\
// ── FR-022: Global error handler ─────────────────────────────────────────────
// 4-arg signature is required for Express to recognise this as an error handler.
// Returns { error, code } per the structured-error contract for all routes.
// Must be the last middleware registered (after all routes).
app.use(
  (
    err: Error & { status?: number; code?: string },
    _req: import("express").Request,
    res: import("express").Response,
    _next: import("express").NextFunction,
  ) => {
    const status = err.status ?? 500;
    const code =
      err.code ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    if (status >= 500) {
      logger.error({ err }, "Unhandled server error");
    }
    if (res.headersSent) return;
    res.status(status).json({
      error: err.message ?? "Internal server error",
      code,
    });
  },
);

export default app;'''

# ══════════════════════════════════════════════════════════════════════════════
#  3. apps/api-server/src/routes/metrics.ts patches
#
#  Patch A: Load totalSubscribers from DB on startup (FR-021 primary source)
#           Exact anchor: `let totalSubscribers = loadPersisted();`
#
#  Patch B: Also write to DB when totalSubscribers increments (FR-021)
#           Exact anchor: `savePersisted(totalSubscribers);`
#
#  Strategy: /tmp is kept as fallback — if DB is unreachable on startup the
#  /tmp value is still used. DB write happens alongside /tmp write on every
#  new subscriber. When DB is available and populated, subsequent startups
#  load the DB value (which survives Railway deploys unlike /tmp).
# ══════════════════════════════════════════════════════════════════════════════

METRICS_LOAD_BEFORE = "let totalSubscribers = loadPersisted();"
METRICS_LOAD_AFTER = '''\
let totalSubscribers = loadPersisted();

// FR-021 — Overlay with PostgreSQL value on startup.
// loadPersisted() reads /tmp which resets on every Railway deploy.
// The DB value persists across deploys and takes precedence when available.
void (async () => {
  try {
    const { readMetric } = await import("../lib/db-metrics.js");
    const stored = await readMetric("totalSubscribers");
    if (stored !== null) {
      totalSubscribers = Number(stored);
      logger.info(
        { totalSubscribers },
        "metrics: totalSubscribers loaded from DB",
      );
    }
  } catch {
    /* DB unavailable on startup — /tmp value above is the fallback */
  }
})();'''

METRICS_SAVE_BEFORE = "savePersisted(totalSubscribers);"
METRICS_SAVE_AFTER = '''\
savePersisted(totalSubscribers);
    // FR-021 — Also write to PostgreSQL (primary store, survives deploys)
    void import("../lib/db-metrics.js").then(({ writeMetric }) => {
      writeMetric("totalSubscribers", String(totalSubscribers));
    });'''

# ══════════════════════════════════════════════════════════════════════════════
#  4. apps/api-server/package.json — ensure @workspace/db is a dependency
#
#  db-metrics.ts imports from "@workspace/db". The api-server package.json
#  must list it as a dependency for pnpm to resolve the workspace package.
# ══════════════════════════════════════════════════════════════════════════════

def add_db_dep(data: dict):
    deps = data.setdefault("dependencies", {})
    if "@workspace/db" in deps:
        return False  # already present — signal skip
    deps["@workspace/db"] = "workspace:*"


# ══════════════════════════════════════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════════════════════════════════════

def main() -> int:
    if DRY:
        print("\n[DRY RUN] No files written. Pass --apply to execute.\n")
    else:
        print(f"\n[APPLY] Root: {ROOT}")
        print(f"[APPLY] Backups: {BACKUP_DIR}\n")

    if not (ROOT / "package.json").exists():
        print(f"\n✗  ABORT: {ROOT}/package.json not found.\n")
        return 1

    # ── Step 1: Schema ────────────────────────────────────────────────────────
    print("── Step 1: lib/db/src/schema/index.ts (metricsKv table) ───────────────")
    schema_path = ROOT / "lib/db/src/schema/index.ts"
    # Only overwrite if it's still the empty boilerplate (export {};)
    if schema_path.exists():
        existing = schema_path.read_text(encoding="utf-8")
        if "metricsKv" in existing:
            skip("lib/db/src/schema/index.ts — metricsKv already defined")
        else:
            write_file(
                "lib/db/src/schema/index.ts",
                DB_SCHEMA,
                "schema/index.ts — metricsKv table added",
            )
    else:
        write_file(
            "lib/db/src/schema/index.ts",
            DB_SCHEMA,
            "schema/index.ts — metricsKv table added",
        )

    # ── Step 2: api-server deps ───────────────────────────────────────────────
    print("\n── Step 2: apps/api-server/package.json (@workspace/db dep) ───────────")
    patch_json(
        "apps/api-server/package.json",
        add_db_dep,
        "api-server/package.json — @workspace/db: workspace:*",
    )

    # ── Step 3: app.ts — mount requireAuth ───────────────────────────────────
    print("\n── Step 3: app.ts — mount requireAuth (FR-016) ─────────────────────────")
    patch_file(
        "apps/api-server/src/app.ts",
        APP_AUTH_BEFORE,
        APP_AUTH_AFTER,
        "app.ts — app.use(requireAuth) mounted before /api router",
        marker="// FR-016: Bearer token auth",
    )

    # ── Step 4: app.ts — global error handler ────────────────────────────────
    print("\n── Step 4: app.ts — global error handler (FR-022) ──────────────────────")
    patch_file(
        "apps/api-server/src/app.ts",
        APP_EXPORT_BEFORE,
        APP_EXPORT_AFTER,
        "app.ts — 4-arg error handler before export default",
        marker="// ── FR-022: Global error handler",
    )

    # ── Step 5: metrics.ts — DB load on startup ───────────────────────────────
    print("\n── Step 5: metrics.ts — load totalSubscribers from DB (FR-021) ─────────")
    patch_file(
        "apps/api-server/src/routes/metrics.ts",
        METRICS_LOAD_BEFORE,
        METRICS_LOAD_AFTER,
        "metrics.ts — DB overlay on startup",
        marker="FR-021 — Overlay with PostgreSQL",
    )

    # ── Step 6: metrics.ts — DB write on increment ────────────────────────────
    print("\n── Step 6: metrics.ts — write to DB on new subscriber (FR-021) ─────────")
    patch_file(
        "apps/api-server/src/routes/metrics.ts",
        METRICS_SAVE_BEFORE,
        METRICS_SAVE_AFTER,
        "metrics.ts — DB write alongside /tmp save",
        marker="FR-021 — Also write to PostgreSQL",
    )

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 64)
    if APPLIED:
        print(f"\n  ✓  Applied ({len(APPLIED)}):")
        for a in APPLIED:
            print(f"       {a}")
    if ERRORS:
        print(f"\n  ✗  Failed ({len(ERRORS)}):")
        for e in ERRORS:
            print(f"       {e}")
    if DRY:
        print("\n[DRY RUN complete] Pass --apply to execute.\n")
    else:
        print("""
[All patches applied]

Next steps — run in order:

  1. Install @workspace/db in api-server:
       pnpm install

  2. Push schema to local DB (drizzle-kit push is dev-only, no migration file):
       pnpm --filter @workspace/db drizzle-kit push

     Or if you prefer a migration file (recommended before production):
       pnpm --filter @workspace/db drizzle-kit generate
       pnpm --filter @workspace/db drizzle-kit migrate

     Verify the table was created (per SKILLS.md #5):
       DATABASE_URL="postgresql://..." node -e "
       const {Pool}=require('pg');
       const p=new Pool({connectionString:process.env.DATABASE_URL});
       p.query(\\\"SELECT table_name FROM information_schema.tables WHERE table_schema='public'\\\")
        .then(r=>{console.log(r.rows.map(x=>x.table_name));p.end()})
       "

  3. Typecheck:
       pnpm typecheck

     Expected: 0 errors across all packages.

  4. Lint:
       pnpm lint

     Expected: 0 errors (after fix_eslint_and_db.py --apply was run).

  5. Smoke test:
       pnpm dev
       curl -s http://localhost:3001/api/metrics | python3 -m json.tool
       # totalSubscribers should now survive server restarts

  6. Test auth (once API_SECRET is set in .env):
       curl -s http://localhost:3001/api/metrics
       # → 401 {"error":"Unauthorized","code":"MISSING_TOKEN"}
       curl -s -H "Authorization: Bearer $API_SECRET" http://localhost:3001/api/metrics
       # → 200 with metrics JSON
""")
    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
