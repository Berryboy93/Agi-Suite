/**
 * Mythos Governance Engine v5 — Public API
 */

export type {
  Surface,
  ActionType,
  BlastRadiusLevel,
  MatrixEntry,
} from "./surfaces/surfaces.js";
export {
  SURFACES,
  ACTION_TYPES,
  BLAST_RADIUS_LEVELS,
  lookupBlastRadius,
  compareBlastRadius,
} from "./surfaces/surfaces.js";

export type { Outcome, DeferStructure } from "./rules/outcomes.js";
export {
  OUTCOMES,
  mostRestrictive,
  validateDeferStructure,
} from "./rules/outcomes.js";

export type {
  BarrierId,
  BarrierState,
  BarrierSnapshot,
} from "./barriers/barriers.js";
export {
  BARRIER_IDS,
  REQUIRED_BARRIERS,
  verifyBarriers,
} from "./barriers/barriers.js";

export type {
  AdvisorySeverity,
  RepricingInput,
  RepricingResult,
} from "./repricing/repricing.js";
export { applyRepricing } from "./repricing/repricing.js";

export type {
  ChangeRequest,
  ChangeRequestPair,
  PairEvaluationResult,
  EvaluationResult,
} from "./rules/evaluator.js";
export { evaluateChangeRequest } from "./rules/evaluator.js";
