// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminStats } from '@/lib/api/stats.api';
import type { AdminOverview } from '@/lib/admin/overview';
import { AdminOverviewClient } from './AdminOverviewClient';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const stats: AdminStats = {
  totalAgencies: 14,
  verifiedAgencies: 9,
  pendingAgencies: 3,
  totalVehicles: 128,
  totalMotorcycles: 22,
  totalBookings: 412,
  totalVolume: 1_284_500,
};

const overview = (overrides: Partial<AdminOverview> = {}): AdminOverview => ({
  bookings: { total: 412, pending: 17, confirmed: 38, completed: 301, closed: 56, createdLast30Days: 74, createdPrevious30Days: 61 },
  recentBookings: [],
  pendingAgencies: { count: 3, items: [{ id: 'a1', name: 'Atlas Rent Oujda', city: 'Oujda', email: 'contact@atlas.test', status: 'PENDING', verified: false }] },
  contactMessages: { count: 0 },
  planRequests: { count: 0 },
  generatedAt: new Date().toISOString(),
  ...overrides,
});

const calm = overview({
  bookings: { total: 10, pending: 0, confirmed: 5, completed: 5, closed: 0, createdLast30Days: 4, createdPrevious30Days: 3 },
  pendingAgencies: { count: 0, items: [] },
});

const subscriptions = { stats: { monthlyRecurringRevenue: 6450, activeSubscribers: 9, fleetCapacityTotal: 210, plansDistribution: [{ slug: 'pro', planName: 'Pro', count: 3, revenue: 2250 }] }, subscriptions: [] };
const healthy = { success: true, checks: { app: 'ok', database: 'ok', supabase: 'ok' }, timestamp: new Date().toISOString() };

type Route = 'stats' | 'overview' | 'health' | 'subscriptions';

/** API simulée : chaque route peut être remplacée, ou en échec (`'fail'`) */
function stubApi(routes: Partial<Record<Route, unknown | 'fail'>> = {}) {
  const table: Record<Route, unknown | 'fail'> = { stats: { success: true, data: stats }, overview: { success: true, data: overview() }, health: healthy, subscriptions: { success: true, data: subscriptions }, ...routes };
  const pick = (url: string): Route | null =>
    url.startsWith('/api/stats/admin') ? 'stats' : url.startsWith('/api/admin/overview') ? 'overview' : url.startsWith('/api/health') ? 'health' : url.startsWith('/api/admin/subscriptions') ? 'subscriptions' : null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const route = pick(String(input));
      if (!route) return new Response('{}', { status: 404 });
      const value = table[route];
      if (value === 'fail') throw new Error('réseau indisponible');
      return new Response(JSON.stringify(value), { status: 200 });
    })
  );
}

afterEach(() => vi.unstubAllGlobals());

const kpi = (label: string) => screen.getByText(label).closest('a, div')!.parentElement as HTMLElement;

describe('Vue d’ensemble admin — données réelles', () => {
  it('affiche les valeurs réelles et les actions à traiter', async () => {
    stubApi();
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(await screen.findByText('3 agences à vérifier')).toBeInTheDocument();
    expect(screen.getByText('17 réservations en attente')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.queryByText('Données d’abonnement indisponibles pour le moment.')).not.toBeInTheDocument();
  });

  it('abonnements : seulement les statistiques agrégées en base, jamais la liste complète', async () => {
    stubApi();
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    await screen.findByText('3 agences à vérifier');
    const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input)).filter((url) => url.startsWith('/api/admin/subscriptions'));
    expect(urls).toEqual(['/api/admin/subscriptions?only=stats']);
  });

  it('mobile : la liste « À traiter » est en colonne unique explicite (sinon le texte tronqué élargit la page)', async () => {
    stubApi();
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    const list = (await screen.findByText('3 agences à vérifier')).closest('ul')!;
    expect(list.className).toMatch(/\bgrid-cols-1\b/);
    expect(list.className).toMatch(/\bmd:grid-cols-2\b/);
  });

  it('un montant n’est jamais tronqué : la valeur d’un indicateur peut passer à la ligne', async () => {
    stubApi();
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    await screen.findByText('3 agences à vérifier');
    const value = screen.getByText(/^1[\s.  ,]?284[\s.  ,]?500$/);
    expect(value.className).not.toMatch(/\btruncate\b/);
    expect(value.parentElement!.className).toMatch(/\bflex-wrap\b/);
  });
});

