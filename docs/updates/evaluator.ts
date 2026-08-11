/**
 * Mythos Governance Engine v5 — ChangeRequest Evaluator
 *
 * Evaluation Precedence (strict order, first applicable rule wins):
 *   1. Surface Rule (Rule 1) — credential surface unconditional hard block
 *   2. Blast Radius Rules (Rules 2–5) — outcome ceiling from matrix
 *   3. Barrier Verification — demote if required barriers inactive
 *   4. Mythos-Class Re-price Modifier — may relax ceiling only
 *
 * Compound ChangeRequest: each (Surface, ActionType) pair evaluated independently.
 * Final outcome = most restrictive across all pairs.
 * Any INVALID pair → entire ChangeRequest is BLOCK.
 */

import {
  type Surface,
  type ActionType,
  type BlastRadiusLevel,
  lookupBlastRadius,
  INVALID,
} from "../surfaces/surfaces.js";
import {
  type Outcome,
  type DeferStructure,
  mostRestrictive,
  validateDeferStructure,
} from "../rules/outcomes.js";
import { type BarrierSnapshot, verifyBarriers } from "../barriers/barriers.js";
import {
  type AdvisorySeverity,
  type RepricingInput,
  applyRepricing,
} from "../repricing/repricing.ts";

// ─── ChangeRequest Types ──────────────────────────────────────────────────────

export interface ChangeRequestPair {
  readonly surface: Surface;
  readonly actionType: ActionType;
  readonly advisory?: AdvisorySeverity;
  /**
   * Re-priced blast radius level from adversarial analysis.
   * Required for re-price modifier to activate.
   */
  readonly repricedLevel?: BlastRadiusLevel;
  readonly repricingRationale?: string;
}

export interface ChangeRequest {
  readonly id: string;
  readonly pairs: readonly ChangeRequestPair[];
  /**
   * Defer structure — required if caller expects a DEFER outcome.
   * Must pass validation per Defer Policy.
   */
  readonly defer?: DeferStructure;
  /** ISO-8601 timestamp of request submission. */
  readonly submittedAt: string;
}

// ─── Per-pair Evaluation Result ───────────────────────────────────────────────

export interface PairEvaluationResult {
  readonly surface: Surface;
  readonly actionType: ActionType;
  readonly matrixBlastRadius: BlastRadiusLevel | typeof INVALID;
  readonly blastRadiusOutcome: Outcome;
  readonly barrierVerification: {
    readonly verifiedOutcome: Outcome;
    readonly inactiveBarriers: readonly string[];
    readonly demoted: boolean;
  };
  readonly repricing: {
    readonly applied: boolean;
    readonly finalOutcome: Outcome;
    readonly anchoringDivergenceDetected: boolean;
    readonly flaggedForManualReview: boolean;
    readonly reason: string;
  };
  readonly pairOutcome: Outcome;
}

// ─── Final Evaluation Result ──────────────────────────────────────────────────

