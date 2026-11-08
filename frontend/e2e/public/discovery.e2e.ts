import { expect, test } from '@playwright/test';
import { collectConsoleErrors, expectNoHorizontalOverflow, firstVehicleHref } from '../support/helpers';

/**
 * Parcours 2, 3 et 4 : découverte, filtrage du catalogue, fiche véhicule.
 * Lecture seule sur les données réelles de l'environnement ciblé.
 */

test.describe('Découverte des véhicules', () => {
  test('accueil : rendu serveur, langue française, sans erreur de console', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.waitForLoadState('networkidle');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('catalogue voitures : fiches publiées, liens vers les fiches véhicule', async ({ page }) => {
    const href = await firstVehicleHref(page, '/search');
    test.skip(!href, 'Aucun véhicule publié sur cet environnement.');
    await expect(page.locator('main a[href^="/cars/"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Filtrage du catalogue', () => {
  test('bascule voitures → motos : URL dédiée, onglet courant annoncé', async ({ page }) => {
    await page.goto('/search');
    const typeNav = page.getByRole('navigation', { name: 'Type de véhicule' });
    await expect(typeNav).toBeVisible();
    const motos = typeNav.getByRole('link', { name: /Motos/ });
    await motos.click();
    await expect(page).toHaveURL(/\/motos(\?|$)/);
    await expect(page.getByRole('navigation', { name: 'Type de véhicule' }).getByRole('link', { name: /Motos/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.getByRole('navigation', { name: 'Type de véhicule' }).getByRole('link', { name: /Voitures/ })).not.toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('mobile : panneau de filtres modal (focus, Échap, retour du focus)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Panneau de filtres réservé aux petits écrans.');
    await page.goto('/search');
    const open = page.getByRole('button', { name: /^Filtres/ });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Filtres' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Fermer' })).toBeFocused();

    // Tab reste dans le panneau
    for (let i = 0; i < 25; i += 1) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });
});

test.describe('Fiche véhicule', () => {
  test('rendu serveur : titre, canonique et données structurées dans le HTML initial', async ({ page, request }) => {
    const href = await firstVehicleHref(page);
    test.skip(!href, 'Aucun véhicule publié sur cet environnement.');

    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/<h1[^>]*>[^<]+/);
    expect(html).toContain(`rel="canonical" href="https://clickdrive.ma${href}"`);
    expect(html).toMatch(/"@type":"(Car|Motorcycle)"/);
    expect(html).toContain('"@type":"BreadcrumbList"');
    // Aucun champ interne exposé
    expect(html).not.toMatch(/"license_plate":"[^"]+"/);
  });

  test('véhicule inexistant : vraie réponse 404', async ({ request }) => {
    const response = await request.get('/cars/vehicule-inexistant-e2e');
    expect(response.status()).toBe(404);
  });

  test('disponibilité vérifiée puis modale de demande accessible au clavier (sans envoi)', async ({ page }) => {
    const href = await firstVehicleHref(page);
    test.skip(!href, 'Aucun véhicule publié sur cet environnement.');
    await page.goto(href!);

    // Trois états possibles, jamais « disponible » sans réponse du serveur
    const state = page.getByText(/Disponible pour ces dates|Indisponible pour ces dates|Disponibilité non vérifiée/).first();
    await expect(state).toBeVisible({ timeout: 20_000 });
    const label = await state.textContent();
    test.skip(label !== 'Disponible pour ces dates', `Véhicule non réservable aux dates par défaut (${label}).`);

    const book = page.locator('form button[type="submit"]').first();
    if (await book.isVisible()) {
      await book.click();
    } else {
      // Mobile : barre de réservation fixe
      await page.getByRole('button', { name: 'Réserver', exact: true }).click();
    }
    const dialog = page.getByRole('dialog').filter({ has: page.getByLabel(/Prénom/) });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/Prénom/)).toBeFocused();

    for (let i = 0; i < 30; i += 1) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 30; i += 1) await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);

    // Étape incomplète : aucune requête de création
    const created: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/bookings')) created.push(request.url());
    });
    await dialog.getByRole('button', { name: /Continuer/ }).click();
    await expect(dialog.getByLabel(/Prénom/)).toHaveAttribute('aria-invalid', 'true');
    expect(created).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
