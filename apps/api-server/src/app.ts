import express, { type Express } from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth.js";
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
      if (
        !origin ||
        allowedOrigins.some((o) =>
          typeof o === "string" ? o === origin : o.test(origin),
        )
      ) {
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

// FR-016: Bearer token auth — all routes except /api/healthz
// requireAuth was imported by the Phase 2 script but never mounted.
app.use(requireAuth);

app.use("/api", router);

// ── FR-022: Global error handler ─────────────────────────────────────────────
// 4-arg signature is required for Express to recognise this as an error handler.
// Returns { error, code } per the structured-error contract for all routes.
// Must be the last middleware registered (after all routes).
app.use(
  (
    err: Error & { status?: number; code?: string },
    _req: import("express").Request,
    res: import("express").Response,
    _next: import("express").NextFunction,
  ) => {
    const status = err.status ?? 500;
    const code =
      err.code ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    if (status >= 500) {
      logger.error({ err }, "Unhandled server error");
    }
    if (res.headersSent) return;
    res.status(status).json({
      error: err.message ?? "Internal server error",
      code,
    });
  },
);

export default app;
