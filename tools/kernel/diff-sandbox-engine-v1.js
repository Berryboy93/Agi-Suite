#!/usr/bin/env node

import { Project } from "ts-morph";
import path from "path";

const ROOT = process.cwd();

console.log(
  "[DIFF-SANDBOX-v2] initializing improved safe refactor simulation...",
);

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
});

// -----------------------------
// NORMALIZATION (FIXED)
// -----------------------------
const normalizePath = (p) => p.replace(/\\/g, "/");

// -----------------------------
// ENTRYPOINT PROTECTION
// -----------------------------
function isEntryPoint(filePath) {
  return (
    filePath.endsWith("index.ts") ||
    filePath.endsWith("index.js") ||
    filePath.endsWith("main.ts") ||
    filePath.endsWith("main.js") ||
    filePath.endsWith("app.ts") ||
    filePath.endsWith("server.ts")
  );
}

// -----------------------------
// PROTECTED FILES
// -----------------------------
function isProtected(filePath) {
  return (
    filePath.includes("node_modules") ||
    filePath.includes(".d.ts") ||
    filePath.includes("config") ||
    filePath.includes("vite") ||
    filePath.includes("tsconfig") ||
    isEntryPoint(filePath)
  );
}

// -----------------------------
// DEPENDENCY GRAPH (CORRECTED MODEL)
// dependent -> dependency
// -----------------------------
const graph = new Map();

function addDependency(dependent, dependency) {
  dependent = normalizePath(dependent);
  dependency = normalizePath(dependency);

  if (!graph.has(dependency)) graph.set(dependency, new Set());
  graph.get(dependency).add(dependent);
}

// -----------------------------
// BUILD GRAPH
// -----------------------------
for (const file of project.getSourceFiles()) {
  const filePath = normalizePath(file.getFilePath());

  for (const imp of file.getImportDeclarations()) {
    const resolved = imp.getModuleSpecifierSourceFile();

    if (resolved) {
      addDependency(filePath, resolved.getFilePath());
    }
  }

  // basic dynamic import awareness (heuristic only)
  const text = file.getFullText();
  if (text.includes("import(") || text.includes("require(")) {
    // mark as “runtime-linked” by self-reference safety flag
    addDependency(filePath, filePath);
  }
}

// -----------------------------
// SAFE CYCLE-SUPPORTED IMPACT ANALYSIS
// -----------------------------
function simulateRemoval(target) {
  const impacted = new Set();
  const visited = new Set();
  const queue = [target];

  while (queue.length) {
    const current = queue.pop();
    const deps = graph.get(current);

    if (!deps) continue;
    if (visited.has(current)) continue;

    visited.add(current);

    for (const dep of deps) {
      if (!impacted.has(dep)) {
        impacted.add(dep);
        queue.push(dep);
      }
    }
  }

  return [...impacted];
}

// -----------------------------
// SCORING MODEL (STABILIZED)
// -----------------------------
function computeDeadScore(file, filePath) {
  const imports = file.getImportDeclarations().length;
  const exports = file.getExportedDeclarations().size;

  const rev = graph.get(filePath)?.size || 0;
  const hasDynamic = file.getFullText().includes("import(");

  let score = 0;

  if (imports === 0) score += 30;
  if (exports === 0) score += 25;
  if (rev === 0) score += 35;
  if (hasDynamic) score -= 50;

  return Math.max(0, Math.min(100, score));
}

// -----------------------------
// ANALYSIS
// -----------------------------
const results = [];

for (const file of project.getSourceFiles()) {
  const filePath = normalizePath(file.getFilePath());

  if (isProtected(filePath)) continue;

  const score = computeDeadScore(file, filePath);
  const impacted = simulateRemoval(filePath);
  const rev = graph.get(filePath)?.size || 0;

  const safeToPropose =
    score >= 80 &&
    impacted.length === 0 &&
    rev === 0 &&
    !isEntryPoint(filePath);

  results.push({
    file: filePath,
    score,
    impactedCount: impacted.length,
    safeToPropose,
  });
}

// -----------------------------
// OUTPUT (CI-FRIENDLY)
// -----------------------------
console.log("\n[DIFF-SANDBOX-v2] REFRACTOR CANDIDATES:\n");

results
  .sort((a, b) => b.score - a.score)
  .slice(0, 50)
  .forEach((r) => {
    console.log(`FILE: ${r.file}`);
    console.log(`  deadScore: ${r.score}`);
    console.log(`  impacted: ${r.impactedCount}`);
    console.log(`  safeToPropose: ${r.safeToPropose}`);
    console.log("--------------------------------------------------");
  });

console.log("\n[DIFF-SANDBOX-v2] COMPLETE (NO CHANGES APPLIED)");
