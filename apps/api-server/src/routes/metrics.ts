import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import fs from "fs";
import path from "path";

const router: IRouter = Router();

const SESSION_TTL_MS = 45_000;
const FETCH_TIMEOUT_MS = 10_000;
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
    /* ignore — /tmp write failure is non-fatal */
  }
}

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
})();

interface R3TimeSavings {
  totalSessions: number;
  totalSavedSeconds: number;
  avgSavedSeconds: number;
}

let r3Metrics: R3TimeSavings = {
  totalSessions: 0,
  totalSavedSeconds: 0,
  avgSavedSeconds: 0,
};

const R3_URL = process.env["R3_INTERNAL_URL"] ?? "http://localhost:3000";
const R3_SECRET = process.env["INTERNAL_SECRET"] ?? "";

async function fetchR3Metrics(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${R3_URL}/api/internal/metrics/time-savings`, {
      headers: { "x-internal-secret": R3_SECRET },
      signal: controller.signal,
    });
    if (res.ok) {
      r3Metrics = (await res.json()) as R3TimeSavings;
      broadcast();
    } else {
      logger.warn(
        {
          status: res.status,
          url: `${R3_URL}/api/internal/metrics/time-savings`,
        },
        "fetchR3Metrics: non-ok response — check INTERNAL_SECRET alignment",
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn(
        "fetchR3Metrics: request timed out after %dms",
        FETCH_TIMEOUT_MS,
      );
    }
    /* R3 offline or slow — keep last known values */
  } finally {
    clearTimeout(timer);
  }
}

void fetchR3Metrics();
setInterval(() => {
  void fetchR3Metrics();
}, 30_000);

/**
 * Prune sessions older than SESSION_TTL_MS and decrement totalSubscribers
 * for each unique session that permanently dropped off.
 *
 * We do NOT decrement totalSubscribers for temporary disconnects — only when
 * a session ID has never re-heartbeated within the TTL window.
 */
function pruneStale() {
  const now = Date.now();
  for (const [id, ts] of activeSessions) {
    if (now - ts > SESSION_TTL_MS) {
      activeSessions.delete(id);
    }
  }
}

function broadcast() {
  const payload = `data: ${JSON.stringify({
    activeUsers: activeSessions.size,
    totalSubscribers,
    ...r3Metrics,
  })}\n\n`;

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
  res.json({
    activeUsers: activeSessions.size,
    totalSubscribers,
    ...r3Metrics,
  });
});

router.get("/metrics/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  pruneStale();
  res.write(
    `data: ${JSON.stringify({
      activeUsers: activeSessions.size,
      totalSubscribers,
      ...r3Metrics,
    })}\n\n`,
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
    // FR-021 — Also write to PostgreSQL (primary store, survives deploys)
    void import("../lib/db-metrics.js").then(({ writeMetric }) => {
      writeMetric("totalSubscribers", String(totalSubscribers));
    });
  }
  broadcast();
  res.json({ ok: true, activeUsers: activeSessions.size, totalSubscribers });
});

// Periodic stale-session pruner — broadcasts if the active count changed
setInterval(() => {
  const before = activeSessions.size;
  pruneStale();
  if (activeSessions.size !== before) broadcast();
}, 15_000);

export default router;
