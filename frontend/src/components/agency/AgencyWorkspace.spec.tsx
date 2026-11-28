// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Next relit l'adresse (useSearchParams) à chaque pushState / replaceState ; on reproduit ce lien pour
 * tester le parcours réel : tableau de bord → « À traiter » → liste filtrée.
 */
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (callback: () => void) => {
    window.addEventListener('locationchange', callback);
    // « Retour » du navigateur : Next relit aussi l'adresse
    window.addEventListener('popstate', callback);
    return () => {
      window.removeEventListener('locationchange', callback);
      window.removeEventListener('popstate', callback);
    };
  };
  return {
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search, () => '')),
  };
});
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/auth/client', () => ({ signOutEverywhere: vi.fn() }));

import { AgencyWorkspace } from './AgencyWorkspace';

const bookingRow = (n: number, status: string) => ({
  id: `b${n}`, booking_ref: `CD-2611-00${40 + n}`, reference: null, vehicle_id: `v${n}`, customer_name: `Client ${n}`,
  start_date: '2026-11-15', end_date: '2026-11-18', total_days: 3, total_price: 1200, commission_rate: 0, commission_amount: 0,
  agency_amount: 1200, status, created_at: '2026-10-01T09:00:00Z', vehicle: { id: `v${n}`, brand: 'Dacia', model: 'Logan', category: 'ECONOMY' },
});

// 3 demandes attendent une réponse ; l'indicateur de la période n'en compte aucune (demandes plus anciennes)
const PENDING_ROWS = [1, 2, 3].map((n) => bookingRow(n, 'REQUESTED'));
const ALL_ROWS = [...PENDING_ROWS, bookingRow(4, 'APPROVED'), bookingRow(5, 'COMPLETED')];

let listRequests: URLSearchParams[] = [];
// La lecture de la formule échoue tant que le test ne la « répare » pas
let subscriptionOk = false;

function stubApi() {
  listRequests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (url.pathname.endsWith('/subscription')) {
        return subscriptionOk
          ? json({
              success: true,
              data: {
                id: 's1', agency_id: 'ag-1', plan: { name: 'Pro' }, status: 'ACTIVE', current_vehicles_count: 12, vehicle_capacity: 30,
                capacity_usage_pct: 40, is_at_capacity: false, can_add_vehicle: true,
              },
            })
          : json({ success: false }, 500);
      }
      if (url.pathname === '/api/auth/me') return json({ success: true, user: {} });
      if (url.pathname.endsWith('/dashboard')) {
        return json({
          data: {
            stats: {
              totalVehicles: 12, availableVehicles: 4, reservedVehicles: 2, rentedVehicles: 5, maintenanceVehicles: 1,
              pendingBookings: 0, confirmedBookings: 7, completedBookings: 41, cancelledBookings: 6,
              grossRevenue: 98400, occupancyRate: 42,
            },
            agenda: { upcomingPickups: [], upcomingReturns: [], recentActivity: [] },
          },
        });
      }
      if (/\/api\/agencies\/[^/]+\/bookings$/.test(url.pathname)) {
        listRequests.push(url.searchParams);
        const rows = url.searchParams.get('status') === 'TO_PROCESS' ? PENDING_ROWS : ALL_ROWS;
        const size = Number(url.searchParams.get('pageSize') ?? 15);
        return json({ success: true, data: rows.slice(0, size), meta: { page: 1, pageSize: size, total: rows.length, totalPages: 1 } });
      }
      if (/\/api\/agencies\/[^/]+\/vehicles/.test(url.pathname)) return json({ success: true, data: [], meta: { typeCounts: { CAR: 10, MOTORCYCLE: 2 } } });
      if (url.pathname.startsWith('/api/bookings/')) return json({ booking: ALL_ROWS.find((row) => url.pathname.endsWith(row.booking_ref)) });
      return json({}, 404);
    })
  );
}

const realPush = window.history.pushState.bind(window.history);
const realReplace = window.history.replaceState.bind(window.history);

