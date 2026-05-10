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
import { logger } from "./logger.js";

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
      logger.warn({ err: err as Error }, "[db-metrics] write failed");
    });
}
