#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const SIM_BRANCH_PREFIX = "sim/refactor";

console.log("[PR-APPROVAL] initializing intelligence gate...");

// -----------------------------
// SAFE GIT WRAPPER
// -----------------------------
function git(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

// -----------------------------
// RISK SCORING ENGINE
// -----------------------------
function scoreRisk() {
  let score = 100;

  const diff = git("git diff --name-only");

  if (diff.includes("package.json")) score -= 40;
  if (diff.includes("tsconfig")) score -= 30;
  if (diff.includes("node_modules")) score -= 100;
  if (diff.length > 50) score -= 20;

  return Math.max(0, score);
}

// -----------------------------
// CI VALIDATION
// -----------------------------
function runCI() {
  try {
    console.log("[CI] typecheck...");
    execSync("pnpm typecheck", { stdio: "inherit" });

    console.log("[CI] build...");
    execSync("pnpm build", { stdio: "inherit" });

    return true;
  } catch (e) {
    return false;
  }
}

// -----------------------------
// ROLLBACK ENGINE
// -----------------------------
function rollback(branch) {
  console.log("[ROLLBACK] restoring previous state...");

  try {
    git(`git checkout main`);
    git(`git branch -D ${branch}`);
  } catch (e) {
    console.error("[ROLLBACK] failed cleanup:", e.message);
  }
}

// -----------------------------
// MAIN FLOW
// -----------------------------
const branch = git("git rev-parse --abbrev-ref HEAD");

console.log(`[PR-APPROVAL] branch: ${branch}`);

const risk = scoreRisk();
console.log(`[PR-APPROVAL] risk score: ${risk}`);

const ciPass = runCI();

let decision = "REJECTED";

if (ciPass && risk >= 80) {
  decision = "APPROVED";
} else if (ciPass && risk >= 60) {
  decision = "NEEDS_REVIEW";
} else {
  decision = "REJECTED";
}

// -----------------------------
// AUTO ROLLBACK CONDITION
// -----------------------------
if (!ciPass || risk < 60) {
  rollback(branch);
}

// -----------------------------
// OUTPUT REPORT
// -----------------------------
const report = `
# PR AUTONOMOUS REVIEW REPORT

## Branch
${branch}

## Risk Score
${risk}

## CI Status
${ciPass ? "PASS" : "FAIL"}

## Decision
${decision}

## Action
${
  decision === "APPROVED"
    ? "SAFE TO MERGE (manual confirmation required)"
    : "BLOCKED / ROLLED BACK"
}
`;

fs.writeFileSync(path.join(ROOT, "PR_APPROVAL_REPORT.md"), report);

console.log("\n[PR-APPROVAL] COMPLETE");
console.log(`decision: ${decision}`);
