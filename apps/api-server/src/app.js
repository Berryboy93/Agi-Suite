import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth.js";
import pinoHttp from "pino-http";
import router from "./routes";
import { setupToolsProxy } from "./tools-proxy.js";
import { logger } from "./lib/logger";
import { RBACManager, AuditLogger } from '@agent-os/rbac';
const app = express();
// ── RBAC (Mythos Security Hardened) ───────────────────────────────────────
const auditLogger = new AuditLogger(10000);
const rbac = new RBACManager(auditLogger);
app.locals['rbac'] = rbac;
app.locals['auditLogger'] = auditLogger;
// ── CORS ───────────────────────────────────────────────────────────────────
const rawOrigins = process.env["CORS_ORIGIN"] ?? "";
const allowedOrigins = rawOrigins.trim()
    ? rawOrigins.split(",").map((o) => o.trim())
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://100.115.92.199:5176",
        "http://100.115.92.199:5177",
    ];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin ||
            allowedOrigins.some((o) => typeof o === "string" ? o === origin : o.test(origin))) {
            cb(null, true);
        }
        else {
            cb(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    credentials: true,
}));
// ── Request logging ────────────────────────────────────────────────────────
app.use(pinoHttp({
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
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ── Public endpoints (no auth) ─────────────────────────────────────────────
// Root health for load balancers / external probes
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "api-server",
        timestamp: new Date().toISOString(),
    });
});
// ── FR-016: Bearer token auth ──────────────────────────────────────────────
// Skip auth for /api/healthz — mounted AFTER public routes but BEFORE API router
app.use((req, res, next) => {
    if (req.path === "/api/healthz") {
        return next();
    }
    return requireAuth(req, res, next);
});
app.use("/api", router);
setupToolsProxy(router);
// ── FR-022: Global error handler ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
    const status = err.status ?? 500;
    const code = err.code ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    if (status >= 500) {
        logger.error({ err }, "Unhandled server error");
    }
    if (res.headersSent)
        return;
    res.status(status).json({
        error: err.message ?? "Internal server error",
        code,
    });
});
export default app;
//# sourceMappingURL=app.js.map