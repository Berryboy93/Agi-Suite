/**
 * Mythos v5 — Barrier Systems
 *
 * Spec: "Only cryptographic, sandbox, or hard-isolation controls are considered
 *        security boundaries."
 *       "Friction systems are never used as security barriers."
 *
 * The 5 spec-defined barriers:
 *   cryptographicAuth          — ALLOW_RUNTIME, ALLOW_STAGING
 *   credentialVaultIsolation   — ALLOW_RUNTIME, ALLOW_STAGING
 *   paymentIsolation           — ALLOW_RUNTIME, ALLOW_STAGING
 *   sandboxExecution           — ALLOW_SANDBOX
 *   productionDeploymentGate   — ALLOW_RUNTIME only
 *
 * Barrier health checks are OUT-OF-BAND from the governance engine and must
 * be provided by the underlying infrastructure. The engine only verifies
 * reported status — it never performs health checks itself.
 */

import type { Outcome } from "./outcomes.js";

// ─── Barrier Identifiers ──────────────────────────────────────────────────────

export const BARRIER_IDS = [
  "cryptographicAuth",
  "credentialVaultIsolation",
  "paymentIsolation",
  "sandboxExecution",
  "productionDeploymentGate",
] as const;

export type BarrierId = (typeof BARRIER_IDS)[number];

/** The active-state definition for each barrier (from spec). */
export const BARRIER_ACTIVE_STATE_DEFINITIONS: Record<BarrierId, string> = {
  cryptographicAuth:
    "Identity verification system reports healthy and all required signatures are valid",
  credentialVaultIsolation:
    "Vault reports sealed status; no credential material accessible from build environment",
  paymentIsolation:
    "Payment network segmentation confirmed; no payment system interfaces reachable from build/staging",
  sandboxExecution:
    "Sandbox reports enforced boundary; process cannot escape via namespace, seccomp, or hardware isolation",
  productionDeploymentGate:
    "Deployment gate reports passable; all required approvals and checks satisfied",
};

// ─── Barrier State ────────────────────────────────────────────────────────────

export interface BarrierState {
  readonly id: BarrierId;
  readonly active: boolean;
  /** Timestamp of last health check. ISO-8601. */
  readonly checkedAt: string;
  /** Human-readable reason if inactive. */
  readonly reason?: string;
}

export type BarrierSnapshot = Record<BarrierId, BarrierState>;

// ─── Required Barriers Per Outcome ───────────────────────────────────────────

/** Per spec barrier requirements table. */
export const REQUIRED_BARRIERS: Record<Outcome, readonly BarrierId[]> = {
  ALLOW_RUNTIME: Object.freeze([
    "cryptographicAuth",
    "credentialVaultIsolation",
    "paymentIsolation",
    "productionDeploymentGate",
  ]),
  ALLOW_STAGING: Object.freeze([
    "cryptographicAuth",
    "credentialVaultIsolation",
    "paymentIsolation",
  ]),
  ALLOW_SANDBOX: Object.freeze(["sandboxExecution"]),
  DEFER: Object.freeze([]), // No barrier requirements for DEFER
  BLOCK: Object.freeze([]), // No barriers needed — immediate termination
};

// ─── Barrier Verification ─────────────────────────────────────────────────────

export interface BarrierVerificationResult {
  /** The outcome as verified against active barriers. May be demoted. */
  readonly verifiedOutcome: Outcome;
  /** Barriers that were required but inactive. */
  readonly inactiveBarriers: readonly BarrierState[];
  /** Whether the outcome was demoted from the input outcome. */
  readonly demoted: boolean;
}

/**
 * Verify that all barriers required for `desiredOutcome` are active.
 *
 * Demotion rules (per spec):
 *   ALLOW_RUNTIME  → any required barrier inactive → BLOCK
 *   ALLOW_STAGING  → any required barrier inactive → ALLOW_SANDBOX (if sandboxExecution active) or BLOCK
 *   ALLOW_SANDBOX  → sandboxExecution inactive → BLOCK
 *   DEFER / BLOCK  → no barriers required, no demotion
 */
export function verifyBarriers(
  desiredOutcome: Outcome,
  barriers: BarrierSnapshot,
): BarrierVerificationResult {
  const required = REQUIRED_BARRIERS[desiredOutcome];

  if (required.length === 0) {
    return {
      verifiedOutcome: desiredOutcome,
      inactiveBarriers: [],
      demoted: false,
    };
  }

  const inactive = required
    .map((id) => barriers[id])
    .filter((b): b is BarrierState => !b.active);

  if (inactive.length === 0) {
    return {
      verifiedOutcome: desiredOutcome,
      inactiveBarriers: [],
      demoted: false,
    };
  }

  // Demotion logic
  let demotedOutcome: Outcome;

  if (desiredOutcome === "ALLOW_RUNTIME") {
    demotedOutcome = "BLOCK";
  } else if (desiredOutcome === "ALLOW_STAGING") {
    // Demote to ALLOW_SANDBOX if sandboxExecution is active, else BLOCK
    demotedOutcome = barriers.sandboxExecution.active
      ? "ALLOW_SANDBOX"
      : "BLOCK";
  } else if (desiredOutcome === "ALLOW_SANDBOX") {
    demotedOutcome = "BLOCK";
  } else {
    demotedOutcome = desiredOutcome;
  }

  return {
    verifiedOutcome: demotedOutcome,
    inactiveBarriers: Object.freeze(inactive),
    demoted: true,
  };
}
