#!/usr/bin/env node
/**
 * R3 Governance CLI
 *
 * Usage:
 *   r3-governance --root <path> [--tsconfig <path>] [--barriers <json-file>] [--out <json-file>]
 *
 * Exit codes:
 *   0  All findings result in ALLOW_RUNTIME or ALLOW_STAGING
 *   1  One or more findings result in BLOCK or DEFER
 *   2  CLI argument error
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runWire, serializeReport } from "@r3vibe/asi-wire";
import { evaluateChangeRequest, type BarrierSnapshot } from "@r3vibe/mythos";
import { wireToChangeRequest, generateRequestId } from "./adapter.js";

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

interface CLIArgs {
  root: string;
  tsconfig?: string;
  barriers?: string;
  out?: string;
}

function parseArgs(argv: string[]): CLIArgs | { error: string } {
  const args: Partial<CLIArgs> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--root" && argv[i + 1]) {
      args.root = argv[++i]!;
    } else if (arg === "--tsconfig" && argv[i + 1]) {
      args.tsconfig = argv[++i]!;
    } else if (arg === "--barriers" && argv[i + 1]) {
      args.barriers = argv[++i]!;
    } else if (arg === "--out" && argv[i + 1]) {
      args.out = argv[++i]!;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  if (!args.root && positional[0]) {
    args.root = positional[0];
  }

  if (!args.root) {
    return { error: "Missing required argument: --root <project-path>" };
  }

  return args as CLIArgs;
}

// ─── Default Barrier Snapshot ─────────────────────────────────────────────────
// All barriers default to INACTIVE in the absence of infrastructure confirmation.
// This is the conservative safe-fail posture.

function defaultBarrierSnapshot(): BarrierSnapshot {
  const now = new Date().toISOString();
  return {
    cryptographicAuth: {
      id: "cryptographicAuth",
      active: false,
      checkedAt: now,
      reason:
        "No infrastructure health check provided — defaulting to inactive (safe-fail)",
    },
    credentialVaultIsolation: {
      id: "credentialVaultIsolation",
      active: false,
      checkedAt: now,
      reason:
        "No infrastructure health check provided — defaulting to inactive (safe-fail)",
    },
    paymentIsolation: {
      id: "paymentIsolation",
      active: false,
      checkedAt: now,
      reason:
        "No infrastructure health check provided — defaulting to inactive (safe-fail)",
    },
    sandboxExecution: {
      id: "sandboxExecution",
      active: false,
      checkedAt: now,
      reason:
        "No infrastructure health check provided — defaulting to inactive (safe-fail)",
    },
    productionDeploymentGate: {
      id: "productionDeploymentGate",
      active: false,
      checkedAt: now,
      reason:
        "No infrastructure health check provided — defaulting to inactive (safe-fail)",
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);

  if ("error" in parsed) {
    console.error(`[r3-governance] Error: ${parsed.error}`);
    process.exit(2);
  }

  const root = resolve(parsed.root);
  console.error(`[r3-governance] Scanning: ${root}`);

  // ── Phase 1: Run ASI WIRE v4 pipeline ────────────────────────────────────
  console.error("[r3-governance] Phase 1: ASI WIRE v4 analysis...");
  const wireReport = await runWire({
    root,
    tsConfigFilePath: parsed.tsconfig ? resolve(parsed.tsconfig) : undefined,
  });

  console.error(
    `[r3-governance] WIRE: ${wireReport.metrics.files} files, ` +
      `${wireReport.metrics.violations} violations, ` +
      `integrity=${wireReport.integrity}`,
  );

  // ── Phase 2: Load barrier snapshot ──────────────────────────────────────
  let barriers: BarrierSnapshot = defaultBarrierSnapshot();

  if (parsed.barriers) {
    try {
      const raw = await readFile(resolve(parsed.barriers), "utf-8");
      barriers = JSON.parse(raw) as BarrierSnapshot;
      console.error(
        `[r3-governance] Loaded barrier snapshot from: ${parsed.barriers}`,
      );
    } catch (err) {
      console.error(
        `[r3-governance] Warning: Could not load barrier snapshot (${err}). ` +
          "Using safe-fail defaults (all barriers inactive).",
      );
    }
  }

  // ── Phase 3: Adapt WIRE findings → Mythos ChangeRequest ─────────────────
  console.error("[r3-governance] Phase 2: Mythos v5 evaluation...");
  const requestId = generateRequestId(wireReport.findings.length);
  const changeRequest = wireToChangeRequest(wireReport.findings, requestId);

  // ── Phase 4: Evaluate ChangeRequest ─────────────────────────────────────
  const mythosResult = evaluateChangeRequest(changeRequest, barriers);

  console.error(
    `[r3-governance] Mythos: requestId=${mythosResult.requestId}, ` +
      `finalOutcome=${mythosResult.finalOutcome}, ` +
      `pairs=${mythosResult.pairResults.length}`,
  );

  if (mythosResult.flaggedForManualReview) {
    console.error(
      "[r3-governance] ⚠️  FLAGGED FOR MANUAL REVIEW — anchoring divergence detected.",
    );
  }

  // ── Output ───────────────────────────────────────────────────────────────
  const combinedOutput = {
    wire: JSON.parse(serializeReport(wireReport)),
    mythos: mythosResult,
  };

  const jsonOutput = JSON.stringify(combinedOutput, null, 2);

  if (parsed.out) {
    await writeFile(resolve(parsed.out), jsonOutput, "utf-8");
    console.error(`[r3-governance] Report written to: ${parsed.out}`);
  } else {
    process.stdout.write(jsonOutput + "\n");
  }

  // ── Exit code ────────────────────────────────────────────────────────────
  const outcome = mythosResult.finalOutcome;
  if (outcome === "BLOCK" || outcome === "DEFER") {
    console.error(`[r3-governance] ❌ Exit 1: Outcome is ${outcome}`);
    process.exit(1);
  }

  console.error(
    "[r3-governance] ✅ Exit 0: All pairs within acceptable thresholds.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[r3-governance] Fatal error:", err);
  process.exit(1);
});
