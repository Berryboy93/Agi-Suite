import { Router } from "express";
import healthRouter from "./health";
import metricsRouter from "./metrics";
import agentRouter from "./agent";
import agentsRouter from "./agents.js";
import latencyRouter from "./latency";
const router = Router();
router.use(healthRouter);
router.use(metricsRouter);
router.use(agentRouter);
router.use("/agents", agentsRouter);
router.use(latencyRouter);
export default router;
//# sourceMappingURL=index.js.map