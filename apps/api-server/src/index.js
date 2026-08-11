import app from "./app";
import { logger } from "./lib/logger";
const rawPort = process.env["PORT"];
if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
}
const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
});
// ── Retry on EADDRINUSE ───────────────────────────────────────────────────────
// During tsx watch restarts, the outgoing server socket may still be in
// TIME_WAIT when the next child spawns.  We back off 1 s and retry up to
// three times before giving up.  Any other error is fatal immediately.
let bindRetries = 0;
const MAX_BIND_RETRIES = 3;
const BIND_RETRY_MS = 1000;
server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && bindRetries < MAX_BIND_RETRIES) {
        bindRetries += 1;
        logger.warn({ port, attempt: bindRetries, maxAttempts: MAX_BIND_RETRIES }, "Port in use — retrying after backoff");
        setTimeout(() => {
            server.close();
            server.listen(port);
        }, BIND_RETRY_MS * bindRetries); // 1 s, 2 s, 3 s
        return;
    }
    logger.error({ err }, "Fatal: could not bind to port");
    process.exit(1);
});
// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
    logger.info({ signal }, "Shutting down gracefully");
    server.close(() => {
        logger.info("Server closed — all connections drained");
        process.exit(0);
    });
    // Force exit if connections linger beyond 5 s (prevents orphan on tsx restart)
    setTimeout(() => {
        logger.warn("Force-exiting after shutdown timeout");
        process.exit(1);
    }, 5000).unref();
}
process.on("SIGTERM", () => {
    shutdown("SIGTERM");
});
process.on("SIGINT", () => {
    shutdown("SIGINT");
});
//# sourceMappingURL=index.js.map