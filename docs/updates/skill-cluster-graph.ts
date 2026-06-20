/**
 * ASI WIRE v4 — Skill Cluster Graph Builder
 *
 * Spec Threat: "Skill Redundancy Explosion — Duplicate SKILL.md files creating
 *               conflicting behaviors"
 *
 * Computes similarity between SKILL.md files based on:
 *   - Name/title tokens
 *   - Declared trigger patterns
 *   - Description overlap
 *
 * No AST — this operates on plain text only.
 * No mutation capability.
 */

import { readFile } from 'node:fs/promises';

export interface SkillDescriptor {
  readonly filePath: string;
  readonly name: string | null;
  readonly description: string | null;
  readonly triggerTokens: readonly string[];
}

export interface SkillSimilarityEdge {
  readonly skillA: string;
  readonly skillB: string;
  /** Jaccard similarity of triggerTokens: 0–1 */
  readonly similarity: number;
  readonly isRedundant: boolean; // similarity >= REDUNDANCY_THRESHOLD
}

export interface SkillClusterGraph {
  readonly skills: readonly SkillDescriptor[];
  readonly similarityEdges: readonly SkillSimilarityEdge[];
  readonly redundantClusters: readonly (readonly string[])[];
}

const REDUNDANCY_THRESHOLD = 0.6;

export async function buildSkillClusterGraph(
  skillFilePaths: readonly string[],
): Promise<SkillClusterGraph> {
  const skills = await Promise.all(
    skillFilePaths.map((fp) => parseSkillFile(fp)),
  );

  const edges: SkillSimilarityEdge[] = [];

  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i]!;
      const b = skills[j]!;
      const sim = jaccardSimilarity(
        new Set(a.triggerTokens),
        new Set(b.triggerTokens),
      );
      edges.push({
        skillA: a.filePath,
        skillB: b.filePath,
        similarity: sim,
        isRedundant: sim >= REDUNDANCY_THRESHOLD,
      });
    }
  }

  const redundantClusters = extractRedundantClusters(
    skills.map((s) => s.filePath),
    edges,
  );

  return Object.freeze({
    skills: Object.freeze(skills),
    similarityEdges: Object.freeze(edges),
    redundantClusters: Object.freeze(redundantClusters),
  });
}

async function parseSkillFile(filePath: string): Promise<SkillDescriptor> {
  let content = '';
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return { filePath, name: null, description: null, triggerTokens: [] };
  }

  const name = extractFrontmatterField(content, 'name');
  const description = extractFrontmatterField(content, 'description');

  // Extract trigger tokens from the description and any trigger/use-when sections
  const triggerSection = extractTriggerSection(content);
  const tokens = tokenize(`${description ?? ''} ${triggerSection}`);

  return {
    filePath,
    name,
    description,
    triggerTokens: Object.freeze(tokens),
  };
}

function extractFrontmatterField(content: string, field: string): string | null {
  // Match YAML frontmatter between --- delimiters
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch?.[1]) return null;

  const lines = frontmatterMatch[1].split('\n');
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    if (key?.trim() === field) {
      return rest.join(':').trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

function extractTriggerSection(content: string): string {
  // Look for trigger/when sections in markdown
  const match = content.match(/##\s+(?:Trigger|When to use|Use when)[^\n]*\n([\s\S]*?)(?=\n##|$)/i);
  return match?.[1] ?? '';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3) // filter stop words by length
    .filter(Boolean);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function extractRedundantClusters(
  nodes: string[],
  edges: SkillSimilarityEdge[],
): (readonly string[])[] {
  // Union-Find to group redundant skills into clusters
  const parent = new Map<string, string>(nodes.map((n) => [n, n]));

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const next = parent.get(curr)!;
      parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  function union(x: string, y: string): void {
    parent.set(find(x), find(y));
  }

  for (const edge of edges) {
    if (edge.isRedundant) {
      union(edge.skillA, edge.skillB);
    }
  }

  const clusters = new Map<string, string[]>();
  for (const node of nodes) {
    const root = find(node);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(node);
  }

  return [...clusters.values()]
    .filter((c) => c.length > 1)
    .map((c) => Object.freeze(c));
}

export function serializeSkillClusterGraph(graph: SkillClusterGraph): object {
  return {
    skillCount: graph.skills.length,
    redundantClusterCount: graph.redundantClusters.length,
    redundantClusters: graph.redundantClusters,
    highSimilarityPairs: graph.similarityEdges
      .filter((e) => e.isRedundant)
      .map((e) => ({
        skillA: e.skillA,
        skillB: e.skillB,
        similarity: Math.round(e.similarity * 100) / 100,
      })),
  };
}