beforeEach(() => {
  window.history.pushState = (...args) => {
    realPush(...args);
    window.dispatchEvent(new Event('locationchange'));
  };
  window.history.replaceState = (...args) => {
    realReplace(...args);
    window.dispatchEvent(new Event('locationchange'));
  };
  realReplace(null, '', '/agency');
  subscriptionOk = false;
  stubApi();
});

afterEach(() => {
  window.history.pushState = realPush;
  window.history.replaceState = realReplace;
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <AgencyWorkspace
      agency={{ id: 'ag-1', name: 'Atlas Rent Oujda', verified: true, logoUrl: null }}
      profile={{ role: 'AGENCY_OWNER', email: 'a@b.c', displayName: 'Youssef', avatarUrl: null }}
    />
  );

const statusSelect = () => screen.findByRole('combobox', { name: 'Filtrer par statut' });
const lastListStatus = () => listRequests.filter((params) => params.get('pageSize') !== '1').at(-1)?.get('status') ?? null;

describe('Espace agence — « À traiter » mène aux demandes à traiter', () => {
  it('le compteur vient du serveur (toute la file), pas de l’indicateur de la période : la demande ancienne compte', async () => {
    mount();
    // L'indicateur de la période dit 0, le serveur compte 3 demandes en attente
    expect(await screen.findByRole('button', { name: /3 demandes de réservation attendent votre réponse/ })).toBeInTheDocument();
    const nav = within(screen.getByRole('complementary', { name: 'Navigation du portail agence' }));
    expect(nav.getByRole('button', { name: /Réservations/ })).toHaveTextContent('3');
  });

  it('cliquer sur l’indicateur « À traiter » ouvre la liste filtrée, adresse comprise', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /^À traiter/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Réservations' })).toBeInTheDocument();
    expect(window.location.search).toBe('?section=bookings&status=TO_PROCESS');
    expect(await statusSelect()).toHaveValue('TO_PROCESS');
    await waitFor(() => expect(lastListStatus()).toBe('TO_PROCESS'));
    // Seules les demandes à traiter sont listées (pas les réservations confirmées ni terminées)
    const cards = await screen.findByRole('list', { name: 'Réservations de votre agence' });
    expect(within(cards).getAllByRole('listitem')).toHaveLength(3);
    expect(within(cards).queryByText('Confirmée')).not.toBeInTheDocument();
  });

  it('l’alerte « Répondre » mène à la même liste filtrée', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /attendent votre réponse/ }));
    expect(window.location.search).toBe('?section=bookings&status=TO_PROCESS');
    expect(await statusSelect()).toHaveValue('TO_PROCESS');
  });

  it('la navigation « Réservations » du menu montre toutes les réservations (filtre retiré de l’adresse)', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /^À traiter/ }));
    expect(await statusSelect()).toHaveValue('TO_PROCESS');

    const nav = within(screen.getByRole('complementary', { name: 'Navigation du portail agence' }));
    await user.click(nav.getByRole('button', { name: /Réservations/ }));
    await waitFor(() => expect(window.location.search).toBe('?section=bookings'));
    expect(await statusSelect()).toHaveValue('');
    await waitFor(() => expect(lastListStatus()).toBeNull());
  });
});

describe('Espace agence — « Réduire » la barre latérale', () => {
  beforeEach(() => window.localStorage.clear());

  it('réduit puis déplie le menu, et la préférence est retenue au rechargement', async () => {
    const user = userEvent.setup();
    const view = mount();
    const sidebar = () => screen.getByRole('complementary', { name: 'Navigation du portail agence' });
    await screen.findByRole('button', { name: /^À traiter/ });

    await user.click(within(sidebar()).getByRole('button', { name: 'Réduire' }));
    expect(sidebar().className).toMatch(/\bw-19\b/);
    expect(within(sidebar()).queryByText('Atlas Rent Oujda')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('clickdrive:agency-sidebar-collapsed')).toBe('1');

    // Rechargement : le menu reste réduit
    view.unmount();
    mount();
    await screen.findByRole('button', { name: /^À traiter/ });
    const expand = within(sidebar()).getByRole('button', { name: 'Déplier le menu' });
    await user.click(expand);
    expect(sidebar().className).toMatch(/\bw-64\b/);
    expect(within(sidebar()).getByText('Atlas Rent Oujda')).toBeInTheDocument();
  });

  it('la section « Statistiques » est dans le menu', async () => {
    mount();
    await screen.findByRole('button', { name: /^À traiter/ });
    expect(within(screen.getByRole('complementary', { name: 'Navigation du portail agence' })).getByRole('button', { name: 'Statistiques' })).toBeInTheDocument();
  });
});

