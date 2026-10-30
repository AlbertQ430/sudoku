import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "refs/**",
      ".npm-cache/**",
      ".corepack/**",
      ".pnpm-store/**",
      ".patch-vite/**",
      ".tmp/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // 引擎层必须保持纯净：不得依赖 UI、存储、状态层
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-*", "zustand", "dexie"], message: "engine 层不得依赖 UI / 状态 / 存储库" },
            {
              group: ["@/features/*", "@/pages/*", "@/stores/*", "@/storage/*", "@/domain/*"],
              message: "engine 层不得反向依赖上层模块",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "scripts/**/*.ts", "scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
    },
  },
);
