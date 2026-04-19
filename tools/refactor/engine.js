#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { Project } from "ts-morph";

const ROOT = process.cwd();

console.log("[REF-ENGINE] initializing...");

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
});

const sourceFiles = project.getSourceFiles();

const report = {
  unusedExports: [],
  clusters: {},
};

// ----------------------------
// CLUSTERING FUNCTION
// ----------------------------
function getCluster(filePath) {
  if (filePath.includes("api")) return "API";
  if (filePath.includes("client")) return "CLIENT";
  if (filePath.includes("scripts")) return "SCRIPTS";
  if (filePath.includes("lib")) return "LIB";
  if (filePath.includes("artifacts")) return "ARTIFACTS";
  return "CORE";
}

// ----------------------------
// ANALYSIS PASS
// ----------------------------
for (const file of sourceFiles) {
  const filePath = file.getFilePath();

  const cluster = getCluster(filePath);
  if (!report.clusters[cluster]) report.clusters[cluster] = [];

  report.clusters[cluster].push(filePath);

  const exports = file.getExportedDeclarations();

  for (const [name, decls] of exports) {
    const used = decls.some((d) => d.findReferences().length > 1);

    if (!used) {
      report.unusedExports.push({
        file: filePath,
        symbol: name,
        cluster,
      });
    }
  }
}

// ----------------------------
// OUTPUT REPORT
// ----------------------------
console.log("\n[REF-ENGINE] CLUSTERS:");
console.log(report.clusters);

console.log("\n[REF-ENGINE] UNUSED EXPORTS:");
for (const u of report.unusedExports.slice(0, 30)) {
  console.log(`- ${u.symbol} → ${u.file} [${u.cluster}]`);
}

// ----------------------------
// SAFETY STOP (NO AUTO APPLY)
// ----------------------------
console.log("\n[REF-ENGINE] DRY-RUN COMPLETE");
console.log("NO FILES MODIFIED (SAFE MODE)");
