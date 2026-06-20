/**
 * ASI WIRE v4 — AST Analysis Types
 *
 * Spec covers:
 *   - CallExpression tracking
 *   - MemberExpression resolution
 *   - Import graph resolution
 *   - Symbol reference linking
 *
 * All types are readonly — the parse phase produces immutable data.
 * No mutation capability exists anywhere in the analysis pipeline.
 */

/** A resolved import relationship between two source files. */
export interface ImportEdge {
  readonly fromFile: string;
  readonly toFile: string;
  /** The raw specifier as written in source, e.g. '../utils/eventBus'. */
  readonly specifier: string;
  readonly line: number;
  readonly isTypeOnly: boolean;
}

/** A detected EventBus emit() call. */
export interface EmitCall {
  readonly file: string;
  readonly line: number;
  /** Event name if statically resolvable; null if dynamic. */
  readonly eventName: string | null;
  readonly isDynamic: boolean;
  readonly confidence: number;
}

/** A detected event handler registration (on/listen/subscribe/addListener). */
export interface HandlerRegistration {
  readonly file: string;
  readonly line: number;
  readonly eventName: string | null;
  readonly isDynamic: boolean;
  readonly handlerSymbol: string | null;
  readonly confidence: number;
}

/** A detected direct state mutation (bypasses event system). */
export interface DirectMutation {
  readonly file: string;
  readonly line: number;
  /** The mutation pattern detected, e.g. 'setState', 'set', 'direct assignment'. */
  readonly pattern: string;
  readonly targetSymbol: string | null;
  readonly confidence: number;
}

/** A detected Redux dispatch() call. */
export interface ReduxDispatch {
  readonly file: string;
  readonly line: number;
  readonly actionType: string | null;
  readonly confidence: number;
}

/** All symbols extracted from a single source file. */
export interface FileSymbols {
  readonly filePath: string;
  readonly imports: readonly ImportEdge[];
  readonly emits: readonly EmitCall[];
  readonly handlers: readonly HandlerRegistration[];
  readonly mutations: readonly DirectMutation[];
  readonly dispatches: readonly ReduxDispatch[];
  /** Parse errors that did not abort analysis but may reduce confidence. */
  readonly parseWarnings: readonly string[];
}

/** Confidence weighting per spec:
 *   AST certainty:         0.5–1.0
 *   Structural consistency: 0–0.3
 *   Historical recurrence:  0–0.2 (applied at governance evaluation, not parse)
 */
export interface ConfidenceWeights {
  readonly astCertainty: number;       // 0.5–1.0
  readonly structuralConsistency: number; // 0–0.3
  readonly historicalRecurrence: number;  // 0–0.2
}

export function computeConfidence(weights: ConfidenceWeights): number {
  const raw =
    weights.astCertainty +
    weights.structuralConsistency +
    weights.historicalRecurrence;
  // Normalize to 0–1 range (max possible raw = 1.5)
  return Math.min(1, Math.max(0, raw / 1.5));
}
