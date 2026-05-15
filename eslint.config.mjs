// eslint.config.mjs  (flat config – ESLint 8+, ESM explicit)
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  // ── Global ignores (must be first, no other properties) ─────────────
  {
    ignores: [
      "**/dist/**",
      "**/.patch-backups/**",
      "**/legacy-scripts/**",
      "**/node_modules/**",
      "**/.git/**",
    ],
  },

  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // ── React Hooks rules ───────────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ── Prevent deep imports into llpte-* packages (Step 5.5) ──────────
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@llpte/*/src/*", "@llpte/*/dist/internal/*"],
          paths: [
            {
              name: "@/store/transport-store",
              importNames: [
                "useTransportFlat",
                "usetransportstore",
                "useTransportstore",
              ],
              message:
                "Use useTransportStore directly — flat props are first-class members.",
            },
            {
              name: "@/store/clip-store",
              importNames: ["useClipstore", "useclipstore"],
              message: "Use useClipStore (capital S).",
            },
          ],
        },
      ],

      // ── TypeScript best-practice rules ─────────────────────────────────
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
    },
  },
  {
    // Test files get relaxed rules
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