describe('Vue d’ensemble admin — une donnée inconnue n’est jamais présentée comme zéro', () => {
  it('abonnements en échec : « — » et un message, jamais « 0 DH / mois » ni « Aucun forfait actif »', async () => {
    stubApi({ subscriptions: 'fail' });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(await screen.findByText('Données d’abonnement indisponibles pour le moment.')).toBeInTheDocument();
    expect(screen.getByText('Répartition indisponible pour le moment.')).toBeInTheDocument();
    expect(screen.queryByText(/DH \/ mois/)).not.toBeInTheDocument();
    expect(screen.queryByText('Aucun forfait actif pour le moment.')).not.toBeInTheDocument();
    expect(screen.queryByText(/0 agence abonnée/)).not.toBeInTheDocument();
  });

  it('abonnements réels à zéro : le zéro est affiché comme tel', async () => {
    stubApi({ subscriptions: { success: true, data: { stats: { monthlyRecurringRevenue: 0, activeSubscribers: 0, fleetCapacityTotal: 0, plansDistribution: [] }, subscriptions: [] } } });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(await screen.findByText('Aucun forfait actif pour le moment.')).toBeInTheDocument();
    expect(screen.getByText(/DH \/ mois/)).toBeInTheDocument();
  });

  it('aucune statistique (échec de chargement) : « — » et « Indisponible » sur les indicateurs, pas des 0', async () => {
    stubApi({ stats: 'fail', overview: 'fail', health: 'fail', subscriptions: 'fail' });
    render(<AdminOverviewClient initialStats={null} statsError="Erreur de chargement" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('réseau indisponible');
    await waitFor(() => expect(screen.getAllByText('Indisponible pour le moment').length).toBeGreaterThanOrEqual(4));
    for (const label of ['Agences vérifiées', 'Véhicules référencés', 'Réservations', 'Volume d’affaires']) {
      const card = kpi(label);
      expect(within(card).getByText('—')).toBeInTheDocument();
      expect(card.textContent).not.toMatch(/\b0\b/);
    }
  });

  it('lecture des réservations en échec : jamais « Tout est à jour » (on ne sait pas ce qui attend l’admin)', async () => {
    stubApi({ overview: 'fail' });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/Tout est à jour/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'À traiter', hidden: true })).not.toBeInTheDocument();
    // Les listes disent qu'elles n'ont pas pu être chargées au lieu de prétendre « Aucune réservation / agence »
    expect(screen.getAllByText('Données indisponibles')).toHaveLength(2);
    expect(screen.queryByText('Aucune réservation')).not.toBeInTheDocument();
    expect(screen.queryByText('Aucune agence en attente de vérification.')).not.toBeInTheDocument();
  });

  it('rien à traiter et services vérifiés : message de confirmation ; services non vérifiables : il ne prétend pas qu’ils répondent', async () => {
    stubApi({ overview: { success: true, data: calm } });
    const { unmount } = render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(
      await screen.findByText('Tout est à jour : aucune agence, réservation, message de contact ou demande de formule en attente, tous les services répondent.')
    ).toBeInTheDocument();
    unmount();

    stubApi({ overview: { success: true, data: calm }, health: 'fail' });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(
      await screen.findByText('Aucune agence, réservation, message de contact ou demande de formule en attente. L’état des services n’a pas pu être vérifié.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/tous les services répondent/)).not.toBeInTheDocument();
  });
});

describe('Vue d’ensemble admin — messages de contact et demandes de formule à traiter', () => {
  const todo = async (name: RegExp | string) => (await screen.findByRole('link', { name })) as HTMLAnchorElement;

  it('affiche les messages non traités et les demandes de formule, avec leur lien', async () => {
    stubApi({ overview: { success: true, data: overview({ contactMessages: { count: 4 }, planRequests: { count: 2 } }) } });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(await todo(/4 nouveaux messages de contact/)).toHaveAttribute('href', '/admin/messages');
    expect(await todo(/2 demandes de changement de formule/)).toHaveAttribute('href', '/admin/finance');
  });

  it('le singulier est accordé', async () => {
    stubApi({ overview: { success: true, data: overview({ contactMessages: { count: 1 }, planRequests: { count: 1 } }) } });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(await todo(/^1 nouveau message de contact/)).toBeInTheDocument();
    expect(await todo(/^1 demande de changement de formule/)).toBeInTheDocument();
  });

  it('à zéro : ni message ni demande n’apparaissent dans la liste', async () => {
    stubApi();
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    await screen.findByText('3 agences à vérifier');
    expect(screen.queryByText(/message de contact/)).not.toBeInTheDocument();
    expect(screen.queryByText(/changement de formule/)).not.toBeInTheDocument();
  });

  it('seuls des messages en attente : la rubrique n’est plus « Tout est à jour »', async () => {
    stubApi({ overview: { success: true, data: overview({ ...calm, contactMessages: { count: 2 } }) } });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(await todo(/2 nouveaux messages de contact/)).toBeInTheDocument();
    expect(screen.queryByText(/Tout est à jour :/)).not.toBeInTheDocument();
  });

  it('lecture impossible : ni tuile, ni « à jour » qui prétendrait le contraire, et le message le dit', async () => {
    stubApi({ overview: { success: true, data: overview({ ...calm, contactMessages: { count: 0, unavailable: true } }) } });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(
      await screen.findByText(/Rien à traiter parmi les éléments lus : aucune agence, réservation ou demande de formule en attente\. Lecture impossible pour le moment : messages de contact\./)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tout est à jour :/)).not.toBeInTheDocument();
    expect(screen.queryByText(/message de contact\b.*à traiter/)).not.toBeInTheDocument();
  });

  it('droit de lecture absent : la rubrique est omise du message, sans tuile « 0 »', async () => {
    stubApi({
      overview: {
        success: true,
        data: overview({ ...calm, pendingAgencies: { count: 0, items: [], restricted: true }, contactMessages: { count: 0, restricted: true }, planRequests: { count: 0, restricted: true } }),
      },
    });
    render(<AdminOverviewClient initialStats={stats} statsError={null} />);
    expect(await screen.findByText('Tout est à jour : aucune réservation en attente, tous les services répondent.')).toBeInTheDocument();
    // La carte des agences à vérifier ne prétend pas qu'il n'y en a aucune
    expect(screen.getByText('Accès restreint')).toBeInTheDocument();
    expect(screen.queryByText('Aucune agence en attente de vérification.')).not.toBeInTheDocument();
  });
});
