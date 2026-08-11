/**
 * Mythos v5 — Decision Outcomes
 *
 * Spec precedence (most → least restrictive):
 *   BLOCK > DEFER > ALLOW_SANDBOX > ALLOW_STAGING > ALLOW_RUNTIME
 *
 * A BLOCK outcome is permanent — cannot be promoted, deferred, or overridden.
 */

export const OUTCOMES = [
  "ALLOW_RUNTIME",
  "ALLOW_STAGING",
  "ALLOW_SANDBOX",
  "DEFER",
  "BLOCK",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

/** Higher number = more restrictive. Used for compound request resolution. */
export const OUTCOME_RESTRICTIVENESS: Record<Outcome, number> = {
  ALLOW_RUNTIME: 0,
  ALLOW_STAGING: 1,
  ALLOW_SANDBOX: 2,
  DEFER: 3,
  BLOCK: 4,
};

/**
 * Returns the more restrictive of two outcomes.
 * Used when resolving compound ChangeRequests (most restrictive wins).
 */
export function mostRestrictive(a: Outcome, b: Outcome): Outcome {
  return OUTCOME_RESTRICTIVENESS[a] >= OUTCOME_RESTRICTIVENESS[b] ? a : b;
}

/** Valid defer structure per Defer Policy. */
export interface DeferStructure {
  /** Accountable party — individual or team identifier. */
  readonly owner: string;
  /**
   * Concrete event condition, explicit date, or measurable state change.
   * Vague triggers (e.g. "when reviewed") are REJECTED.
   */
  readonly trigger: string;
  /** Compensating control active during deferral. */
  readonly interimControl: string;
}

/**
 * Validate a defer structure per spec.
 * Returns an error message if invalid, null if valid.
 */
export function validateDeferStructure(defer: DeferStructure): string | null {
  if (!defer.owner.trim()) {
    return "Defer owner must be a non-empty accountable party identifier.";
  }

  if (!defer.trigger.trim()) {
    return "Defer trigger must be non-empty.";
  }

  // Reject vague triggers
  const VAGUE_PATTERNS = [
    /^when\s+reviewed?$/i,
    /^later$/i,
    /^tbd$/i,
    /^to\s+be\s+determined$/i,
    /^eventually$/i,
    /^soon$/i,
  ];
  for (const pattern of VAGUE_PATTERNS) {
    if (pattern.test(defer.trigger.trim())) {
      return `Defer trigger "${defer.trigger}" is vague. Must be a specific verifiable condition, date, or state change.`;
    }
  }

  if (!defer.interimControl.trim()) {
    return "Defer interim control must describe the compensating control active during deferral.";
  }

  return null;
}
