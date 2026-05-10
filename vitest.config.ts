/// <reference types="vitest" />
import { defineConfig } from "vite";

/**
 * FR-019 — Test Coverage for lib/api-zod
 * Target: >80% line coverage enforced via threshold.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/api-zod/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
