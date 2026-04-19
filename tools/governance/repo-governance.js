#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

console.log("[GOVERNANCE] initializing multi-agent kernel...");

// -----------------------------
// SAFE GIT
// -----------------------------
const git = (cmd) => execSync(cmd, { encoding: "utf-8" }).trim();

// -----------------------------
// 1. PLANNER
// -----------------------------
function planner() {
  console.log("[PLANNER] generating refactor intent...");

  const diff = git("git diff --name-only");

  return {
    intent: "AST safe cleanup refactor",
    targets: diff.split("\n").filter(Boolean),
    riskEstimate: diff.length > 10 ? "MEDIUM" : "LOW",
  };
}

// -----------------------------
// 2. CRITIC
// -----------------------------
function critic(plan) {
  console.log("[CRITIC] evaluating plan...");

  const risky = plan.targets.some(
    (t) =>
      t.includes("package.json") ||
      t.includes("tsconfig") ||
      t.includes("node_modules"),
  );

  if (risky) {
    return {
      approved: false,
      reason: "critical config mutation detected",
    };
  }

  if (plan.riskEstimate === "HIGH") {
    return {
      approved: false,
      reason: "risk too high",
    };
  }

  return { approved: true };
}

// -----------------------------
// 3. EXECUTOR
// -----------------------------
function executor(plan) {
  console.log("[EXECUTOR] applying AST-safe simulation...");

  const patches = [];

  for (const file of plan.targets) {
    patches.push({
      file,
      patch: `# simulated AST diff for ${file}`,
    });
  }

  return patches;
}

// -----------------------------
// 4. AUDITOR
// -----------------------------
function auditor(plan, criticResult, patches) {
  console.log("[AUDITOR] final validation...");

  if (!criticResult.approved) {
    return { decision: "REJECT", reason: criticResult.reason };
  }

  if (patches.length === 0) {
    return { decision: "REJECT", reason: "no changes generated" };
  }

  return {
    decision: "APPROVE",
    reason: "all governance checks passed",
  };
}

// -----------------------------
// ROLLBACK
// -----------------------------
function rollback() {
  console.log("[ROLLBACK] restoring repo state...");
  try {
    git("git checkout .");
  } catch (e) {
    console.error("[ROLLBACK FAILED]");
  }
}

// -----------------------------
// PIPELINE
// -----------------------------
const plan = planner();
const criticResult = critic(plan);

const patches = criticResult.approved ? executor(plan) : [];

const result = auditor(plan, criticResult, patches);

// -----------------------------
// DECISION ENGINE
// -----------------------------
console.log("\n[GOVERNANCE RESULT]");
console.log(result);

if (result.decision === "REJECT") {
  rollback();
  process.exit(1);
}

if (result.decision === "APPROVE") {
  fs.writeFileSync(
    path.join(ROOT, "GOVERNANCE_REPORT.json"),
    JSON.stringify({ plan, result, patches }, null, 2),
  );
}

console.log("[GOVERNANCE] COMPLETE");
