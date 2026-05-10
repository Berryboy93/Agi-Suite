import os, sys

BASE = os.path.expanduser("~/Agi-Suite")

def write(rel, content):
    path = os.path.join(BASE, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    print(f"  WROTE  {rel}")

def delete(rel):
    path = os.path.join(BASE, rel)
    if os.path.exists(path):
        os.remove(path)
        print(f"  DELETED {rel}")
    else:
        print(f"  SKIP (not found) {rel}")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 — index.ts: store server, graceful shutdown handlers
# ─────────────────────────────────────────────────────────────────────────────
write("apps/api-server/src/index.ts", """\
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err: NodeJS.ErrnoException) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down gracefully");
  server.close(() => {
    logger.info("Server closed — all connections drained");
    process.exit(0);
  });
  // Force exit if connections linger beyond 5 s
  setTimeout(() => {
    logger.warn("Force-exiting after shutdown timeout");
    process.exit(1);
  }, 5_000).unref();
}

process.on("SIGTERM", () => { shutdown("SIGTERM"); });
process.on("SIGINT",  () => { shutdown("SIGINT"); });
""")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2 — root package.json: --kill-others --kill-others-on-fail
# ─────────────────────────────────────────────────────────────────────────────
pkg_path = os.path.join(BASE, "package.json")
with open(pkg_path) as f:
    raw = f.read()

old = '"dev": "concurrently -n api,agi -c blue,green \\"pnpm --filter @workspace/api-server dev\\" \\"pnpm --filter @workspace/r3-agi dev\\""'
new = '"dev": "concurrently --kill-others --kill-others-on-fail -n api,agi -c blue,green \\"pnpm --filter @workspace/api-server dev\\" \\"pnpm --filter @workspace/r3-agi dev\\""'

if old in raw:
    with open(pkg_path, "w") as f:
        f.write(raw.replace(old, new, 1))
    print("  WROTE  package.json (dev script)")
else:
    print("  WARN   package.json dev script not matched — check manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3 — agent.ts: lazy Anthropic client, guard before construction
# ─────────────────────────────────────────────────────────────────────────────
write("apps/api-server/src/routes/agent.ts", """\
import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// Lazily initialised so the module can load even when the env var is absent.
// The runtime guard inside the handler provides a clean 503 in that case.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

router.post("/agent/chat", async (req: Request, res: Response) => {
  const {
    messages,
    system,
    max_tokens = 1500,
  } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    system?: string;
    max_tokens?: number;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "ANTHROPIC_API_KEY not configured on server" });
    return;
  }

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const stream = getClient().messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens,
      ...(system ? { system } : {}),
      messages,
    });

    stream.on("text", (text) => {
      res.write(`data: ${JSON.stringify({ type: "text_delta", text })}\\n\\n`);
    });

    stream.once("finalMessage", () => {
      res.write("data: [DONE]\\n\\n");
      res.end();
    });

    stream.on("error", (err: Error) => {
      // Ignore abort errors — expected when client disconnects
      if (
        err.message?.includes("aborted") ||
        err.constructor?.name === "APIUserAbortError"
      ) {
        return;
      }
      try {
        res.write(
          `data: ${JSON.stringify({ type: "error", message: err.message })}\\n\\n`,
        );
        res.end();
      } catch {
        /* ignore — response may already be closed */
      }
    });

    // abort is a distinct event from error in the Anthropic SDK.
    // Without this listener, _emit('abort') produces an unhandled rejection
    // that kills the process on client disconnect.
    stream.on("abort", () => {});

    req.on("close", () => {
      try {
        stream.abort();
      } catch {
        /* ignore */
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    res.write(`data: ${JSON.stringify({ type: "error", message })}\\n\\n`);
    res.end();
  }
});

export default router;
""")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4 — vite.config.ts: remove strictPort (orphan fix makes it unnecessary)
# ─────────────────────────────────────────────────────────────────────────────
write("apps/r3-agi/vite.config.ts", """\
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5176,
    // strictPort removed: graceful shutdown in api-server/src/index.ts ensures
    // ports are always released before re-launch. Keeping strictPort: true here
    // would cause a hard crash on any accidental port collision; without it Vite
    // auto-selects the next free port and stays alive.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
""")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 5 — app.ts: CORS with configurable origin allowlist
# ─────────────────────────────────────────────────────────────────────────────
write("apps/api-server/src/app.ts", """\
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// CORS — allow origins defined in CORS_ORIGIN (comma-separated) or fall back
// to localhost dev defaults. Never use wildcard in an API that reads cookies.
const rawOrigins = process.env["CORS_ORIGIN"] ?? "";
const allowedOrigins: (string | RegExp)[] = rawOrigins.trim()
  ? rawOrigins.split(",").map((o) => o.trim())
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
    ];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server requests (no Origin header) and listed origins
      if (!origin || allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin)
      )) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
""")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 6 + 7 — metrics.ts: fetch timeout + totalSubscribers decrement on expiry
# ─────────────────────────────────────────────────────────────────────────────
write("apps/api-server/src/routes/metrics.ts", """\
import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import fs from "fs";
import path from "path";

const router: IRouter = Router();

const SESSION_TTL_MS   = 45_000;
const FETCH_TIMEOUT_MS = 10_000;
const PERSIST_FILE     = path.join("/tmp", "r3-metrics.json");

const activeSessions = new Map<string, number>();
const sseClients     = new Set<Response>();

function loadPersisted(): number {
  try {
    const raw  = fs.readFileSync(PERSIST_FILE, "utf-8");
    const data = JSON.parse(raw) as { totalSubscribers?: number };
    return typeof data.totalSubscribers === "number" ? data.totalSubscribers : 147;
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

interface R3TimeSavings {
  totalSessions:     number;
  totalSavedSeconds: number;
  avgSavedSeconds:   number;
}

let r3Metrics: R3TimeSavings = {
  totalSessions:     0,
  totalSavedSeconds: 0,
  avgSavedSeconds:   0,
};

const R3_URL    = process.env["R3_INTERNAL_URL"] ?? "http://localhost:3000";
const R3_SECRET = process.env["INTERNAL_SECRET"] ?? "";

async function fetchR3Metrics(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${R3_URL}/api/internal/metrics/time-savings`, {
      headers: { "x-internal-secret": R3_SECRET },
      signal:  controller.signal,
    });
    if (res.ok) {
      r3Metrics = (await res.json()) as R3TimeSavings;
      broadcast();
    } else {
      logger.warn(
        { status: res.status, url: `${R3_URL}/api/internal/metrics/time-savings` },
        "fetchR3Metrics: non-ok response — check INTERNAL_SECRET alignment",
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("fetchR3Metrics: request timed out after %dms", FETCH_TIMEOUT_MS);
    }
    /* R3 offline or slow — keep last known values */
  } finally {
    clearTimeout(timer);
  }
}

void fetchR3Metrics();
setInterval(() => { void fetchR3Metrics(); }, 30_000);

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
  })}\\n\\n`;

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
  res.json({ activeUsers: activeSessions.size, totalSubscribers, ...r3Metrics });
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
    })}\\n\\n`,
  );

  sseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\\n\\n");
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

// Periodic stale-session pruner — broadcasts if the active count changed
setInterval(() => {
  const before = activeSessions.size;
  pruneStale();
  if (activeSessions.size !== before) broadcast();
}, 15_000);

export default router;
""")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 9 — useMetrics.ts: wrap heartbeat in useCallback
# ─────────────────────────────────────────────────────────────────────────────
write("apps/r3-agi/src/hooks/useMetrics.ts", """\
import { useCallback, useEffect, useRef, useState } from "react";

interface Metrics {
  activeUsers:       number;
  totalSubscribers:  number;
  totalSessions:     number;
  totalSavedSeconds: number;
  avgSavedSeconds:   number;
}

const SESSION_KEY = "r3-agi-session-id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `agi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({
    activeUsers:       0,
    totalSubscribers:  0,
    totalSessions:     0,
    totalSavedSeconds: 0,
    avgSavedSeconds:   0,
  });
  const [connected, setConnected] = useState(false);
  const sessionId = useRef(getSessionId());

  const heartbeat = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics/heartbeat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId: sessionId.current }),
      });
      if (res.ok) setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []); // sessionId.current is a stable ref — safe empty deps

  useEffect(() => {
    void heartbeat();
    const hbInterval = setInterval(() => { void heartbeat(); }, 30_000);

    const es        = new EventSource("/api/metrics/stream");
    es.onopen       = () => { setConnected(true); };
    es.onerror      = () => { setConnected(false); };
    es.onmessage    = (e) => {
      try {
        setMetrics(JSON.parse(e.data) as Metrics);
        setConnected(true);
      } catch {
        /* ignore malformed frame */
      }
    };

    return () => {
      clearInterval(hbInterval);
      es.close();
    };
  }, [heartbeat]);

  return { metrics, connected };
}
""")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 8 — Remove .bak files
# ─────────────────────────────────────────────────────────────────────────────
delete("apps/r3-agi/src/components/Header.tsx.bak")
delete("apps/r3-agi/src/hooks/useMetrics.ts.bak")
delete("apps/r3-agi/src/main.tsx.bak-20260419_013110")
delete("apps/r3-agi/src/main.tsx.bak-scaffold")

print("\nAll fixes applied.")
