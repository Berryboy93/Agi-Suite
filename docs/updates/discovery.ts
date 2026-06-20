/**
 * ASI WIRE v4 — STEP 1: SAFE FILE DISCOVERY
 *
 * Spec:
 *   "Excludes node_modules, build artifacts"
 *   "Validates filesystem integrity"
 *
 * Returns only paths that pass boundary checks.
 * Performs NO mutation. Performs NO AST work.
 * All I/O errors are captured, never thrown.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { checkBoundary, isSkillFile, type BoundaryResult } from './boundary.js';

export interface DiscoveryResult {
  /** Absolute paths of all in-scope TypeScript source files. */
  sourceFiles: string[];
  /** Absolute paths of all in-scope SKILL.md files. */
  skillFiles: string[];
  /** All out-of-scope paths with their exclusion reasons. */
  excluded: BoundaryResult[];
  /** Non-fatal I/O errors encountered during discovery. */
  errors: Array<{ path: string; message: string }>;
  /** Filesystem integrity status. */
  integrity: 'ok' | 'degraded';
}

/**
 * Recursively discovers all files under `root` that are within ASI WIRE
 * analysis scope.
 *
 * This is the first and only I/O-performing step. It validates filesystem
 * integrity by catching and recording errors per-directory, never aborting
 * the entire scan for a single unreadable path.
 */
export async function discoverFiles(root: string): Promise<DiscoveryResult> {
  const absoluteRoot = resolve(root);
  const result: DiscoveryResult = {
    sourceFiles: [],
    skillFiles: [],
    excluded: [],
    errors: [],
    integrity: 'ok',
  };

  await walk(absoluteRoot, result);

  if (result.errors.length > 0) {
    result.integrity = 'degraded';
  }

  // Deterministic ordering — essential for reproducible graph builds downstream
  result.sourceFiles.sort();
  result.skillFiles.sort();

  return result;
}

async function walk(dir: string, acc: DiscoveryResult): Promise<void> {
  let entries: string[];

  try {
    entries = await readdir(dir);
  } catch (err) {
    acc.errors.push({
      path: dir,
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    let fileStat;
    try {
      fileStat = await stat(fullPath);
    } catch (err) {
      acc.errors.push({
        path: fullPath,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (fileStat.isDirectory()) {
      // Apply boundary check to the directory path before recursing.
      // This short-circuits entire subtrees (e.g. node_modules) without
      // walking into them.
      const check = checkBoundary(fullPath + '/index.ts'); // synthetic path for pattern matching
      if (!check.inScope && isExcludedDirectory(fullPath)) {
        acc.excluded.push({
          inScope: false,
          path: fullPath,
          reason: 'Directory excluded by boundary rules',
        });
        continue;
      }
      await walk(fullPath, acc);
    } else if (fileStat.isFile()) {
      if (isSkillFile(fullPath)) {
        acc.skillFiles.push(fullPath);
        continue;
      }

      const check = checkBoundary(fullPath);
      if (check.inScope) {
        acc.sourceFiles.push(fullPath);
      } else {
        acc.excluded.push(check);
      }
    }
  }
}

/** Fast directory-level exclusion check to avoid descending into large excluded trees. */
function isExcludedDirectory(dirPath: string): boolean {
  const EXCLUDED_DIR_NAMES = new Set([
    'node_modules',
    '.pnpm',
    'dist',
    'build',
    '.next',
    '.vite',
    'coverage',
    '.nyc_output',
    '.turbo',
    '.cache',
  ]);

  const parts = dirPath.split(/[/\\]/);
  const last = parts[parts.length - 1] ?? '';
  return EXCLUDED_DIR_NAMES.has(last);
}
