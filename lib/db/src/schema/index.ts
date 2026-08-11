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

import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

// ── FR-021: metrics_kv ────────────────────────────────────────────────────────
// Simple key-value store for persistent counters that must survive deploys.
// Currently used for: totalSubscribers
// Replaces: /tmp/r3-metrics.json (which resets on every Railway deploy)

export const metricsKv = pgTable("metrics_kv", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertMetricsKvSchema = createInsertSchema(metricsKv).strict();
export type InsertMetricsKv = z.infer<typeof insertMetricsKvSchema>;
export type MetricsKv = typeof metricsKv.$inferSelect;

// ── agi_agents ────────────────────────────────────────────────────────────────
// Agent dispatch queue for Agent-OS → Agi-Suite integration.
export const agentStatusEnum = pgEnum("agent_status", [
  "pending",
  "claimed",
  "running",
  "done",
  "failed",
]);

export const agents = pgTable("agi_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 128 }).notNull(),
  status: agentStatusEnum("status").notNull().default("pending"),
  payload: jsonb("payload").notNull().default({}),
  result: jsonb("result"),
  error: text("error"),
  idempotencyKey: varchar("idempotency_key", { length: 256 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;
