import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Phase 0 mandate: no `any` unless genuinely unavoidable.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // src/generated holds the Prisma client, which is vendor output
    // regenerated on every install - linting it is noise, not signal.
    // src/generated holds the Prisma client and public/sw.js is the generated,
    // minified service worker. Both are build output, not source.
    ignores: [
      ".next/**",
      // The dev-mode build directory; see `distDir` in next.config.ts.
      ".next-dev/**",
      "node_modules/**",
      "coverage/**",
      "src/generated/**",
      "public/sw.js",
      "public/sw.js.map",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
