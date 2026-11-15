import { describe, expect, it } from 'vitest';
import type { AdminOverview } from './overview';
import { allClearMessage, buildTodos } from './overview-todos';

const base = (overrides: Partial<AdminOverview> = {}): AdminOverview => ({
  bookings: { total: 10, pending: 0, confirmed: 5, completed: 5, closed: 0, createdLast30Days: 4, createdPrevious30Days: 3 },
  recentBookings: [],
  pendingAgencies: { count: 0, items: [] },
  contactMessages: { count: 0 },
  planRequests: { count: 0 },
  generatedAt: '2026-11-15T10:00:00.000Z',
  ...overrides,
});

const keys = (overview: AdminOverview, services: string[] = []) => buildTodos(overview, services).map((todo) => todo.key);

describe('buildTodos', () => {
  it('rien à traiter : liste vide', () => {
    expect(buildTodos(base(), [])).toEqual([]);
  });

  it('chaque rubrique en attente produit un élément, dans l’ordre d’affichage', () => {
    const overview = base({
      bookings: { ...base().bookings, pending: 2 },
      pendingAgencies: { count: 1, items: [] },
      contactMessages: { count: 5 },
      planRequests: { count: 3 },
    });
    expect(keys(overview, ['Supabase'])).toEqual(['agencies', 'bookings', 'messages', 'plans', 'health']);
  });

  it('libellés et liens des deux nouvelles rubriques (pluriel et singulier)', () => {
    const [messages, plans] = buildTodos(base({ contactMessages: { count: 3 }, planRequests: { count: 2 } }), []);
    expect(messages).toMatchObject({ href: '/admin/messages', title: '3 nouveaux messages de contact' });
    expect(plans).toMatchObject({ href: '/admin/finance', title: '2 demandes de changement de formule' });

    const [one, oneRequest] = buildTodos(base({ contactMessages: { count: 1 }, planRequests: { count: 1 } }), []);
    expect(one!.title).toBe('1 nouveau message de contact');
    expect(oneRequest!.title).toBe('1 demande de changement de formule');
  });

  it('un nombre inconnu (droit absent ou lecture en échec) ne produit jamais d’élément', () => {
    expect(keys(base({ contactMessages: { count: 0, restricted: true }, planRequests: { count: 0, unavailable: true } }))).toEqual([]);
    // Même avec un nombre résiduel : inconnu prime
    expect(keys(base({ contactMessages: { count: 7, unavailable: true } }))).toEqual([]);
  });
});

describe('allClearMessage', () => {
  it('tout est lu et les services répondent', () => {
    expect(allClearMessage(base(), true)).toBe(
      'Tout est à jour : aucune agence, réservation, message de contact ou demande de formule en attente, tous les services répondent.'
    );
  });

  it('services non vérifiés : ne prétend pas qu’ils répondent', () => {
    expect(allClearMessage(base(), false)).toBe(
      'Aucune agence, réservation, message de contact ou demande de formule en attente. L’état des services n’a pas pu être vérifié.'
    );
  });

  it('une rubrique sans droit de lecture est omise (on ne la déclare pas « à jour »)', () => {
    const overview = base({
      pendingAgencies: { count: 0, items: [], restricted: true },
      contactMessages: { count: 0, restricted: true },
      planRequests: { count: 0, restricted: true },
    });
    expect(allClearMessage(overview, true)).toBe('Tout est à jour : aucune réservation en attente, tous les services répondent.');
  });

  it('une rubrique en échec : plus de « Tout est à jour », elle est nommée', () => {
    const text = allClearMessage(base({ contactMessages: { count: 0, unavailable: true }, planRequests: { count: 0, unavailable: true } }), true);
    expect(text).toContain('Rien à traiter parmi les éléments lus : aucune agence ou réservation en attente.');
    expect(text).toContain('Lecture impossible pour le moment : messages de contact, demandes de formule.');
    expect(text).not.toMatch(/Tout est à jour/);
    expect(text).not.toMatch(/tous les services répondent/);
  });
});
