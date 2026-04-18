import { defineWorkspace } from "vitest/config";

/**
 * Vitest monorepo workspace config.
 * Each package opts in by providing its own vitest.config.ts.
 * Add entries here as packages grow test suites.
 */
export default defineWorkspace([
  // Shared libs
  "lib/api-zod/vitest.config.ts",
  "lib/api-spec/vitest.config.ts",
  "lib/db/vitest.config.ts",

  // Artifacts (add when test suites are introduced)
  // "artifacts/api-server/vitest.config.ts",
  // "artifacts/r3-agi/vitest.config.ts",
]);
