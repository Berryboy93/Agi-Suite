import { describe, it, expect } from "vitest";
import {
  evaluateChangeRequest,
  type ChangeRequest,
} from "../src/rules/evaluator.js";
import type { BarrierSnapshot } from "../src/barriers/barriers.js";

// ─── Barrier Snapshots ────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

function makeBarriers(
  overrides: Partial<BarrierSnapshot> = {},
): BarrierSnapshot {
  const base: BarrierSnapshot = {
    cryptographicAuth: {
      id: "cryptographicAuth",
      active: true,
      checkedAt: NOW,
    },
    credentialVaultIsolation: {
      id: "credentialVaultIsolation",
      active: true,
      checkedAt: NOW,
    },
    paymentIsolation: { id: "paymentIsolation", active: true, checkedAt: NOW },
    sandboxExecution: { id: "sandboxExecution", active: true, checkedAt: NOW },
    productionDeploymentGate: {
      id: "productionDeploymentGate",
      active: true,
      checkedAt: NOW,
    },
  };
  return { ...base, ...overrides };
}

const ALL_BARRIERS_ACTIVE = makeBarriers();
const NO_BARRIERS_ACTIVE = makeBarriers({
  cryptographicAuth: {
    id: "cryptographicAuth",
    active: false,
    checkedAt: NOW,
    reason: "test",
  },
  credentialVaultIsolation: {
    id: "credentialVaultIsolation",
    active: false,
    checkedAt: NOW,
    reason: "test",
  },
  paymentIsolation: {
    id: "paymentIsolation",
    active: false,
    checkedAt: NOW,
    reason: "test",
  },
  sandboxExecution: {
    id: "sandboxExecution",
    active: false,
    checkedAt: NOW,
    reason: "test",
  },
  productionDeploymentGate: {
    id: "productionDeploymentGate",
    active: false,
    checkedAt: NOW,
    reason: "test",
  },
});

function makeRequest(
  pairs: ChangeRequest["pairs"],
  defer?: ChangeRequest["defer"],
): ChangeRequest {
  return {
    id: "test-req",
    pairs,
    submittedAt: NOW,
    defer,
  };
}

// ─── Rule 1: Credential Surface Hard Block ────────────────────────────────────

