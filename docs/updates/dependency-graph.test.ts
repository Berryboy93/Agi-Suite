import { describe, it, expect } from "vitest";
import { buildDependencyGraph } from "../src/graphs/dependency-graph.js";
import type { FileSymbols } from "../src/analysis/ast-types.js";

function makeFile(filePath: string, imports: string[]): FileSymbols {
  return {
    filePath,
    imports: imports.map((toFile) => ({
      fromFile: filePath,
      toFile,
      specifier: toFile,
      line: 1,
      isTypeOnly: false,
    })),
    emits: [],
    handlers: [],
    mutations: [],
    dispatches: [],
    parseWarnings: [],
  };
}

describe("buildDependencyGraph", () => {
  it("produces a DAG for acyclic imports", () => {
    const files: FileSymbols[] = [
      makeFile("/a.ts", ["/b.ts"]),
      makeFile("/b.ts", ["/c.ts"]),
      makeFile("/c.ts", []),
    ];
    const graph = buildDependencyGraph(files);
    expect(graph.isDAG).toBe(true);
    expect(graph.cycles).toHaveLength(0);
  });

  it("detects a simple cycle", () => {
    const files: FileSymbols[] = [
      makeFile("/a.ts", ["/b.ts"]),
      makeFile("/b.ts", ["/a.ts"]),
    ];
    const graph = buildDependencyGraph(files);
    expect(graph.isDAG).toBe(false);
    expect(graph.cycles.length).toBeGreaterThan(0);
    expect(graph.cycles[0]!.type).toBe("CIRCULAR_DEPENDENCY");
  });

  it("detects a 3-node cycle", () => {
    const files: FileSymbols[] = [
      makeFile("/a.ts", ["/b.ts"]),
      makeFile("/b.ts", ["/c.ts"]),
      makeFile("/c.ts", ["/a.ts"]),
    ];
    const graph = buildDependencyGraph(files);
    expect(graph.isDAG).toBe(false);
  });

  it("nodes are sorted (deterministic output)", () => {
    const files: FileSymbols[] = [
      makeFile("/z.ts", []),
      makeFile("/a.ts", []),
      makeFile("/m.ts", []),
    ];
    const graph = buildDependencyGraph(files);
    const keys = [...graph.nodes.keys()];
    expect(keys).toEqual([...keys].sort());
  });
});
