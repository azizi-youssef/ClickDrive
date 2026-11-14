import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest — cadre de test cible du projet.
 * - `*.spec.ts`  : tests unitaires / d'intégration (environnement Node) ;
 * - `*.spec.tsx` : tests de composants (jsdom) ;
 * - `src/tests/db/*.spec.ts` : migrations et RLS sur un vrai PostgreSQL (PGlite), plus lents.
 * Les anciennes suites `src/tests/*.test.ts` (node:test) restent exécutées par `npm run test:legacy`
 * jusqu'à leur migration complète.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@clickdrive/shared/booking-schema': fileURLToPath(new URL('../packages/shared/src/booking-schema.ts', import.meta.url)),
      '@clickdrive/shared/booking-status': fileURLToPath(new URL('../packages/shared/src/booking-status.ts', import.meta.url)),
      '@clickdrive/shared/booking-state-machine': fileURLToPath(new URL('../packages/shared/src/booking-state-machine.ts', import.meta.url)),
      '@clickdrive/shared/roles': fileURLToPath(new URL('../packages/shared/src/roles.ts', import.meta.url)),
      '@clickdrive/shared': fileURLToPath(new URL('../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    environment: 'node',
    // Les tests de composants déclarent leur environnement : // @vitest-environment jsdom
    setupFiles: ['src/tests/setup/vitest.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**/*.ts', 'src/components/**/*.tsx', 'src/app/api/**/*.ts'],
      exclude: ['src/tests/**', '**/*.d.ts'],
    },
  },
});
