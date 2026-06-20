import { Router, type IRouter } from "express";
import healthRouter from "./health";
import metricsRouter from "./metrics";
import agentRouter from "./agent";
import agentsRouter from "./agents.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(metricsRouter);
router.use(agentRouter);
router.use("/agents", agentsRouter);

export default router;
