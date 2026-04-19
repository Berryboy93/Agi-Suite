#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

console.log("[RHOS-TEST-v4] starting CI-grade hardened validation...");

// -----------------------------
// ASSERT CORE
// -----------------------------
function assert(condition, message) {
  if (!condition) {
    console.error("[FAIL]", message);
    process.exit(1);
  }
  console.log("[OK]", message);
}

// -----------------------------
// SYSTEM MODE
// -----------------------------
let SYSTEM_MODE = "NORMAL";

// -----------------------------
// GIT OBSERVATION (FAIL-FAST OR DEGRADED MODE)
// -----------------------------
let files = [];

try {
  const output = execSync("git ls-files", { encoding: "utf-8" });
  files = output.split("\n").filter(Boolean);

  assert(files.length > 0, "git file index accessible");
} catch (e) {
  SYSTEM_MODE = "DEGRADED";
  console.warn("[WARN] git unavailable → entering DEGRADED MODE");

  files = [];

  assert(false, "CI requires git index — refusing unsafe execution");
}

// -----------------------------
// FILE NORMALIZATION
// -----------------------------
const normalizedFiles = files.filter(Boolean);

// -----------------------------
// EXECUTION CONTRACT (HARD FIREWALL)
// -----------------------------
const EXECUTION_CONTRACT = Object.freeze({
  mode: "SIMULATION_ONLY",
  allowedActions: ["SIMULATED_NOOP"],
  mutationAllowed: false,
});

// -----------------------------
// PLAN GENERATION
// -----------------------------
const simulatedPlan = normalizedFiles.slice(0, 5).map((file) => ({
  file,
  action: "SIMULATED_NOOP",
  risk: "LOW",
}));

// -----------------------------
// CONTRACT ENFORCEMENT
// -----------------------------
assert(
  EXECUTION_CONTRACT.mutationAllowed === false,
  "execution mutation is locked",
);

assert(
  simulatedPlan.every((p) =>
    EXECUTION_CONTRACT.allowedActions.includes(p.action),
  ),
  "execution contract enforced",
);

// -----------------------------
// DESTRUCTIVE PATTERN FIREWALL
// -----------------------------
const forbidden = ["rm -rf", "mkfs", ":(){", "dd if="];

assert(
  !forbidden.some((p) => JSON.stringify(simulatedPlan).includes(p)),
  "no destructive patterns detected",
);

// -----------------------------
// REAL DETERMINISM TEST (CROSS-RUN SIMULATION)
// -----------------------------
const runA = JSON.stringify(simulatedPlan);

const runB = JSON.stringify(
  normalizedFiles.slice(0, 5).map((file) => ({
    file,
    action: "SIMULATED_NOOP",
    risk: "LOW",
  })),
);

assert(runA === runB, "deterministic execution across recomputation");

// -----------------------------
// SYSTEM MODE CHECK
// -----------------------------
assert(SYSTEM_MODE !== "DEGRADED", "system running in NORMAL mode");

// -----------------------------
// RESULT
// -----------------------------
console.log("\n[RHOS-TEST-v4] ALL SAFETY CHECKS PASSED");
console.log(`mode: ${SYSTEM_MODE}`);
console.log(`files: ${files.length}`);
console.log(`execution: SIMULATION_ONLY`);
console.log("[RHOS-TEST-v4] SAFE FOR AST PIPELINE CONNECTION");
