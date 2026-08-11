/**
 * routes/agents.ts
 *
 * REST endpoint for Agent-OS → Agi-Suite agent dispatch.
 * Replaces the tRPC approach — Agi-Suite is Express-only.
 *
 * Agent-OS dispatch.ts must call these via plain fetch, not tRPC client.
 *
 * POST /api/agents/register      → RegisterAgentOutput
 * GET  /api/agents/:id/status    → AgentStatusOutput
 * GET  /api/agents               → list (last 50)
 */

import { Router, type Request, type Response, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, agents } from "@workspace/db";
import { requireAgentToken } from "../middleware/agentAuth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ── GET /api/agents/status (public summary — no token required) ──────────────
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const { sql } = await import("drizzle-orm");
    const rows = await db
      .select({
        status: agents.status,
        count: sql<string>`cast(count(*) as text)`,
      })
      .from(agents)
      .groupBy(agents.status);

    const summary: Record<string, number> = {};
    for (const row of rows) summary[row.status] = Number(row.count);

    res.json({ ok: true, summary });
  } catch (err) {
    logger.error({ err }, "[agents] status summary failed");
    res.status(500).json({ error: "Failed to get agent summary" });
  }
});

// All agent routes require machine token
router.use(requireAgentToken);

// ── POST /api/agents/register ─────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  const { type, payload, idempotencyKey } = req.body as {
    type: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  };

  if (!type || !payload) {
    res.status(400).json({ error: "type and payload are required" });
    return;
  }

  try {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await db
        .select()
        .from(agents)
        .where(eq(agents.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing.length > 0) {
        const e = existing[0]!;
        res.json({
          agentId: e.id,
          status: e.status,
          queuedAt: e.createdAt!.toISOString(),
        });
        return;
      }
    }

    const [agent] = await db
      .insert(agents)
      .values({
        type,
        payload: { ...payload, type },
        idempotencyKey: idempotencyKey ?? null,
      })
      .returning();

    if (!agent) throw new Error("Insert returned no rows");

    logger.info({ agentId: agent.id, type }, "[agents] registered");

    res.status(201).json({
      agentId: agent.id,
      status: agent.status,
      queuedAt: agent.createdAt!.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "[agents] register failed");
    res.status(500).json({ error: "Failed to register agent" });
  }
});

// ── GET /api/agents/:id/status ────────────────────────────────────────────────
router.get("/:id/status", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, String(id)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: `Agent ${id} not found` });
      return;
    }

    res.json({
      agentId: agent.id,
      status: agent.status,
      result: agent.result ?? undefined,
      error: agent.error ?? undefined,
      createdAt: agent.createdAt!.toISOString(),
      completedAt: agent.completedAt?.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "[agents] getStatus failed");
    res.status(500).json({ error: "Failed to get agent status" });
  }
});

// ── GET /api/agents ───────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
  const status = req.query["status"] as string | undefined;

  try {
    const rows = await db
      .select()
      .from(agents)
      .where(
        status
          ? eq(
              agents.status,
              status as "pending" | "claimed" | "running" | "done" | "failed",
            )
          : undefined,
      )
      .orderBy(desc(agents.createdAt))
      .limit(limit);

    res.json(
      rows.map((a) => ({
        agentId: a.id,
        type: a.type,
        status: a.status,
        createdAt: a.createdAt!.toISOString(),
        completedAt: a.completedAt?.toISOString(),
      })),
    );
  } catch (err) {
    logger.error({ err }, "[agents] list failed");
    res.status(500).json({ error: "Failed to list agents" });
  }
});

export default router;
