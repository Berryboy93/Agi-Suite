/**
 * Mythos Governance Engine v5 — Surfaces & Action Types
 *
 * Spec defines exactly 5 surfaces and 7 action types.
 * Every valid (Surface, ActionType) pair maps to exactly one blast radius.
 * Invalid pairs = BLOCK.
 */

// ─── Surfaces ─────────────────────────────────────────────────────────────────

export const SURFACES = [
  'runtime',
  'dev-build-attacker-input',
  'dev-build-supply-chain',
  'dev-build-credential-exposure',
  'dev-build-isolated',
] as const;

export type Surface = typeof SURFACES[number];

export function isSurface(value: string): value is Surface {
  return (SURFACES as readonly string[]).includes(value);
}

// ─── Action Types ─────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  'code_change',
  'deploy',
  'schema_change',
  'config_change',
  'dependency_update',
  'auth_change',
  'payment_change',
] as const;

export type ActionType = typeof ACTION_TYPES[number];

export function isActionType(value: string): value is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(value);
}

// ─── Blast Radius Levels ──────────────────────────────────────────────────────

export const BLAST_RADIUS_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type BlastRadiusLevel = typeof BLAST_RADIUS_LEVELS[number];

/** Numeric ordering for comparison: higher = more severe. */
export const BLAST_RADIUS_ORDER: Record<BlastRadiusLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function compareBlastRadius(a: BlastRadiusLevel, b: BlastRadiusLevel): number {
  return BLAST_RADIUS_ORDER[a] - BLAST_RADIUS_ORDER[b];
}

/** Sentinel: this (Surface, ActionType) pair is invalid — immediate BLOCK. */
export const INVALID = 'INVALID' as const;
export type MatrixEntry = BlastRadiusLevel | typeof INVALID;

// ─── Blast Radius Matrix ──────────────────────────────────────────────────────
//
// Spec table (verbatim mapping):
//
// Surface                     | code_change | deploy | schema_change | config_change | dependency_update | auth_change | payment_change
// runtime                     | medium      | high   | high          | medium        | high              | critical    | critical
// dev-build-attacker-input    | —           | —      | —             | medium        | high              | —           | —
// dev-build-supply-chain      | —           | —      | —             | —             | high              | —           | —
// dev-build-isolated          | low         | —      | —             | low           | —                 | —           | —
// dev-build-credential-exposure (all INVALID — Rule 1 hard block)

type BlastRadiusMatrix = Record<Surface, Record<ActionType, MatrixEntry>>;

export const BLAST_RADIUS_MATRIX: BlastRadiusMatrix = Object.freeze({
  runtime: Object.freeze({
    code_change: 'medium',
    deploy: 'high',
    schema_change: 'high',
    config_change: 'medium',
    dependency_update: 'high',
    auth_change: 'critical',
    payment_change: 'critical',
  }),
  'dev-build-attacker-input': Object.freeze({
    code_change: INVALID,
    deploy: INVALID,
    schema_change: INVALID,
    config_change: 'medium',
    dependency_update: 'high',
    auth_change: INVALID,
    payment_change: INVALID,
  }),
  'dev-build-supply-chain': Object.freeze({
    code_change: INVALID,
    deploy: INVALID,
    schema_change: INVALID,
    config_change: INVALID,
    dependency_update: 'high',
    auth_change: INVALID,
    payment_change: INVALID,
  }),
  'dev-build-credential-exposure': Object.freeze({
    // Rule 1: ALL pairs are unconditionally BLOCK (represented as INVALID here;
    // Rule 1 hard block is enforced before matrix lookup in the evaluator)
    code_change: INVALID,
    deploy: INVALID,
    schema_change: INVALID,
    config_change: INVALID,
    dependency_update: INVALID,
    auth_change: INVALID,
    payment_change: INVALID,
  }),
  'dev-build-isolated': Object.freeze({
    code_change: 'low',
    deploy: INVALID,
    schema_change: INVALID,
    config_change: 'low',
    dependency_update: INVALID,
    auth_change: INVALID,
    payment_change: INVALID,
  }),
} as BlastRadiusMatrix);

/**
 * Deterministic matrix lookup.
 * Returns INVALID for credential-exposure surface (Rule 1 takes precedence).
 */
export function lookupBlastRadius(
  surface: Surface,
  actionType: ActionType,
): MatrixEntry {
  return BLAST_RADIUS_MATRIX[surface][actionType];
}
