/**
 * middleware/agentAuth.ts
 *
 * Express middleware that validates x-agent-token for machine-to-machine calls.
 * Used by the /api/agents/* routes — NOT user JWT auth.
 * Token must match AGENT_SERVICE_TOKEN env var (shared with Stable + Agent-OS).
 */
import type { Request, Response, NextFunction } from "express";

const AGENT_TOKEN = process.env.AGENT_SERVICE_TOKEN;

export function requireAgentToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!AGENT_TOKEN) {
    res.status(503).json({ error: "Agent token not configured on server" });
    return;
  }
  const incoming = req.headers["x-agent-token"];
  if (!incoming || incoming !== AGENT_TOKEN) {
    res.status(401).json({ error: "Unauthorized: invalid agent token" });
    return;
  }
  next();
}
