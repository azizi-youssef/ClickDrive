import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from '../support/helpers';

/**
 * Protection des espaces privés (sans session) et parcours 11 : navigation en arabe (RTL).
 */

test.describe('Espaces privés sans session', () => {
  for (const [path, portal] of [
    ['/account/bookings', 'client'],
    ['/agency', 'agency'],
    ['/admin', 'admin'],
  ] as const) {
    test(`${path} : redirection vers la connexion, non indexable`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([302, 303, 307, 308]).toContain(response.status());
      const location = response.headers()['location'] ?? '';
      expect(location).toContain('/login');
      expect(location).toContain(`portal=${portal}`);
      expect(response.headers()['x-robots-tag']).toContain('noindex');
    });
  }

  test('page de connexion : non indexée, formulaire nommé', async ({ page }) => {
    await page.goto('/login?portal=client');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.getByLabel(/e-mail|email/i).first()).toBeVisible();
    await expect(page.locator('#cd-login-password')).toBeVisible();
  });
});

test.describe('Arabe (RTL)', () => {
  test('cookie de langue : HTML initial en arabe, de droite à gauche', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'clickdrive_locale', value: 'ar', url: baseURL! }]);
    const response = await page.goto('/');
    const html = (await response?.text()) ?? '';
    // Rendu serveur : la direction est correcte avant toute hydratation
    expect(html).toMatch(/<html[^>]*lang="ar"/);
    expect(html).toMatch(/<html[^>]*dir="rtl"/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectNoHorizontalOverflow(page);
  });

  test('première visite avec Accept-Language arabe : RTL détecté', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'ar-MA', extraHTTPHeaders: { 'Accept-Language': 'ar-MA,ar;q=0.9' } });
    const page = await context.newPage();
    await page.goto(baseURL!);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await context.close();
  });

  test('navigation en arabe : catalogue et fiche restent en RTL, sans débordement', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'clickdrive_locale', value: 'ar', url: baseURL! }]);
    await page.goto('/search');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectNoHorizontalOverflow(page);

    const link = page.locator('main a[href^="/cars/"]').first();
    const hasVehicle = await link
      .waitFor({ state: 'attached', timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!hasVehicle, 'Aucun véhicule publié sur cet environnement.');
    await page.goto((await link.getAttribute('href'))!);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectNoHorizontalOverflow(page);
  });
});
