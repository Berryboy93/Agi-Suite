/**
 * Governance Integration — WIRE Finding → Mythos ChangeRequest Adapter
 *
 * ASI WIRE v4 produces architecture findings (STATE | EVENT | ARCHITECTURE).
 * Mythos v5 evaluates ChangeRequests with (Surface, ActionType) pairs.
 *
 * This adapter maps WIRE findings to Mythos ChangeRequests using the
 * following deterministic mapping:
 *
 * Finding Type  | Subtype                    | Surface            | ActionType
 * STATE         | IMPLICIT_MUTATION          | runtime            | code_change
 * EVENT         | ORPHAN_EMIT                | runtime            | code_change
 * EVENT         | DUPLICATE_HANDLER          | runtime            | code_change
 * EVENT         | SILENT_DROP                | dev-build-isolated | code_change
 * ARCHITECTURE  | CIRCULAR_DEPENDENCY        | runtime            | code_change
 * ARCHITECTURE  | DEPENDENCY_COLLAPSE_RISK   | runtime            | schema_change
 * ARCHITECTURE  | ARCHITECTURE_DRIFT         | runtime            | code_change
 * ARCHITECTURE  | SKILL_REDUNDANCY           | dev-build-isolated | config_change
 *
 * The mapping follows blast-radius intent: a dependency collapse risk is treated
 * as a schema_change (high blast radius on runtime) because it can cause runtime
 * instability. An orphan emit is code_change (medium blast radius on runtime).
 */

import type { Finding } from '@r3vibe/asi-wire';
import type { ChangeRequest, ChangeRequestPair } from '@r3vibe/mythos';
import type { Surface, ActionType } from '@r3vibe/mythos';

interface FindingMappingRule {
  readonly surface: Surface;
  readonly actionType: ActionType;
}

type FindingSubtype =
  | 'IMPLICIT_MUTATION'
  | 'ORPHAN_EMIT'
  | 'DUPLICATE_HANDLER'
  | 'SILENT_DROP'
  | 'CIRCULAR_DEPENDENCY'
  | 'DEPENDENCY_COLLAPSE_RISK'
  | 'ARCHITECTURE_DRIFT'
  | 'SKILL_REDUNDANCY';

const FINDING_TO_CHANGE_REQUEST: Record<FindingSubtype, FindingMappingRule> = {
  IMPLICIT_MUTATION: { surface: 'runtime', actionType: 'code_change' },
  ORPHAN_EMIT: { surface: 'runtime', actionType: 'code_change' },
  DUPLICATE_HANDLER: { surface: 'runtime', actionType: 'code_change' },
  SILENT_DROP: { surface: 'dev-build-isolated', actionType: 'code_change' },
  CIRCULAR_DEPENDENCY: { surface: 'runtime', actionType: 'code_change' },
  DEPENDENCY_COLLAPSE_RISK: { surface: 'runtime', actionType: 'schema_change' },
  ARCHITECTURE_DRIFT: { surface: 'runtime', actionType: 'code_change' },
  SKILL_REDUNDANCY: { surface: 'dev-build-isolated', actionType: 'config_change' },
};

/** Default mapping for unknown subtypes. */
const FALLBACK_MAPPING: FindingMappingRule = {
  surface: 'runtime',
  actionType: 'code_change',
};

/**
 * Convert a batch of WIRE findings into a single compound Mythos ChangeRequest.
 *
 * Each finding becomes one (Surface, ActionType) pair in the request.
 * Duplicate pairs are deduplicated — only the most severe instance is kept.
 */
export function wireToChangeRequest(
  findings: readonly Finding[],
  requestId: string,
): ChangeRequest {
  // Deduplicate by (surface, actionType) key — keep first occurrence
  const seenPairs = new Set<string>();
  const pairs: ChangeRequestPair[] = [];

  for (const finding of findings) {
    const mapping =
      FINDING_TO_CHANGE_REQUEST[finding.subtype as FindingSubtype] ??
      FALLBACK_MAPPING;

    const key = `${mapping.surface}::${mapping.actionType}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);

    pairs.push({
      surface: mapping.surface,
      actionType: mapping.actionType,
      // No advisory severity from WIRE — re-price downgrade prohibited per spec
      advisory: undefined,
      repricedLevel: undefined,
    });
  }

  return {
    id: requestId,
    pairs: Object.freeze(pairs),
    submittedAt: new Date().toISOString(),
  };
}

/** Generate a request ID from timestamp + finding count. */
export function generateRequestId(findingCount: number): string {
  return `wire-${Date.now()}-${findingCount}f`;
}
