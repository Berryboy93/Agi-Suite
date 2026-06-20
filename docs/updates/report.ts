/**
 * ASI WIRE v4 — STEP 5: REPORT GENERATION
 *
 * Spec:
 *   "JSON structured output"
 *   "deterministic ordering"
 *   "no side effects"
 *
 * This module produces the final JSON report per the output specification.
 * It performs NO I/O. The caller is responsible for writing the output.
 */

import type { EvaluationResult } from '../analysis/governance-evaluator.js';
import type { DependencyGraph } from '../graphs/dependency-graph.js';
import type { EventFlowGraph } from '../graphs/event-flow-graph.js';
import type { SkillClusterGraph } from '../graphs/skill-cluster-graph.js';
import {
  serializeDependencyGraph,
} from '../graphs/dependency-graph.js';
import {
  serializeEventFlowGraph,
} from '../graphs/event-flow-graph.js';
import {
  serializeSkillClusterGraph,
} from '../graphs/skill-cluster-graph.js';

/** Per-spec output structure. */
export interface WireReport {
  readonly timestamp: string;         // ISO-8601
  readonly root: string;
  readonly metrics: {
    readonly files: number;
    readonly events: number;
    readonly violations: number;
  };
  readonly graphs: {
    readonly eventFlow: object;
    readonly dependencyGraph: object;
    readonly skillClusters: object;
  };
  readonly findings: readonly {
    readonly type: 'STATE' | 'EVENT' | 'ARCHITECTURE';
    readonly subtype: string;
    readonly file: string;
    readonly line: number;
    readonly confidence: number;
    readonly description: string;
    readonly relatedFiles?: readonly string[];
  }[];
  readonly integrity: 'ok' | 'degraded';
}

export function generateReport(
  root: string,
  evaluation: EvaluationResult,
  dependencyGraph: DependencyGraph,
  eventFlowGraph: EventFlowGraph,
  skillClusterGraph: SkillClusterGraph,
  integrity: 'ok' | 'degraded',
): WireReport {
  // Deterministic ordering: sort findings by file path then line number
  const sortedFindings = [...evaluation.findings].sort((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);
    if (fileCmp !== 0) return fileCmp;
    return a.line - b.line;
  });

  return Object.freeze({
    timestamp: new Date().toISOString(),
    root,
    metrics: Object.freeze({
      files: evaluation.metrics.totalFilesScanned,
      events: evaluation.metrics.totalEventsDetected,
      violations: evaluation.metrics.totalViolations,
    }),
    graphs: Object.freeze({
      eventFlow: serializeEventFlowGraph(eventFlowGraph),
      dependencyGraph: serializeDependencyGraph(dependencyGraph),
      skillClusters: serializeSkillClusterGraph(skillClusterGraph),
    }),
    findings: Object.freeze(sortedFindings),
    integrity,
  });
}

/** Serialise the report to a deterministically-ordered JSON string. */
export function serializeReport(report: WireReport): string {
  return JSON.stringify(report, null, 2);
}
