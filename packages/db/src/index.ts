/**
 * @workspace/db
 * Shared Drizzle + Postgres client for Agi-Suite.
 * DATABASE_URL must be set in the environment.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";

if (!process.env.DATABASE_URL) {
  throw new Error("[workspace/db] DATABASE_URL is not set");
}

const sql = postgres(process.env.DATABASE_URL, { max: 5 });
export const db = drizzle(sql);

// ── metrics_kv ────────────────────────────────────────────────────────────────
export const metricsKv = pgTable("metrics_kv", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── agents ────────────────────────────────────────────────────────────────────
export type AgentStatus = "pending" | "claimed" | "running" | "done" | "failed";

export const agents = pgTable("agi_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 64 }).notNull(),
  status: varchar("status", { length: 16 })
    .$type<AgentStatus>()
    .notNull()
    .default("pending"),
  payload: jsonb("payload").notNull(),
  result: jsonb("result"),
  error: text("error"),
  idempotencyKey: varchar("idempotency_key", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
