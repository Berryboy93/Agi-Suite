/**
 * ASI WIRE v4 — Pipeline Runner
 *
 * Executes all 5 steps in strict order:
 *   1. Safe File Discovery
 *   2. AST Parse Phase
 *   3. Graph Build Phase
 *   4. Governance Evaluation
 *   5. Report Generation
 *
 * Returns a WireReport. Never mutates source files.
 * Caller is responsible for any I/O (writing reports, etc.).
 */

import { discoverFiles } from "./analysis/discovery.js";
import { ASTParser } from "./analysis/ast-parser.js";
import { buildDependencyGraph } from "./graphs/dependency-graph.js";
import { buildEventFlowGraph } from "./graphs/event-flow-graph.js";
import { buildSkillClusterGraph } from "./graphs/skill-cluster-graph.js";
import { evaluate } from "./analysis/governance-evaluator.js";
import { generateReport, type WireReport } from "./report/report.js";

export interface RunOptions {
  /** Absolute or relative path to the project root to analyse. */
  root: string;
  /** Path to tsconfig.json for ts-morph symbol resolution. Optional. */
  tsConfigFilePath?: string;
}

/**
 * Run the full ASI WIRE v4 governance pipeline.
 *
 * @returns A fully-populated WireReport — immutable, JSON-serialisable.
 */
export async function runWire(options: RunOptions): Promise<WireReport> {
  const { root, tsConfigFilePath } = options;

  // ── STEP 1: Safe File Discovery ───────────────────────────────────────────
  const discovery = await discoverFiles(root);

  // ── STEP 2: AST Parse Phase ───────────────────────────────────────────────
  const parser = new ASTParser({
    tsConfigFilePath,
    skipAddingFilesFromTsConfig: tsConfigFilePath === undefined,
  });
  const fileSymbols = parser.parseFiles(discovery.sourceFiles);

  // ── STEP 3: Graph Build Phase ─────────────────────────────────────────────
  const [dependencyGraph, eventFlowGraph, skillClusterGraph] =
    await Promise.all([
      Promise.resolve(buildDependencyGraph(fileSymbols)),
      Promise.resolve(buildEventFlowGraph(fileSymbols)),
      buildSkillClusterGraph(discovery.skillFiles),
    ]);

  // ── STEP 4: Governance Evaluation ────────────────────────────────────────
  const evaluation = evaluate({
    files: fileSymbols,
    dependencyGraph,
    eventFlowGraph,
    skillClusterGraph,
  });

  // ── STEP 5: Report Generation ─────────────────────────────────────────────
  return generateReport(
    root,
    evaluation,
    dependencyGraph,
    eventFlowGraph,
    skillClusterGraph,
    discovery.integrity,
  );
}

// Re-export public surface
export type { WireReport } from "./report/report.js";
export type { Finding, FindingType } from "./analysis/governance-evaluator.js";
export type { DiscoveryResult } from "./analysis/discovery.js";
export { serializeReport } from "./report/report.js";
