import { Router, type IRouter } from "express";
import healthRouter from "./health";
import metricsRouter from "./metrics";
import agentRouter from "./agent";

const router: IRouter = Router();

router.use(healthRouter);
router.use(metricsRouter);
router.use(agentRouter);

export default router;
