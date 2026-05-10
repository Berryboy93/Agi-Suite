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
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Health probe — always public
  if (req.path.startsWith("/api/healthz")) {
    next();
    return;
  }

  const secret = process.env.API_SECRET;

  // Dev mode: skip auth when no secret configured
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Production must have API_SECRET — this is a misconfiguration
      res.status(500).json({
        error: "Server misconfiguration: API_SECRET is not set",
        code: "CONFIG_ERROR",
      });
      return;
    }
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  // Support both header and ?token= query param (for EventSource / SSE)
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : typeof req.query.token === "string"
      ? req.query.token
      : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized", code: "MISSING_TOKEN" });
    return;
  }

  if (token !== secret) {
    res.status(401).json({ error: "Unauthorized", code: "INVALID_TOKEN" });
    return;
  }

  next();
}
