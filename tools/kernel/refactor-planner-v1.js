#!/usr/bin/env node

import { Project } from "ts-morph";
import path from "path";

const ROOT = process.cwd();

console.log("[REF-PLANNER-v1.1] initializing safe refactor planner...");

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
});

// -----------------------------
// ENTRYPOINT DETECTION (FIXED)
// -----------------------------
function isEntryPoint(filePath) {
  const entryPatterns = [
    "index.ts",
    "index.js",
    "main.ts",
    "main.js",
    "server.ts",
    "app.ts",
    "cli.ts",
    "worker.ts",
  ];

  return entryPatterns.some((p) => filePath.endsWith(p));
}

// -----------------------------
// CONFIG / SYSTEM FILE DETECTION
// -----------------------------
function isProtected(filePath) {
  return (
    filePath.includes("config") ||
    filePath.includes("vite") ||
    filePath.includes("jest") ||
    filePath.includes("tsconfig") ||
    isEntryPoint(filePath)
  );
}

// -----------------------------
// BARREL FILE DETECTION (NEW)
// -----------------------------
function isBarrelFile(file) {
  const path = file.getFilePath();
  return path.endsWith("index.ts") && file.getExportedDeclarations().size > 0;
}

// -----------------------------
// REVERSE DEPENDENCY GRAPH
// -----------------------------
const reverse = new Map();

function addReverse(from, to) {
  if (!reverse.has(to)) reverse.set(to, new Set());
  reverse.get(to).add(from);
}

// -----------------------------
// BUILD REVERSE GRAPH
// -----------------------------
for (const file of project.getSourceFiles()) {
  const filePath = file.getFilePath();

  for (const imp of file.getImportDeclarations()) {
    const resolved = imp.getModuleSpecifierSourceFile();
    if (resolved) {
      addReverse(filePath, resolved.getFilePath());
    }
  }
}

// -----------------------------
// TRANSITIVE SIMULATION (FIXED)
// -----------------------------
function simulateRemoval(target) {
  const impacted = new Set();
  const queue = [target];

  while (queue.length) {
    const current = queue.pop();

    for (const [file, deps] of reverse.entries()) {
      if (deps.has(current) && !impacted.has(file)) {
        impacted.add(file);
        queue.push(file);
      }
    }
  }

  return [...impacted];
}

// -----------------------------
// ANALYSIS
// -----------------------------
const candidates = [];

for (const file of project.getSourceFiles()) {
  const filePath = file.getFilePath();

  if (isProtected(filePath)) continue;

  const imports = file.getImportDeclarations().length;
  const exports = file.getExportedDeclarations().size;
  const rev = reverse.get(filePath)?.size || 0;

  // -----------------------------
  // DYNAMIC IMPORT DETECTION (FIXED)
  // -----------------------------
  const hasDynamicImport =
    file.getText().includes("import(") || file.getText().includes("require(");

  // -----------------------------
  // DEAD SCORE MODEL (IMPROVED)
  // -----------------------------
  let deadScore = 0;

  if (imports === 0) deadScore += 35;
  if (rev === 0) deadScore += 40;
  if (exports === 0) deadScore += 10;
  if (hasDynamicImport) deadScore -= 60;
  if (isBarrelFile(file)) deadScore -= 50;

  deadScore = Math.max(0, Math.min(100, deadScore));

  candidates.push({
    file: filePath,
    deadScore,
    imports,
    exports,
    rev,
  });
}

// -----------------------------
// SAFE SIMULATION REPORT
// -----------------------------
function simulateRemovalImpact(filePath) {
  return simulateRemoval(filePath);
}

// -----------------------------
// GENERATE PLANS
// -----------------------------
const plans = [];

for (const c of candidates) {
  const impact = simulateRemovalImpact(c.file);

  const safeToRemove = c.deadScore >= 80 && impact.length === 0 && c.rev === 0;

  plans.push({
    file: c.file,
    deadScore: c.deadScore,
    safeToRemove,
    impactedFiles: impact,
  });
}

// -----------------------------
// OUTPUT
// -----------------------------
plans.sort((a, b) => b.deadScore - a.deadScore);

console.log("\n[REF-PLANNER-v1.1] REFACTOR ANALYSIS REPORT:\n");

for (const p of plans.slice(0, 40)) {
  console.log(`FILE: ${p.file}`);
  console.log(`  deadScore: ${p.deadScore}`);
  console.log(`  safeToRemove: ${p.safeToRemove}`);
  console.log(`  impacted: ${p.impactedFiles.length}`);
  console.log("------------------------------------------------");
}

console.log("\n[REF-PLANNER-v1.1] COMPLETE (NO FILE MODIFICATIONS)");
