/**
 * ASI WIRE v4 — System Boundary Definitions
 *
 * Spec: "What is IN scope: Agent-OS TypeScript/skill/event architecture"
 *       "What is OUT of scope: node_modules internals, external libraries, build artifacts"
 *
 * These are INVARIANTS — boundary violations terminate analysis before any AST work begins.
 */

/** Absolute path exclusion patterns — always OUT of scope. */
export const EXCLUDED_PATH_PATTERNS: readonly RegExp[] = Object.freeze([
  /[/\\]node_modules[/\\]/,
  /[/\\]\.pnpm[/\\]/,
  /[/\\]dist[/\\]/,
  /[/\\]build[/\\]/,
  /[/\\]\.next[/\\]/,
  /[/\\]\.vite[/\\]/,
  /[/\\]coverage[/\\]/,
  /[/\\]\.nyc_output[/\\]/,
  /[/\\]\.turbo[/\\]/,
  /[/\\]\.cache[/\\]/,
  /\.(js|cjs|mjs)\.map$/,
  /\.(d\.ts)$/,
]);

/** File extensions that are IN scope for AST analysis. */
export const INCLUDED_EXTENSIONS: readonly string[] = Object.freeze([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);

/** Skill file names — included for SKILL coherence analysis (not AST). */
export const SKILL_FILE_NAME = "SKILL.md" as const;

/** Result of a boundary check on a filesystem path. */
export type BoundaryResult =
  | { inScope: true; path: string }
  | { inScope: false; path: string; reason: string };

/**
 * Deterministically checks whether a resolved absolute path is within
 * ASI WIRE v4 analysis scope.
 *
 * This function has NO side effects and performs NO I/O.
 * It is the first gate in the SAFE FILE DISCOVERY step.
 */
export function checkBoundary(absolutePath: string): BoundaryResult {
  // Gate 1 — excluded path pattern
  for (const pattern of EXCLUDED_PATH_PATTERNS) {
    if (pattern.test(absolutePath)) {
      return {
        inScope: false,
        path: absolutePath,
        reason: `Excluded by pattern: ${pattern.toString()}`,
      };
    }
  }

  // Gate 2 — extension must be in the allowed set
  const ext = getExtension(absolutePath);
  if (!INCLUDED_EXTENSIONS.includes(ext)) {
    return {
      inScope: false,
      path: absolutePath,
      reason: `Extension "${ext}" is not in the analysable set`,
    };
  }

  return { inScope: true, path: absolutePath };
}

/**
 * Checks whether a path refers to a SKILL.md file eligible for
 * skill-coherence analysis (separate pipeline from AST).
 */
export function isSkillFile(absolutePath: string): boolean {
  const parts = absolutePath.split(/[/\\]/);
  const filename = parts[parts.length - 1] ?? "";
  // Must not be inside excluded paths
  for (const pattern of EXCLUDED_PATH_PATTERNS) {
    if (pattern.test(absolutePath)) return false;
  }
  return filename === SKILL_FILE_NAME;
}

/** Extract the lowercase file extension including the leading dot. */
function getExtension(filePath: string): string {
  // Handle double extensions like .d.ts before this function is called
  // (already excluded by EXCLUDED_PATH_PATTERNS above)
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filePath.slice(lastDot).toLowerCase();
}