describe("Rule 1 — credential surface hard block", () => {
  it("blocks any action on dev-build-credential-exposure", () => {
    const req = makeRequest([
      { surface: "dev-build-credential-exposure", actionType: "config_change" },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("BLOCK");
  });

  it("BLOCK from Rule 1 cannot be overridden by other pairs", () => {
    const req = makeRequest([
      { surface: "runtime", actionType: "code_change" },
      { surface: "dev-build-credential-exposure", actionType: "deploy" },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("BLOCK");
  });
});

// ─── Rule 2: Critical Blast Radius → DEFER ────────────────────────────────────

describe("Rule 2 — critical blast radius", () => {
  it("runtime + auth_change (critical) → DEFER without valid defer structure", () => {
    const req = makeRequest([
      { surface: "runtime", actionType: "auth_change" },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    // DEFER without defer structure → BLOCK per defer policy
    expect(result.finalOutcome).toBe("BLOCK");
    expect(result.deferValidation?.valid).toBe(false);
  });

  it("runtime + auth_change with valid defer structure → DEFER", () => {
    const req = makeRequest(
      [{ surface: "runtime", actionType: "auth_change" }],
      {
        owner: "security-team",
        trigger: "Security audit completion on 2026-07-01",
        interimControl:
          "JWT tokens rotated, MFA enforced on all admin accounts",
      },
    );
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("DEFER");
    expect(result.deferValidation?.valid).toBe(true);
  });

  it("vague defer trigger → BLOCK", () => {
    const req = makeRequest(
      [{ surface: "runtime", actionType: "payment_change" }],
      {
        owner: "team",
        trigger: "when reviewed",
        interimControl: "none",
      },
    );
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("BLOCK");
  });
});

// ─── Rule 3: High Blast Radius ────────────────────────────────────────────────

describe("Rule 3 — high blast radius", () => {
  it("runtime + deploy (high) + all barriers active → ALLOW_STAGING", () => {
    const req = makeRequest([{ surface: "runtime", actionType: "deploy" }]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("ALLOW_STAGING");
  });

  it("supply-chain + dependency_update (high) → ALLOW_SANDBOX", () => {
    const req = makeRequest([
      { surface: "dev-build-supply-chain", actionType: "dependency_update" },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("ALLOW_SANDBOX");
  });
});

// ─── Rule 4: Medium Blast Radius ──────────────────────────────────────────────

describe("Rule 4 — medium blast radius", () => {
  it("runtime + code_change (medium) + sandboxExecution active → ALLOW_SANDBOX", () => {
    const req = makeRequest([
      { surface: "runtime", actionType: "code_change" },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("ALLOW_SANDBOX");
  });
});

// ─── Rule 5: Low Blast Radius ─────────────────────────────────────────────────

describe("Rule 5 — low blast radius", () => {
  it("dev-build-isolated + code_change (low) + all barriers active → ALLOW_RUNTIME", () => {
    const req = makeRequest([
      { surface: "dev-build-isolated", actionType: "code_change" },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("ALLOW_RUNTIME");
  });
});

// ─── Barrier Demotion ─────────────────────────────────────────────────────────

describe("Barrier verification — demotion", () => {
  it("ALLOW_RUNTIME demoted to BLOCK when productionDeploymentGate inactive", () => {
    const barriers = makeBarriers({
      productionDeploymentGate: {
        id: "productionDeploymentGate",
        active: false,
        checkedAt: NOW,
        reason: "Gate not configured",
      },
    });
    const req = makeRequest([
      { surface: "dev-build-isolated", actionType: "code_change" },
    ]);
    const result = evaluateChangeRequest(req, barriers);
    expect(result.finalOutcome).toBe("BLOCK");
  });

  it("ALLOW_STAGING demoted to ALLOW_SANDBOX when staging barriers missing but sandbox active", () => {
    const barriers = makeBarriers({
      cryptographicAuth: {
        id: "cryptographicAuth",
        active: false,
        checkedAt: NOW,
      },
    });
    const req = makeRequest([{ surface: "runtime", actionType: "deploy" }]);
    const result = evaluateChangeRequest(req, barriers);
    expect(result.finalOutcome).toBe("ALLOW_SANDBOX");
  });
});

// ─── Compound ChangeRequest ───────────────────────────────────────────────────

describe("Compound ChangeRequest — most restrictive wins", () => {
  it("low + high → result is the high restriction (ALLOW_SANDBOX)", () => {
    const req = makeRequest([
      { surface: "dev-build-isolated", actionType: "code_change" },
      { surface: "dev-build-supply-chain", actionType: "dependency_update" },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("ALLOW_SANDBOX");
  });

  it("any INVALID pair → entire request BLOCK", () => {
    const req = makeRequest([
      { surface: "dev-build-isolated", actionType: "code_change" },
      { surface: "dev-build-supply-chain", actionType: "auth_change" }, // INVALID
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.finalOutcome).toBe("BLOCK");
  });
});

// ─── Re-pricing ───────────────────────────────────────────────────────────────

describe("Mythos-class re-pricing", () => {
  it("valid downgrade applied when re-priced level is strictly lower", () => {
    const req = makeRequest([
      {
        surface: "runtime",
        actionType: "deploy", // high → ALLOW_STAGING
        advisory: { label: "high", cvssScore: 7.5, mappedLevel: "high" },
        repricedLevel: "medium",
        repricingRationale:
          "Scope limited to static asset only; no runtime code path affected",
      },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    // medium re-price on runtime → ALLOW_SANDBOX (Rule 4), barriers allow sandbox
    expect(result.finalOutcome).toBe("ALLOW_SANDBOX");
    expect(result.pairResults[0]!.repricing.applied).toBe(true);
  });

  it("anchoring divergence blocks downgrade and flags for review", () => {
    const req = makeRequest([
      {
        surface: "runtime",
        actionType: "deploy", // high → ALLOW_STAGING
        advisory: {
          label: "critical",
          cvssScore: 9.8,
          mappedLevel: "critical",
        },
        repricedLevel: "low", // gap of 3 levels — exceeds threshold
        repricingRationale: "Attempting suspicious downgrade",
      },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.pairResults[0]!.repricing.anchoringDivergenceDetected).toBe(
      true,
    );
    expect(result.flaggedForManualReview).toBe(true);
    expect(result.pairResults[0]!.repricing.applied).toBe(false);
  });

  it("no advisory → downgrade prohibited, outcome unchanged", () => {
    const req = makeRequest([
      {
        surface: "runtime",
        actionType: "code_change",
        repricedLevel: "low",
        repricingRationale: "Should not apply without advisory",
      },
    ]);
    const result = evaluateChangeRequest(req, ALL_BARRIERS_ACTIVE);
    expect(result.pairResults[0]!.repricing.applied).toBe(false);
  });
});
