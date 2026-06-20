/**
 * ASI WIRE v4 — Dependency Graph Builder
 *
 * Spec INVARIANT 3: "Module graph must remain DAG (Directed Acyclic Graph)"
 * Violation triggers: circular dependency alert + dependency collapse risk flag
 *
 * Graph is immutable after construction. No mutation capability.
 */

import type { FileSymbols } from '../analysis/ast-types.js';

export interface DependencyNode {
  readonly id: string; // absolute file path
  readonly imports: readonly string[]; // resolved absolute paths
}

export interface CycleViolation {
  readonly type: 'CIRCULAR_DEPENDENCY';
  readonly cycle: readonly string[]; // ordered list of files forming the cycle
  readonly collapseRisk: boolean;     // true if cycle spans >2 packages
}

export interface DependencyGraph {
  readonly nodes: ReadonlyMap<string, DependencyNode>;
  readonly cycles: readonly CycleViolation[];
  readonly isDAG: boolean;
}

/**
 * Build an immutable dependency graph from parsed file symbols.
 * Immediately detects all cycles via DFS (Tarjan's SCC algorithm).
 */
export function buildDependencyGraph(files: readonly FileSymbols[]): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();

  for (const file of files) {
    const resolvedImports = file.imports
      .map((e) => e.toFile)
      .filter((p) => !p.startsWith('[') && p !== file.filePath);

    nodes.set(file.filePath, {
      id: file.filePath,
      imports: Object.freeze(resolvedImports),
    });
  }

  const cycles = detectCycles(nodes);

  return Object.freeze({
    nodes: Object.freeze(nodes),
    cycles: Object.freeze(cycles),
    isDAG: cycles.length === 0,
  });
}

// ─── Tarjan's SCC for Cycle Detection ────────────────────────────────────────

interface TarjanState {
  index: number;
  stack: string[];
  indices: Map<string, number>;
  lowlinks: Map<string, number>;
  onStack: Set<string>;
  sccs: string[][];
}

function detectCycles(nodes: ReadonlyMap<string, DependencyNode>): CycleViolation[] {
  const state: TarjanState = {
    index: 0,
    stack: [],
    indices: new Map(),
    lowlinks: new Map(),
    onStack: new Set(),
    sccs: [],
  };

  for (const nodeId of nodes.keys()) {
    if (!state.indices.has(nodeId)) {
      strongConnect(nodeId, nodes, state);
    }
  }

  // SCCs with more than 1 node are cycles
  const violations: CycleViolation[] = [];
  for (const scc of state.sccs) {
    if (scc.length > 1) {
      const collapseRisk = spansMultiplePackages(scc);
      violations.push({
        type: 'CIRCULAR_DEPENDENCY',
        cycle: Object.freeze([...scc]),
        collapseRisk,
      });
    }
  }

  return violations;
}

function strongConnect(
  v: string,
  nodes: ReadonlyMap<string, DependencyNode>,
  state: TarjanState,
): void {
  state.indices.set(v, state.index);
  state.lowlinks.set(v, state.index);
  state.index++;
  state.stack.push(v);
  state.onStack.add(v);

  const node = nodes.get(v);
  for (const w of node?.imports ?? []) {
    if (!state.indices.has(w)) {
      strongConnect(w, nodes, state);
      const wLow = state.lowlinks.get(w) ?? Infinity;
      const vLow = state.lowlinks.get(v) ?? Infinity;
      state.lowlinks.set(v, Math.min(vLow, wLow));
    } else if (state.onStack.has(w)) {
      const wIdx = state.indices.get(w) ?? Infinity;
      const vLow = state.lowlinks.get(v) ?? Infinity;
      state.lowlinks.set(v, Math.min(vLow, wIdx));
    }
  }

  if (state.lowlinks.get(v) === state.indices.get(v)) {
    const scc: string[] = [];
    let w: string | undefined;
    do {
      w = state.stack.pop();
      if (w !== undefined) {
        state.onStack.delete(w);
        scc.push(w);
      }
    } while (w !== v);
    state.sccs.push(scc);
  }
}

/** Heuristic: >2 distinct package roots in a cycle implies high collapse risk. */
function spansMultiplePackages(paths: string[]): boolean {
  const packageRoots = new Set<string>();
  for (const p of paths) {
    const match = p.match(/packages[/\\]([^/\\]+)/);
    if (match?.[1]) packageRoots.add(match[1]);
  }
  return packageRoots.size > 2;
}

/** Serialise graph to JSON per spec output format. */
export function serializeDependencyGraph(graph: DependencyGraph): object {
  return {
    nodeCount: graph.nodes.size,
    isDAG: graph.isDAG,
    cycleCount: graph.cycles.length,
    cycles: graph.cycles.map((c) => ({
      files: c.cycle,
      collapseRisk: c.collapseRisk,
    })),
    adjacency: Object.fromEntries(
      [...graph.nodes.entries()].map(([id, node]) => [id, node.imports]),
    ),
  };
}
