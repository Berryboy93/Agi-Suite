import os, re

BASE = os.path.expanduser("~/Agi-Suite")

def write(rel, content):
    path = os.path.join(BASE, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    print(f"  WROTE   {rel}")

def patch_json_key(rel, key, old_val, new_val):
    path = os.path.join(BASE, rel)
    with open(path) as f:
        raw = f.read()
    if old_val in raw:
        with open(path, "w") as f:
            f.write(raw.replace(old_val, new_val, 1))
        print(f"  PATCHED {rel} [{key}]")
    elif new_val in raw:
        print(f"  SKIP    {rel} [{key}] (already patched)")
    else:
        print(f"  WARN    {rel} [{key}] — pattern not found, check manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX A — root package.json
# 1) Add "predev" script that clears ports before concurrently starts
# 2) Fix tsx watch --ignore so file-write storms don't cascade restarts
# ─────────────────────────────────────────────────────────────────────────────
patch_json_key(
    "package.json",
    "scripts.dev",
    '"dev": "concurrently --kill-others --kill-others-on-fail -n api,agi -c blue,green \\"pnpm --filter @workspace/api-server dev\\" \\"pnpm --filter @workspace/r3-agi dev\\""',
    '"predev": "fuser -k 3001/tcp 5176/tcp 2>/dev/null; true",\n    "dev": "concurrently --kill-others --kill-others-on-fail -n api,agi -c blue,green \\"pnpm --filter @workspace/api-server dev\\" \\"pnpm --filter @workspace/r3-agi dev\\""',
)

# ─────────────────────────────────────────────────────────────────────────────
# FIX B — tsx watch --ignore in api-server/package.json
# Prevents restarts on dist/, *.bak, *.mjs, tmp files
# ─────────────────────────────────────────────────────────────────────────────
patch_json_key(
    "apps/api-server/package.json",
    "scripts.dev",
    '"dev": "NODE_ENV=development tsx watch --env-file=.env src/index.ts"',
    '"dev": "NODE_ENV=development tsx watch --env-file=.env --ignore=\'dist/**\' --ignore=\'**/*.bak\' --ignore=\'**/*.mjs\' src/index.ts"',
)

# ─────────────────────────────────────────────────────────────────────────────
# FIX B+C — index.ts: EADDRINUSE retry with backoff (handles tsx restart race)
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

// ── Retry on EADDRINUSE ───────────────────────────────────────────────────────
// During tsx watch restarts, the outgoing server socket may still be in
// TIME_WAIT when the next child spawns.  We back off 1 s and retry up to
// three times before giving up.  Any other error is fatal immediately.
let bindRetries = 0;
const MAX_BIND_RETRIES = 3;
const BIND_RETRY_MS    = 1_000;

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
    }, BIND_RETRY_MS * bindRetries); // 1 s, 2 s, 3 s
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
  // Force exit if connections linger beyond 5 s (prevents orphan on tsx restart)
  setTimeout(() => {
    logger.warn("Force-exiting after shutdown timeout");
    process.exit(1);
  }, 5_000).unref();
}

process.on("SIGTERM", () => { shutdown("SIGTERM"); });
process.on("SIGINT",  () => { shutdown("SIGINT"); });
""")

print("\nAll v2 fixes applied.")
print("\nNext steps:")
print("  kill -9 2108 2140 2>/dev/null; sleep 1")
print("  pnpm dev")
