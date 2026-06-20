/**
 * ASI WIRE v4 — STEP 4: GOVERNANCE EVALUATION
 *
 * Spec:
 *   "rule-based validation"
 *   "confidence scoring"
 *   "violation classification"
 *
 * Finding types: STATE | EVENT | ARCHITECTURE
 * Confidence = normalized(astCertainty + structuralConsistency + historicalRecurrence)
 *
 * HARD SAFETY CONSTRAINT: This step produces findings only.
 * No mutations. No writes. Suggestion-only governance mode.
 */

import type { FileSymbols } from '../analysis/ast-types.js';
import type { DependencyGraph } from '../graphs/dependency-graph.js';
import type { EventFlowGraph } from '../graphs/event-flow-graph.js';
import type { SkillClusterGraph } from '../graphs/skill-cluster-graph.js';
import { computeConfidence } from '../analysis/ast-types.js';

// ─── Finding Types (per spec output spec) ────────────────────────────────────

export type FindingType = 'STATE' | 'EVENT' | 'ARCHITECTURE';

export interface Finding {
  readonly type: FindingType;
  readonly subtype: string;
  readonly file: string;
  readonly line: number;
  readonly confidence: number;
  readonly description: string;
  /** Populated for ARCHITECTURE findings only. */
  readonly relatedFiles?: readonly string[];
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

export interface EvaluationInput {
  readonly files: readonly FileSymbols[];
  readonly dependencyGraph: DependencyGraph;
  readonly eventFlowGraph: EventFlowGraph;
  readonly skillClusterGraph: SkillClusterGraph;
}

export interface EvaluationResult {
  readonly findings: readonly Finding[];
  readonly metrics: {
    readonly totalFilesScanned: number;
    readonly totalEventsDetected: number;
    readonly totalViolations: number;
    readonly confidenceDistribution: {
      readonly high: number;   // >= 0.8
      readonly medium: number; // 0.5–0.79
      readonly low: number;    // < 0.5
    };
  };
}

export function evaluate(input: EvaluationInput): EvaluationResult {
  const findings: Finding[] = [];

  // ── Rule Set 1: STATE findings (INVARIANT 1 — No Implicit Mutation) ────────
  for (const file of input.files) {
    for (const mutation of file.mutations) {
      // Only flag mutations that are NOT preceded by a known event/dispatch
      // in the same file. If a mutation is inside a handler, it's legitimate.
      const isInsideHandler = isMutationInHandler(file, mutation.line);

      if (!isInsideHandler) {
        findings.push({
          type: 'STATE',
          subtype: 'IMPLICIT_MUTATION',
          file: mutation.file,
          line: mutation.line,
          confidence: computeConfidence({
            astCertainty: mutation.confidence,
            structuralConsistency: 0.2,
            historicalRecurrence: 0,
          }),
          description:
            `Direct state mutation via \`${mutation.pattern}\`` +
            (mutation.targetSymbol ? ` on \`${mutation.targetSymbol}\`` : '') +
            ' — not traceable to EventBus emit, Redux dispatch, or explicit state handler.',
        });
      }
    }
  }

  // ── Rule Set 2: EVENT findings (INVARIANT 2 — No Orphan Events) ────────────
  for (const violation of input.eventFlowGraph.violations) {
    if (violation.type === 'MISSING_HANDLER') {
      const primaryEmit = violation.emits[0];
      findings.push({
        type: 'EVENT',
        subtype: 'ORPHAN_EMIT',
        file: primaryEmit?.file ?? '[unknown]',
        line: primaryEmit?.line ?? 0,
        confidence: computeConfidence({
          astCertainty: 1.0,
          structuralConsistency: 0.3,
          historicalRecurrence: 0,
        }),
        description:
          `Event "${violation.eventName}" is emitted ` +
          `${violation.emits.length} time(s) but has no registered handler. ` +
          'Declare an intentional no-op policy or register a handler.',
      });
    }

    if (violation.type === 'DUPLICATE_HANDLER') {
      const first = violation.handlers[0];
      findings.push({
        type: 'EVENT',
        subtype: 'DUPLICATE_HANDLER',
        file: first?.file ?? '[unknown]',
        line: first?.line ?? 0,
        confidence: computeConfidence({
          astCertainty: 1.0,
          structuralConsistency: 0.1,
          historicalRecurrence: 0,
        }),
        description:
          `Event "${violation.eventName}" has ${violation.handlers.length} registered handlers. ` +
          'Multiple handlers for the same event cause non-deterministic execution order.',
        relatedFiles: violation.handlers.map((h) => `${h.file}:${h.line}`),
      });
    }

    if (violation.type === 'SILENT_EVENT_DROP') {
      const noop = violation as import('../graphs/event-flow-graph.js').SilentDropViolation;
      findings.push({
        type: 'EVENT',
        subtype: 'SILENT_DROP',
        file: '[multiple]',
        line: 0,
        confidence: computeConfidence({
          astCertainty: 0.6,
          structuralConsistency: 0.1,
          historicalRecurrence: 0,
        }),
        description:
          `Event "${noop.eventName}": ${noop.reason}`,
      });
    }
  }

  // ── Rule Set 3: ARCHITECTURE findings (INVARIANT 3 — DAG) ─────────────────
  if (!input.dependencyGraph.isDAG) {
    for (const cycle of input.dependencyGraph.cycles) {
      findings.push({
        type: 'ARCHITECTURE',
        subtype: cycle.collapseRisk ? 'DEPENDENCY_COLLAPSE_RISK' : 'CIRCULAR_DEPENDENCY',
        file: cycle.cycle[0] ?? '[unknown]',
        line: 0,
        confidence: computeConfidence({
          astCertainty: 1.0,
          structuralConsistency: cycle.collapseRisk ? 0.3 : 0.15,
          historicalRecurrence: 0,
        }),
        description:
          `Circular dependency detected across ${cycle.cycle.length} module(s). ` +
          (cycle.collapseRisk
            ? 'DEPENDENCY COLLAPSE RISK — cycle spans multiple packages, may cause runtime instability.'
            : 'Cycle confined to a single package.'),
        relatedFiles: cycle.cycle,
      });
    }
  }

  // ── Rule Set 4: ARCHITECTURE — Architecture Drift (design pattern violations)
  for (const file of input.files) {
    // Detect files with high mutation rate and zero event interaction —
    // a signal of drift away from event-driven design
    const mutationCount = file.mutations.length;
    const eventInteractionCount = file.emits.length + file.handlers.length + file.dispatches.length;

    if (mutationCount >= 3 && eventInteractionCount === 0) {
      findings.push({
        type: 'ARCHITECTURE',
        subtype: 'ARCHITECTURE_DRIFT',
        file: file.filePath,
        line: 0,
        confidence: computeConfidence({
          astCertainty: 0.7,
          structuralConsistency: 0.2,
          historicalRecurrence: 0,
        }),
        description:
          `File has ${mutationCount} state mutation(s) and zero event-system interaction. ` +
          'Indicates deviation from the intended event-driven architecture.',
      });
    }
  }

  // ── Rule Set 5: ARCHITECTURE — Skill Redundancy ────────────────────────────
  for (const cluster of input.skillClusterGraph.redundantClusters) {
    findings.push({
      type: 'ARCHITECTURE',
      subtype: 'SKILL_REDUNDANCY',
      file: cluster[0] ?? '[unknown]',
      line: 0,
      confidence: computeConfidence({
        astCertainty: 0.8,
        structuralConsistency: 0.2,
        historicalRecurrence: 0,
      }),
      description:
        `${cluster.length} SKILL.md files appear semantically redundant. ` +
        'Conflicting skill triggers may produce non-deterministic governance decisions.',
      relatedFiles: cluster,
    });
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  const totalEventsDetected =
    input.eventFlowGraph.nodes.size +
    input.eventFlowGraph.dynamicEmits.length;

  const dist = { high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (f.confidence >= 0.8) dist.high++;
    else if (f.confidence >= 0.5) dist.medium++;
    else dist.low++;
  }

  return Object.freeze({
    findings: Object.freeze(findings),
    metrics: Object.freeze({
      totalFilesScanned: input.files.length,
      totalEventsDetected,
      totalViolations: findings.length,
      confidenceDistribution: Object.freeze(dist),
    }),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Heuristic: a mutation is "inside a handler" if there is a handler
 * registration in the same file within 50 lines above it.
 * This reduces false positives for Zustand store patterns.
 */
function isMutationInHandler(file: FileSymbols, mutationLine: number): boolean {
  for (const handler of file.handlers) {
    if (
      handler.line <= mutationLine &&
      mutationLine - handler.line <= 50
    ) {
      return true;
    }
  }
  return false;
}
