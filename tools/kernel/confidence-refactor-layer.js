#!/usr/bin/env node

import { Project } from "ts-morph";
import path from "path";

const ROOT = process.cwd();

console.log("[CONF-V2] building refactor intelligence layer...");

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
});

const results = [];

// -----------------------------
// HELPERS
// -----------------------------
const clamp = (n) => Math.max(0, Math.min(100, n));

function fileWeight(filePath) {
  if (filePath.endsWith(".config.js")) return 0.4;
  if (filePath.endsWith(".d.ts")) return 0.3;
  if (filePath.endsWith(".test.ts")) return 0.2;
  if (filePath.includes("node_modules")) return 0;
  return 1;
}

function entrypointScore(filePath) {
  const entryPatterns = [
    "index",
    "main",
    "app",
    "server",
    "cli",
    "bootstrap",
    "worker",
    "vite.config",
    "next.config",
  ];

  return entryPatterns.some((p) => filePath.includes(p)) ? 100 : 20;
}

// -----------------------------
// ANALYSIS
// -----------------------------
for (const file of project.getSourceFiles()) {
  const filePath = file.getFilePath();

  const weight = fileWeight(filePath);

  const imports = file.getImportDeclarations().length;
  const exports = file.getExportedDeclarations().size;
  const refs = file.getReferencedFiles().length;

  // -----------------------------
  // IMPROVED SIGNALS
  // -----------------------------

  // AST importance (normalized)
  const astSignal = clamp(exports * 12 + imports * 6);

  // Graph centrality proxy (better weighting)
  const graphSignal = clamp(imports * 10 + refs * 8);

  // Entry pressure (strong correction signal)
  const entrySignal = entrypointScore(filePath);

  // Isolation risk (NEW SIGNAL)
  const isolationRisk = clamp(100 - (imports + refs) * 5);

  // -----------------------------
  // FINAL SCORE (BALANCED MODEL)
  // -----------------------------
  let confidence =
    astSignal * 0.25 +
    graphSignal * 0.25 +
    entrySignal * 0.3 +
    isolationRisk * 0.2;

  confidence = confidence * weight;

  results.push({
    file: filePath,
    confidence: Math.round(confidence),
    imports,
    exports,
    refs,
  });
}

// -----------------------------
// SORT (LOW CONFIDENCE FIRST)
// -----------------------------
results.sort((a, b) => a.confidence - b.confidence);

// -----------------------------
// OUTPUT
// -----------------------------
console.log("\n[CONF-V2] LOW CONFIDENCE CANDIDATES (SAFE VIEW ONLY):\n");

for (const r of results.slice(0, 40)) {
  console.log(
    `${r.confidence}% → ${r.file} (i:${r.imports}, e:${r.exports}, r:${r.refs})`,
  );
}

console.log("\n[CONF-V2] COMPLETE — NO ACTIONS PERFORMED");
