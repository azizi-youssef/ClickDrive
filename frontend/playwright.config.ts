import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout ClickDrive.
 *
 * - `E2E_BASE_URL` absent : le serveur de développement local est utilisé (démarré si besoin).
 * - Parcours publics (`e2e/public/*`) : lecture seule, exécutables sur n'importe quel environnement.
 * - Parcours authentifiés et écritures (`e2e/staging/*`) : uniquement sur un environnement de test
 *   configuré (comptes de test + `E2E_ALLOW_WRITES=1`), jamais sur la production — voir `e2e/support/env.ts`.
 *
 * Bureau et mobile sont testés (Chromium uniquement, pour limiter le téléchargement de navigateurs).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Chromium complet (nouveau mode headless) : rendu identique au navigateur des utilisateurs
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chromium' } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