export interface EvaluationResult {
  readonly requestId: string;
  readonly timestamp: string;
  readonly finalOutcome: Outcome;
  readonly pairResults: readonly PairEvaluationResult[];
  readonly deferValidation?: {
    readonly valid: boolean;
    readonly error?: string;
  };
  readonly flaggedForManualReview: boolean;
  readonly auditTrail: readonly string[];
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

/**
 * Evaluate a ChangeRequest through the full Mythos v5 rule hierarchy.
 *
 * @param request The change request to evaluate.
 * @param barriers Current barrier snapshot from infrastructure health checks.
 * @returns A fully-populated, immutable EvaluationResult.
 */
export function evaluateChangeRequest(
  request: ChangeRequest,
  barriers: BarrierSnapshot,
): EvaluationResult {
  const auditTrail: string[] = [];
  const pairResults: PairEvaluationResult[] = [];
  let anyFlaggedForReview = false;

  // ── Compound ChangeRequest: evaluate each pair independently ──────────────
  for (const pair of request.pairs) {
    const pairResult = evaluatePair(pair, barriers, auditTrail);
    pairResults.push(pairResult);
    if (pairResult.repricing.flaggedForManualReview) {
      anyFlaggedForReview = true;
    }
  }

  // ── Compound resolution: most restrictive pair wins ───────────────────────
  let finalOutcome: Outcome = "ALLOW_RUNTIME";
  for (const pr of pairResults) {
    finalOutcome = mostRestrictive(finalOutcome, pr.pairOutcome);
  }
  auditTrail.push(`Compound resolution: final outcome = ${finalOutcome}`);

  // ── Defer Policy validation ───────────────────────────────────────────────
  let deferValidation: EvaluationResult["deferValidation"];

  if (finalOutcome === "DEFER" || request.defer) {
    if (!request.defer) {
      // DEFER outcome but no defer structure provided = BLOCK + alert
      finalOutcome = "BLOCK";
      deferValidation = {
        valid: false,
        error:
          "DEFER outcome requires a valid DeferStructure. None provided. Treating as BLOCK with security alert.",
      };
      auditTrail.push(
        "DEFER → BLOCK: No defer structure provided. Invalid defer = BLOCK per spec.",
      );
    } else {
      const deferError = validateDeferStructure(request.defer);
      if (deferError) {
        finalOutcome = "BLOCK";
        deferValidation = { valid: false, error: deferError };
        auditTrail.push(
          `DEFER → BLOCK: Invalid defer structure: ${deferError}`,
        );
      } else {
        deferValidation = { valid: true };
        auditTrail.push("Defer structure validated successfully.");
      }
    }
  }

  return Object.freeze({
    requestId: request.id,
    timestamp: new Date().toISOString(),
    finalOutcome,
    pairResults: Object.freeze(pairResults),
    deferValidation,
    flaggedForManualReview: anyFlaggedForReview,
    auditTrail: Object.freeze(auditTrail),
  });
}

// ─── Single Pair Evaluation ───────────────────────────────────────────────────

function evaluatePair(
  pair: ChangeRequestPair,
  barriers: BarrierSnapshot,
  auditTrail: string[],
): PairEvaluationResult {
  const tag = `[${pair.surface} / ${pair.actionType}]`;

  // ── RULE 1: Credential Surface Hard Block ─────────────────────────────────
  if (pair.surface === "dev-build-credential-exposure") {
    auditTrail.push(
      `${tag} Rule 1: dev-build-credential-exposure — unconditional BLOCK. ` +
        "No action type is valid on this surface.",
    );
    return buildPairResult(pair, "BLOCK", INVALID, auditTrail, {
      applied: false,
      finalOutcome: "BLOCK",
      anchoringDivergenceDetected: false,
      flaggedForManualReview: false,
      reason: "Rule 1: Credential surface hard block.",
    });
  }

  // ── Matrix lookup ─────────────────────────────────────────────────────────
  const matrixEntry = lookupBlastRadius(pair.surface, pair.actionType);

  if (matrixEntry === INVALID) {
    auditTrail.push(
      `${tag} Invalid (Surface, ActionType) combination — entire ChangeRequest is BLOCK.`,
    );
    return buildPairResult(pair, "BLOCK", INVALID, auditTrail, {
      applied: false,
      finalOutcome: "BLOCK",
      anchoringDivergenceDetected: false,
      flaggedForManualReview: false,
      reason: "Invalid (Surface, ActionType) combination.",
    });
  }

  const blastRadius = matrixEntry;
  auditTrail.push(`${tag} Matrix blast radius: ${blastRadius}`);

  // ── RULE 2: Critical Blast Radius → DEFER ─────────────────────────────────
  // ── RULE 3: High Blast Radius → surface-specific ceiling ──────────────────
  // ── RULE 4: Medium Blast Radius → ALLOW_SANDBOX ───────────────────────────
  // ── RULE 5: Low Blast Radius → ALLOW_RUNTIME ──────────────────────────────
  const blastRadiusOutcome = blastRadiusToCeiling(blastRadius, pair.surface);
  auditTrail.push(`${tag} Blast radius ceiling: ${blastRadiusOutcome}`);

  // ── Barrier Verification ──────────────────────────────────────────────────
  const barrierResult = verifyBarriers(blastRadiusOutcome, barriers);
  if (barrierResult.demoted) {
    auditTrail.push(
      `${tag} Barrier demotion: ${blastRadiusOutcome} → ${barrierResult.verifiedOutcome}. ` +
        `Inactive barriers: ${barrierResult.inactiveBarriers.map((b) => b.id).join(", ")}`,
    );
  }
  const postBarrierOutcome = barrierResult.verifiedOutcome;

  // ── Mythos-Class Re-price ─────────────────────────────────────────────────
  let repricingDetails: PairEvaluationResult["repricing"];

  if (pair.repricedLevel !== undefined && pair.advisory !== undefined) {
    const repricingInput: RepricingInput = {
      advisory: pair.advisory,
      matrixBlastRadius: blastRadius,
      outcomeCeiling: postBarrierOutcome,
      repricedLevel: pair.repricedLevel,
      rationale: pair.repricingRationale ?? "No rationale provided.",
    };
    const repricingResult = applyRepricing(repricingInput);
    auditTrail.push(`${tag} Re-price: ${repricingResult.reason}`);

    repricingDetails = {
      applied: repricingResult.downgraded,
      finalOutcome: repricingResult.finalOutcome,
      anchoringDivergenceDetected: repricingResult.anchoringDivergenceDetected,
      flaggedForManualReview: repricingResult.flaggedForManualReview,
      reason: repricingResult.reason,
    };
  } else {
    repricingDetails = {
      applied: false,
      finalOutcome: postBarrierOutcome,
      anchoringDivergenceDetected: false,
      flaggedForManualReview: false,
      reason: "No re-price data provided — outcome unchanged.",
    };
  }

  const pairOutcome = repricingDetails.finalOutcome;
  auditTrail.push(`${tag} Pair outcome: ${pairOutcome}`);

  return {
    surface: pair.surface,
    actionType: pair.actionType,
    matrixBlastRadius: blastRadius,
    blastRadiusOutcome,
    barrierVerification: {
      verifiedOutcome: barrierResult.verifiedOutcome,
      inactiveBarriers: barrierResult.inactiveBarriers.map((b) => b.id),
      demoted: barrierResult.demoted,
    },
    repricing: repricingDetails,
    pairOutcome,
  };
}

/** Apply blast radius rules 2–5. Returns the outcome ceiling. */
function blastRadiusToCeiling(
  level: BlastRadiusLevel,
  surface: Surface,
): Outcome {
  switch (level) {
    // Rule 2: Critical → DEFER
    case "critical":
      return "DEFER";

    // Rule 3: High → surface-specific
    case "high":
      if (surface === "runtime") return "ALLOW_STAGING";
      return "ALLOW_SANDBOX"; // all non-runtime surfaces

    // Rule 4: Medium → ALLOW_SANDBOX
    case "medium":
      return "ALLOW_SANDBOX";

    // Rule 5: Low → ALLOW_RUNTIME
    case "low":
      return "ALLOW_RUNTIME";
  }
}

function buildPairResult(
  pair: ChangeRequestPair,
  outcome: Outcome,
  matrixBlastRadius: BlastRadiusLevel | typeof INVALID,
  _auditTrail: string[],
  repricing: PairEvaluationResult["repricing"],
): PairEvaluationResult {
  return {
    surface: pair.surface,
    actionType: pair.actionType,
    matrixBlastRadius,
    blastRadiusOutcome: outcome,
    barrierVerification: {
      verifiedOutcome: outcome,
      inactiveBarriers: [],
      demoted: false,
    },
    repricing,
    pairOutcome: outcome,
  };
}