describe('Espace agence — le filtre de statut est dans l’adresse', () => {
  it('une adresse partagée (?status=TO_PROCESS) charge directement la liste filtrée', async () => {
    realReplace(null, '', '/agency?section=bookings&status=TO_PROCESS');
    mount();
    expect(await statusSelect()).toHaveValue('TO_PROCESS');
    await waitFor(() => expect(lastListStatus()).toBe('TO_PROCESS'));
    // Pas de chargement préalable de la liste complète
    expect(listRequests.filter((params) => params.get('pageSize') !== '1').every((params) => params.get('status') === 'TO_PROCESS')).toBe(true);
  });

  it('un statut inconnu dans l’adresse est ignoré (liste complète)', async () => {
    realReplace(null, '', '/agency?section=bookings&status=N_IMPORTE_QUOI');
    mount();
    expect(await statusSelect()).toHaveValue('');
    await waitFor(() => expect(lastListStatus()).toBeNull());
  });

  it('choisir un statut dans la liste met à jour l’adresse sans ajouter d’entrée d’historique', async () => {
    const user = userEvent.setup();
    realReplace(null, '', '/agency?section=bookings');
    const historyBefore = window.history.length;
    mount();
    await user.selectOptions(await statusSelect(), 'APPROVED');
    expect(window.location.search).toBe('?section=bookings&status=APPROVED');
    expect(window.history.length).toBe(historyBefore);
    await waitFor(() => expect(lastListStatus()).toBe('APPROVED'));
  });

  it('quitter les réservations puis y revenir (Précédent) : le champ affiche le filtre réellement appliqué', async () => {
    realReplace(null, '', '/agency?section=bookings&status=TO_PROCESS');
    mount();
    expect(await statusSelect()).toHaveValue('TO_PROCESS');
    window.history.pushState(null, '', '/agency?section=fleet');
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Filtrer par statut' })).not.toBeInTheDocument());
    window.history.pushState(null, '', '/agency?section=bookings&status=TO_PROCESS');
    // Avant la correction, le champ repartait de « Tous les statuts » alors que la liste restait filtrée
    expect(await statusSelect()).toHaveValue('TO_PROCESS');
    await waitFor(() => expect(lastListStatus()).toBe('TO_PROCESS'));
  });

  it('ouvrir puis fermer un dossier garde le filtre dans l’adresse', async () => {
    const user = userEvent.setup();
    realReplace(null, '', '/agency?section=bookings&status=TO_PROCESS');
    mount();
    const cards = await screen.findByRole('list', { name: 'Réservations de votre agence' });
    await user.click(within(cards).getByRole('button', { name: 'Ouvrir la réservation CD-2611-0041' }));
    await waitFor(() => expect(window.location.search).toBe('?section=bookings&status=TO_PROCESS&booking=CD-2611-0041'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(window.location.search).toBe('?section=bookings&status=TO_PROCESS'));
  });
});

describe('Espace agence — téléphone', () => {
  it('la barre de navigation du bas n’est pas dans l’en-tête (son flou la placerait en haut de l’écran)', async () => {
    mount();
    await screen.findByRole('button', { name: /^À traiter/ });
    const bottomNav = screen.getByRole('navigation', { name: 'Sections du tableau de bord' });
    expect(bottomNav.closest('header')).toBeNull();
    expect(bottomNav.className).toMatch(/\bfixed\b.*\bbottom-0\b/);
  });

  it('« Retour » (geste Android) ferme le dossier ouvert depuis la liste, sans quitter la section', async () => {
    const user = userEvent.setup();
    realReplace(null, '', '/agency?section=bookings&status=TO_PROCESS');
    mount();
    const cards = await screen.findByRole('list', { name: 'Réservations de votre agence' });
    await user.click(within(cards).getByRole('button', { name: 'Ouvrir la réservation CD-2611-0041' }));
    expect(await screen.findByRole('dialog', { name: /Dossier CD-2611-0041/ })).toBeInTheDocument();
    // L'ouverture a ajouté une entrée d'historique : « Retour » la consomme et revient à la liste filtrée

    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Dossier CD-2611-0041/ })).not.toBeInTheDocument());
    expect(window.location.search).toBe('?section=bookings&status=TO_PROCESS');
    expect(screen.getByRole('list', { name: 'Réservations de votre agence' })).toBeInTheDocument();
  });

  it('dossier ouvert par lien direct : « Fermer » retire la référence sans revenir en arrière', async () => {
    const user = userEvent.setup();
    realReplace(null, '', '/agency?section=bookings&booking=CD-2611-0042');
    const back = vi.spyOn(window.history, 'back');
    mount();
    const dialog = await screen.findByRole('dialog', { name: /Dossier CD-2611-0042/ });
    await user.click(within(dialog).getAllByRole('button', { name: 'Fermer' })[0]);
    await waitFor(() => expect(window.location.search).toBe('?section=bookings'));
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it('période : un seul sélecteur ; « Dates personnalisées… » affiche les dates', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('button', { name: /^À traiter/ });
    const period = screen.getByRole('combobox', { name: 'Période des indicateurs' });
    const datesBlock = () => screen.getByLabelText('Du').closest('div[class*="sm:block"]') as HTMLElement;
    const hidden = /(^|\s)hidden(\s|$)/;
    expect(datesBlock().className).toMatch(hidden);

    await user.selectOptions(period, 'custom');
    expect(datesBlock().className).not.toMatch(hidden);

    await user.selectOptions(period, '90d');
    await waitFor(() => {
      const last = vi
        .mocked(fetch)
        .mock.calls.map(([input]) => new URL(String(input), 'http://localhost'))
        .filter((url) => url.pathname.endsWith('/dashboard'))
        .at(-1)!;
      const days = (Date.parse(String(last.searchParams.get('to'))) - Date.parse(String(last.searchParams.get('from')))) / 86_400_000 + 1;
      expect(Math.round(days)).toBe(90);
    });
    expect(datesBlock().className).toMatch(hidden);
  });

  it('accueil : alertes et indicateurs avant la carte du forfait, sauf sur grand écran', async () => {
    subscriptionOk = true;
    mount();
    const kpi = await screen.findByRole('button', { name: /^À traiter/ });
    expect(kpi.closest('.order-1')).not.toBeNull();
    expect((await screen.findByText('Capacité du parc')).closest('.order-2')).not.toBeNull();
  });
});

describe('Espace agence — carte de capacité du parc', () => {
  it('l’abonnement ne charge pas : message et « Réessayer », jamais un cadre gris permanent', async () => {
    const user = userEvent.setup();
    mount();
    // Dès le premier rendu, le cadre d'attente occupe la place et est annoncé
    expect(screen.getByRole('status', { name: 'Chargement de la capacité du parc' })).toBeInTheDocument();

    expect(await screen.findByText('La capacité de votre parc n’a pas pu être chargée.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Chargement de la capacité du parc' })).not.toBeInTheDocument();
    // Le reste du tableau de bord reste utilisable
    expect(await screen.findByRole('button', { name: /^À traiter/ })).toBeInTheDocument();

    subscriptionOk = true;
    await user.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByText('Capacité du parc')).toBeInTheDocument();
    expect(screen.queryByText('La capacité de votre parc n’a pas pu être chargée.')).not.toBeInTheDocument();
  });

  it('abonnement chargé : la carte s’affiche, sans message d’erreur', async () => {
    subscriptionOk = true;
    mount();
    expect(await screen.findByText('Capacité du parc')).toBeInTheDocument();
    expect(screen.queryByText('La capacité de votre parc n’a pas pu être chargée.')).not.toBeInTheDocument();
  });
});
