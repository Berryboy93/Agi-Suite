/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const API_ZOD_ROOT = resolve(__dirname, "lib/api-zod");
const API_CLIENT_REACT_ROOT = resolve(__dirname, "lib/api-client-react");
const DB_ROOT = resolve(__dirname, "lib/db");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      resolve(API_ZOD_ROOT, "src/**/*.{test,spec}.ts"),
      resolve(API_CLIENT_REACT_ROOT, "src/**/*.{test,spec}.ts"),
      resolve(DB_ROOT, "src/**/*.{test,spec}.ts"),
    ],
    bail: 1,
    coverage: {
      enabled: true,
      provider: "v8",
      include: [
        "lib/api-zod/src/**/*.ts",
        "lib/api-client-react/src/**/*.ts",
        "lib/db/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "lib/api-zod/src/index.ts",
        "lib/api-client-react/src/index.ts",
        "lib/db/src/index.ts",
        "**/generated/**",
      ],
      reportsDirectory: resolve(__dirname, "coverage"),
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
      reportOnFailure: true,
      clean: true,
    },
  },
});
