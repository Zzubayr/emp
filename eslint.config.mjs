import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      // File downloads from route handlers are plain links on purpose.
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-expressions": ["warn", { allowTernary: true }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Vendored component sources (Kokonut UI, shadcn/ui)
    "src/components/kokonutui/**",
    "src/components/ui/**",
    "src/hooks/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
