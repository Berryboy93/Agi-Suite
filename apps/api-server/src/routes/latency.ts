/**
 * GET /api/latency — Fetch LLPTE pipeline latency metrics from R3 v4
 * No auth required (public endpoint for demo dashboard)
 */
import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router: any = Router();

const R3_URL = process.env["R3_INTERNAL_URL"] ?? "http://localhost:3000";
const R3_SECRET = process.env["INTERNAL_SECRET"] ?? "";

router.get("/latency", async (req: Request, res: Response) => {
  const window = (req.query.window as string) || "24h";

  try {
    const response = await fetch(
      `${R3_URL}/api/internal/metrics/latency?window=${window}`,
      {
        headers: { "x-internal-secret": R3_SECRET },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      logger.warn({ status: response.status }, "Failed to fetch R3 latency");
      return res.status(503).json({
        error: "R3 latency service unavailable",
        data: [],
        window,
      });
    }

    const json = (await response.json()) as any;
    return res.json({
      data: json.data || [],
      window,
      recordedAt: json.recordedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, "latency endpoint error");
    return res.status(500).json({
      error: "Failed to fetch latency metrics",
      data: [],
      window,
    });
  }
});

export default router;
