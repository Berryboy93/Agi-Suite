import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "@workspace/db";

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

// ── Run migrations before starting server ──────────────────────────────────
(async () => {
  try {
    await runMigrations();
  } catch (err) {
    logger.fatal({ err }, "Cannot start server without successful migrations");
    process.exit(1);
  }

  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  // ── Retry on EADDRINUSE ───────────────────────────────────────────────────────
  let bindRetries = 0;
  const MAX_BIND_RETRIES = 3;
  const BIND_RETRY_MS = 1_000;
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && bindRetries < MAX_BIND_RETRIES) {
      bindRetries += 1;
      logger.warn(
        { port, attempt: bindRetries, maxAttempts: MAX_BIND_RETRIES },
        "Port in use — retrying after backoff",
      );
      setTimeout(() => {
        server.close();
        server.listen(port);
      }, BIND_RETRY_MS * bindRetries);
      return;
    }
    logger.error({ err }, "Fatal: could not bind to port");
    process.exit(1);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────────
  function shutdown(signal: string): void {
    logger.info({ signal }, "Shutting down gracefully");
    server.close(() => {
      logger.info("Server closed — all connections drained");
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn("Force-exiting after shutdown timeout");
      process.exit(1);
    }, 5_000).unref();
  }

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
})();
