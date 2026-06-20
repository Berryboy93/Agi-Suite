import type { Request, Response, NextFunction } from "express";
/**
 * FR-016 — Request Authentication
 *
 * Validates Bearer token on every route except /api/healthz.
 * In development (NODE_ENV !== "production"), auth is skipped when API_SECRET
 * is not set — this allows local curl / Vite proxy to work without a token.
 *
 * Production (Railway): set API_SECRET env var. All requests without a valid
 * Bearer token receive 401 { error, code }.
 *
 * SSE connections pass the token as Authorization header on the initial
 * request — EventSource does not support custom headers, so the frontend
 * must use a custom fetch + ReadableStream polyfill or pass the token as
 * a ?token= query param (see useMetrics.ts).
 */
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map