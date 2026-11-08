import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Contenu en français : les apostrophes droites sont valides en JSX.
      "react/no-unescaped-entities": "off",
      // Patterns de chargement initial courants ; à migrer progressivement.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      // Dette technique à résorber progressivement (catch (err: any), casts).
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rapports générés par les tests (couverture Vitest, Playwright)
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
