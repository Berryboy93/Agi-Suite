import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

const router: IRouter = Router();

const SESSION_TTL_MS = 45_000;
const PERSIST_FILE = path.join("/tmp", "r3-metrics.json");

const activeSessions = new Map<string, number>();
const sseClients = new Set<Response>();

function loadPersisted(): number {
  try {
    const raw = fs.readFileSync(PERSIST_FILE, "utf-8");
    const data = JSON.parse(raw) as { totalSubscribers?: number };
    return typeof data.totalSubscribers === "number"
      ? data.totalSubscribers
      : 147;
  } catch {
    return 147;
  }
}

function savePersisted(n: number) {
  try {
    fs.writeFileSync(PERSIST_FILE, JSON.stringify({ totalSubscribers: n }));
  } catch {
    /* ignore */
  }
}

let totalSubscribers = loadPersisted();

function pruneStale() {
  const now = Date.now();
  for (const [id, ts] of activeSessions) {
    if (now - ts > SESSION_TTL_MS) activeSessions.delete(id);
  }
}

function broadcast() {
  const payload = `data: ${JSON.stringify({ activeUsers: activeSessions.size, totalSubscribers })}\n\n`;
  for (const client of sseClients) {
    try {
      (client as Response & { write: (s: string) => void }).write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

router.get("/metrics", (_req, res) => {
  pruneStale();
  res.json({ activeUsers: activeSessions.size, totalSubscribers });
});

router.get("/metrics/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  pruneStale();
  res.write(
    `data: ${JSON.stringify({ activeUsers: activeSessions.size, totalSubscribers })}\n\n`,
  );

  sseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 20_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

router.post("/metrics/heartbeat", (req, res) => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  pruneStale();
  const isNew = !activeSessions.has(sessionId);
  activeSessions.set(sessionId, Date.now());
  if (isNew) {
    totalSubscribers += 1;
    savePersisted(totalSubscribers);
  }
  broadcast();
  res.json({ ok: true, activeUsers: activeSessions.size, totalSubscribers });
});

setInterval(() => {
  const before = activeSessions.size;
  pruneStale();
  if (activeSessions.size !== before) broadcast();
}, 15_000);

export default router;
