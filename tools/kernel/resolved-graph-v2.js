#!/usr/bin/env node

import path from "path";
import fs from "fs";
import { Project } from "ts-morph";

const ROOT = process.cwd();

console.log("[GRAPH-V2] building resolved dependency graph...");

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
});

// -----------------------------
// GRAPH STRUCTURE (NORMALIZED)
// -----------------------------
const graph = {
  nodes: new Map(), // filePath → metadata
  edges: [], // resolved edges only
  unresolved: [], // failed resolutions
};

// -----------------------------
// SAFE RESOLVE FUNCTION
// -----------------------------
function resolveImport(sourceFile, moduleSpecifier) {
  try {
    const resolved = sourceFile
      .getImportDeclarations()
      .find((i) => i.getModuleSpecifierValue() === moduleSpecifier)
      ?.getModuleSpecifierSourceFile();

    if (resolved) {
      return resolved.getFilePath();
    }

    // fallback: try ts-morph global resolution
    const sf = project.getSourceFile(moduleSpecifier);
    if (sf) return sf.getFilePath();

    return null;
  } catch (e) {
    return null;
  }
}

// -----------------------------
// BUILD GRAPH
// -----------------------------
const files = project.getSourceFiles();

for (const file of files) {
  const filePath = file.getFilePath();

  // NODE
  graph.nodes.set(filePath, {
    exports: file.getExportedDeclarations().size,
    imports: file.getImportDeclarations().length,
  });

  // EDGES (RESOLVED)
  for (const imp of file.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    const targetFile = resolveImport(file, spec);

    if (targetFile) {
      graph.edges.push({
        from: filePath,
        to: targetFile,
        type: "resolved-import",
      });
    } else {
      graph.unresolved.push({
        from: filePath,
        specifier: spec,
      });
    }
  }
}

// -----------------------------
// OUTPUT SUMMARY
// -----------------------------
console.log("\n[GRAPH-V2] NODES:", graph.nodes.size);
console.log("[GRAPH-V2] RESOLVED EDGES:", graph.edges.length);
console.log("[GRAPH-V2] UNRESOLVED:", graph.unresolved.length);

// -----------------------------
// SAFETY INSIGHT
// -----------------------------
if (graph.unresolved.length > 0) {
  console.log("\n[GRAPH-V2] WARNING: unresolved imports detected");
  console.log("This is expected in monorepos (not an error)");
}

console.log("\n[GRAPH-V2] COMPLETE (READ-ONLY)");
