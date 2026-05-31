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
    include: [
      "lib/api-zod/src/**/*.{test,spec}.ts",
      "lib/api-client-react/src/**/*.{test,spec}.ts",
      "lib/db/src/**/*.{test,spec}.ts",
      "packages/cli/__tests__/**/*.{test,spec}.ts"
    ],
    exclude: ["**/*.test.d.ts", "**/*.spec.d.ts", "**/node_modules/**", "**/dist/**"],
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
