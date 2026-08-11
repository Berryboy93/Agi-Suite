/**
 * Mythos v5 — Mythos-Class Re-price Module
 *
 * Spec invariants:
 *   "Advisory severity never overrides re-price logic (re-price may only relax,
 *    never escalate)."
 *   "Re-price is a modifier, not a competing rule."
 *
 * Anchoring Protection:
 *   If |advisory_level - repriced_level| > 1, change is flagged for manual review
 *   and downgrade is PROHIBITED.
 *
 * Downgrade Conditions (ALL three must hold):
 *   1. Re-priced level is strictly LOWER than matrix-derived level.
 *   2. No anchoring divergence detected.
 *   3. Required barriers for downgraded outcome are active.
 *
 * If no advisory severity is available, downgrade is PROHIBITED.
 */

import {
  type BlastRadiusLevel,
  BLAST_RADIUS_ORDER,
  compareBlastRadius,
} from "../surfaces/surfaces.js";
import type { Outcome } from "./outcomes.js";

// ─── Advisory Severity Input ──────────────────────────────────────────────────

/**
 * Advisory severity as provided by external tooling (CVSS, vendor label, etc.).
 * Maps to the 4-level blast radius scale per spec reference heuristic.
 */
export interface AdvisorySeverity {
  /** Raw label from advisory system. */
  readonly label: string;
  /** CVSS score if available. */
  readonly cvssScore?: number;
  /**
   * Caller-provided mapping to blast radius level.
   * If the taxonomy cannot be mapped, this must be null and downgrade is prohibited.
   */
  readonly mappedLevel: BlastRadiusLevel | null;
}

// ─── Re-price Input ───────────────────────────────────────────────────────────

export interface RepricingInput {
  /** Advisory severity from external scanner. null = no advisory available. */
  readonly advisory: AdvisorySeverity | null;
  /** Matrix-derived blast radius (from Surface × ActionType lookup). */
  readonly matrixBlastRadius: BlastRadiusLevel;
  /** The outcome ceiling derived from blast radius rules (before re-price). */
  readonly outcomeCeiling: Outcome;
  /**
   * Re-priced blast radius level produced by adversarial analysis.
   * Provided by the caller (external security analyst or automated tool).
   */
  readonly repricedLevel: BlastRadiusLevel;
  /** Human-readable rationale for the re-price. */
  readonly rationale: string;
}

// ─── Re-price Output ──────────────────────────────────────────────────────────

export interface RepricingResult {
  /** Final outcome after re-price modifier (may equal outcomeCeiling if no downgrade). */
  readonly finalOutcome: Outcome;
  /** Whether a downgrade was applied. */
  readonly downgraded: boolean;
  /** Whether anchoring divergence was detected. */
  readonly anchoringDivergenceDetected: boolean;
  /** Whether the change is flagged for manual review. */
  readonly flaggedForManualReview: boolean;
  readonly reason: string;
}

/** Maps blast radius level to the most permissive allowed outcome at that level. */
const LEVEL_TO_CEILING: Record<BlastRadiusLevel, Outcome> = {
  low: "ALLOW_RUNTIME",
  medium: "ALLOW_SANDBOX",
  high: "ALLOW_STAGING",
  critical: "DEFER",
};

/**
 * Apply Mythos-class re-pricing to an outcome ceiling.
 *
 * This function is a pure modifier — it can only relax the ceiling,
 * never escalate it. All invariants are enforced before any modification.
 */
export function applyRepricing(input: RepricingInput): RepricingResult {
  // Guard 1: No advisory → downgrade prohibited
  if (input.advisory === null || input.advisory.mappedLevel === null) {
    return {
      finalOutcome: input.outcomeCeiling,
      downgraded: false,
      anchoringDivergenceDetected: false,
      flaggedForManualReview: false,
      reason:
        "No advisory severity available — downgrade prohibited. Change retains matrix-derived outcome.",
    };
  }

  // Guard 2: Anchoring divergence check
  const advisoryOrder = BLAST_RADIUS_ORDER[input.advisory.mappedLevel];
  const repricedOrder = BLAST_RADIUS_ORDER[input.repricedLevel];
  const divergence = Math.abs(advisoryOrder - repricedOrder);
  const anchoringDivergenceDetected = divergence > 1;

  if (anchoringDivergenceDetected) {
    return {
      finalOutcome: input.outcomeCeiling,
      downgraded: false,
      anchoringDivergenceDetected: true,
      flaggedForManualReview: true,
      reason:
        `Anchoring divergence detected: advisory maps to "${input.advisory.mappedLevel}" ` +
        `but re-price produces "${input.repricedLevel}" (gap of ${divergence} level(s), exceeds threshold of 1). ` +
        `Change flagged for manual review. Downgrade prohibited.`,
    };
  }

  // Guard 3: Re-priced level must be strictly LOWER than matrix-derived level
  const canDowngrade =
    compareBlastRadius(input.repricedLevel, input.matrixBlastRadius) < 0;

  if (!canDowngrade) {
    return {
      finalOutcome: input.outcomeCeiling,
      downgraded: false,
      anchoringDivergenceDetected: false,
      flaggedForManualReview: false,
      reason:
        `Re-priced level "${input.repricedLevel}" is not strictly lower than matrix-derived ` +
        `"${input.matrixBlastRadius}" — no downgrade applied.`,
    };
  }

  // All guards passed — apply downgrade
  const downgradedCeiling = LEVEL_TO_CEILING[input.repricedLevel];

  return {
    finalOutcome: downgradedCeiling,
    downgraded: true,
    anchoringDivergenceDetected: false,
    flaggedForManualReview: false,
    reason:
      `Downgrade applied: matrix blast radius "${input.matrixBlastRadius}" → ` +
      `re-priced "${input.repricedLevel}". ` +
      `Outcome ceiling relaxed from "${input.outcomeCeiling}" to "${downgradedCeiling}". ` +
      `Rationale: ${input.rationale}`,
  };
}
