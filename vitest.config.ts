/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const API_ZOD_ROOT = resolve(__dirname, "lib/api-zod");
const API_CLIENT_REACT_ROOT = resolve(__dirname, "lib/api-client-react");
const DB_ROOT = resolve(__dirname, "lib/db");
const R3_AGI_ROOT = resolve(__dirname, "apps/r3-agi");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      resolve(API_ZOD_ROOT, "src/**/*.{test,spec}.ts"),
      resolve(API_CLIENT_REACT_ROOT, "src/**/*.{test,spec}.ts"),
      resolve(DB_ROOT, "src/**/*.{test,spec}.ts"),
      resolve(R3_AGI_ROOT, "src/**/*.{test,spec}.ts"),
    ],
    bail: 1,
    coverage: {
      enabled: true,
      provider: "v8",
      include: [
        "lib/api-zod/src/**/!(*.d).ts",
        "lib/db/src/**/!(*.d).ts",
        "apps/r3-agi/src/**/!(*.d).ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "lib/api-zod/src/index.ts",
        "lib/api-client-react/src/**",
        "lib/db/src/index.ts",
        "**/generated/**",
      ],
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
