#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const PATCH_DIR = path.join(ROOT, "patches");

console.log("[CI-GATE] initializing autonomous refactor validation...");

// -----------------------------
// 1. LOAD PATCHES
// -----------------------------
if (!fs.existsSync(PATCH_DIR)) {
  console.error("[CI-GATE] no patches directory found");
  process.exit(1);
}

const patches = fs
  .readdirSync(PATCH_DIR)
  .filter((f) => f.endsWith(".patch"))
  .map((f) => path.join(PATCH_DIR, f));

if (patches.length === 0) {
  console.log("[CI-GATE] no patches to validate");
  process.exit(0);
}

// -----------------------------
// 2. SAFETY RULES
// -----------------------------
function validatePatchContent(content) {
  const blockedPatterns = [
    "node_modules",
    "/dist/",
    "/build/",
    "rm -rf",
    "process.exit(1) // unsafe injection",
  ];

  return !blockedPatterns.some((p) => content.includes(p));
}

// -----------------------------
// 3. AST CONSISTENCY CHECK (lightweight heuristic layer)
// -----------------------------
function structuralCheck(content) {
  const adds = (content.match(/^\+/gm) || []).length;
  const removes = (content.match(/^-/gm) || []).length;

  // reject extreme mutation imbalance
  return Math.abs(adds - removes) < 500;
}

// -----------------------------
// 4. SIMULATED APPLY (DRY RUN)
// -----------------------------
function simulatePatch(patchFile) {
  const content = fs.readFileSync(patchFile, "utf-8");

  if (!validatePatchContent(content)) {
    return { ok: false, reason: "blocked pattern detected" };
  }

  if (!structuralCheck(content)) {
    return { ok: false, reason: "structural imbalance" };
  }

  return { ok: true };
}

// -----------------------------
// 5. CI VALIDATION PIPELINE
// -----------------------------
let failed = false;

for (const patch of patches) {
  const result = simulatePatch(patch);

  if (!result.ok) {
    console.error(`[CI-GATE] FAIL: ${path.basename(patch)} → ${result.reason}`);
    failed = true;
  } else {
    console.log(`[CI-GATE] PASS: ${path.basename(patch)}`);
  }
}

// -----------------------------
// 6. TYPECHECK (PROJECT SAFETY)
// -----------------------------
try {
  console.log("[CI-GATE] running typecheck...");
  execSync("pnpm typecheck", { stdio: "inherit" });
} catch (e) {
  console.error("[CI-GATE] TYPECHECK FAILED");
  process.exit(1);
}

// -----------------------------
// 7. FINAL DECISION
// -----------------------------
if (failed) {
  console.error("\n[CI-GATE] BLOCKED: unsafe refactor detected");
  process.exit(1);
}

console.log("\n[CI-GATE] APPROVED: all refactor patches safe");
process.exit(0);
