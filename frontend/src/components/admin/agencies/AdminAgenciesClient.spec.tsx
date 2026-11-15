// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminAgency } from '@/lib/api/admin-dashboard.api';
import { AdminAgenciesClient } from './AdminAgenciesClient';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const agency = (overrides: Partial<AdminAgency> = {}): AdminAgency =>
  ({
    id: 'ag-1',
    name: 'Atlas Rent Oujda',
    email: 'contact@atlas.test',
    phone: '0536 00 00 01',
    whatsapp: '0536 00 00 01',
    address: '1 rue du Test',
    city: 'Oujda',
    status: 'ACTIVE',
    verified: true,
    created_at: '2026-03-12T10:00:00.000Z',
    vehicle_count: 12,
    archived_at: null,
    ...overrides,
  }) as AdminAgency;

const ACTIVE = agency();
const SUSPENDED = agency({ id: 'ag-2', name: 'Rif Cars Nador', email: 'rif@cars.test', city: 'Nador', status: 'SUSPENDED', vehicle_count: null });
const ARCHIVED = agency({ id: 'ag-3', name: 'Ancienne Agence', email: 'old@agence.test', city: 'Berkane', status: 'SUSPENDED', archived_at: '2026-01-01T00:00:00.000Z' });

const subscriptions = { subscriptions: [{ agency_id: 'ag-1', plan: { name: 'Pro' } }] };

type FetchCall = { url: string; method: string };

/** API simulée ; renvoie la liste des appels pour vérifier ce qui est réellement envoyé */
function stubApi(agencies: AdminAgency[], opts: { listFails?: boolean } = {}) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (url.startsWith('/api/admin/agencies?')) {
        if (opts.listFails) throw new Error('réseau indisponible');
        return new Response(JSON.stringify({ success: true, data: agencies, meta: { total: agencies.length, totalPages: 1 } }), { status: 200 });
      }
      if (url.startsWith('/api/admin/subscriptions')) return new Response(JSON.stringify({ success: true, data: subscriptions }), { status: 200 });
      if (method === 'PATCH') return new Response(JSON.stringify({ success: true, data: { ...ACTIVE } }), { status: 200 });
      return new Response('{}', { status: 404 });
    })
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const list = () => screen.findByRole('list', { name: 'Agences partenaires' });
const table = () => screen.findByRole('table');

describe('Agences — mise en page responsive (cartes / tableau)', () => {
  it('le tableau n’impose plus de largeur minimale : plus de « Statut » et « Actions » hors écran', async () => {
    stubApi([ACTIVE]);
    render(<AdminAgenciesClient />);
    const t = await table();
    expect(t.className).not.toMatch(/min-w-\[/);
    // Le tableau est dans un conteneur masqué sous 56 rem, la liste de cartes l’inverse (container queries)
    expect(t.closest('div.hidden')!.className).toMatch(/@4xl:block/);
    expect((await list()).className).toMatch(/@4xl:hidden/);
    expect(t.closest('.\\@container')).not.toBeNull();
  });

  it('les colonnes secondaires se masquent, jamais Agence, Ville & Contact, Statut ni Actions', async () => {
    stubApi([ACTIVE]);
    render(<AdminAgenciesClient />);
    const t = await table();
    const headers = within(t).getAllByRole('columnheader', { hidden: true });
    const byName = (name: string) => headers.find((h) => h.textContent === name)!;
    for (const always of ['Agence & Compte', 'Ville & Contact', 'Statut', 'Actions']) {
      expect(byName(always).className).not.toMatch(/\bhidden\b/);
    }
    for (const optional of ['Flotte', 'Forfait', 'Créée le']) {
      expect(byName(optional).className).toMatch(/\bhidden\b/);
    }
  });

  it('chaque agence est présente en carte ET en ligne, avec statut, forfait et date', async () => {
    stubApi([ACTIVE, SUSPENDED]);
    render(<AdminAgenciesClient />);
    const cards = within(await list());
    expect(await cards.findAllByRole('listitem')).toHaveLength(2);
    const card = within(cards.getAllByRole('listitem')[0]!);
    expect(card.getByText('Atlas Rent Oujda')).toBeInTheDocument();
    expect(card.getByText('Active')).toBeInTheDocument();
    expect(card.getByText('Pro')).toBeInTheDocument();
    expect(card.getByText('12')).toBeInTheDocument();
    expect(card.getByText(/12 mars 2026|12 mar/)).toBeInTheDocument();

    const rows = within(await table()).getAllByRole('row', { hidden: true });
    expect(rows).toHaveLength(3); // en-tête + 2 agences
    // « Non transmis » : une flotte inconnue n’est jamais affichée comme 0
    expect(within(rows[2]!).getByText('Non transmis')).toBeInTheDocument();
    expect(within(rows[2]!).queryByText('0')).not.toBeInTheDocument();
  });

  it('chargement : cartes et lignes d’attente ont autant de colonnes que le tableau (il ne s’élargit pas)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(<AdminAgenciesClient />);
    const t = await table();
    const headerCount = within(t).getAllByRole('columnheader', { hidden: true }).length;
    const skeleton = t.querySelector('tbody tr')!;
    expect(skeleton.querySelectorAll('td')).toHaveLength(headerCount);
    expect(screen.getByRole('list', { name: 'Agences partenaires' })).toHaveAttribute('aria-busy', 'true');
  });

  it('aucune agence : un seul message vide (pas un tableau vide), avec l’action de création', async () => {
    stubApi([]);
    render(<AdminAgenciesClient />);
    expect(await screen.findByText('Aucune agence trouvée')).toBeInTheDocument();
    expect(screen.getAllByText('Aucune agence trouvée')).toHaveLength(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter la première agence' })).toBeInTheDocument();
  });

  it('échec du chargement : message d’erreur, jamais « Aucune agence trouvée »', async () => {
    stubApi([], { listFails: true });
    render(<AdminAgenciesClient />);
    expect(await screen.findByRole('alert')).toHaveTextContent('réseau indisponible');
  });
});

describe('Agences — actions (cartes et tableau)', () => {
  it('chaque bouton porte un nom qui contient l’agence : « Modifier » n’existe pas 15 fois sans contexte', async () => {
    stubApi([ACTIVE, SUSPENDED]);
    render(<AdminAgenciesClient />);
    const cards = within(await list());
    for (const name of ['Atlas Rent Oujda', 'Rif Cars Nador']) {
      expect(await cards.findByRole('button', { name: `Modifier ${name}` })).toBeInTheDocument();
      expect(cards.getByRole('button', { name: `Réinitialiser le mot de passe de ${name}` })).toBeInTheDocument();
      expect(cards.getByRole('button', { name: `Supprimer ou archiver ${name}` })).toBeInTheDocument();
    }
    expect(cards.getByRole('button', { name: 'Suspendre Atlas Rent Oujda' })).toBeInTheDocument();
    expect(cards.getByRole('button', { name: 'Activer Rif Cars Nador' })).toBeInTheDocument();
    // Même ensemble de gestes dans le tableau
    const rows = within(await table());
    expect(rows.getByRole('button', { name: 'Suspendre Atlas Rent Oujda', hidden: true })).toBeInTheDocument();
    expect(rows.getByRole('button', { name: 'Activer Rif Cars Nador', hidden: true })).toBeInTheDocument();
  });

  it('les boutons du tableau (icônes) ont un nom accessible et une info-bulle', async () => {
    stubApi([ACTIVE]);
    render(<AdminAgenciesClient />);
    const rows = within(await table());
    const reset = rows.getByRole('button', { name: 'Réinitialiser le mot de passe de Atlas Rent Oujda', hidden: true });
    expect(reset).toHaveAttribute('title', 'Réinitialiser le mot de passe');
    expect(reset.textContent).toBe(''); // icône seule
  });

  it('suspendre demande une confirmation : rien n’est envoyé avant, puis un seul PATCH', async () => {
    const user = userEvent.setup();
    const calls = stubApi([ACTIVE]);
    render(<AdminAgenciesClient />);
    await user.click(await within(await list()).findByRole('button', { name: 'Suspendre Atlas Rent Oujda' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Suspendre cette agence ?' });
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Suspendre l’agence' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toEqual([{ url: '/api/admin/agencies/ag-1', method: 'PATCH' }]));
  });

  it('annuler la confirmation n’envoie rien', async () => {
    const user = userEvent.setup();
    const calls = stubApi([ACTIVE]);
    render(<AdminAgenciesClient />);
    await user.click(await within(await list()).findByRole('button', { name: 'Suspendre Atlas Rent Oujda' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /Annuler/ }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
  });

  it('réactiver une agence suspendue est direct (pas de confirmation) et envoie le statut ACTIVE', async () => {
    const user = userEvent.setup();
    const calls = stubApi([SUSPENDED]);
    render(<AdminAgenciesClient />);
    await user.click(await within(await list()).findByRole('button', { name: 'Activer Rif Cars Nador' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/ag-2'))).toBe(true));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('une agence archivée garde « Modifier » et « Mot de passe » mais ne peut plus être suspendue ni supprimée', async () => {
    stubApi([ARCHIVED]);
    render(<AdminAgenciesClient />);
    const card = within(await list());
    expect(await card.findByText('Archivée')).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Modifier Ancienne Agence' })).toBeInTheDocument();
    expect(card.queryByRole('button', { name: /^(Suspendre|Activer) / })).not.toBeInTheDocument();
    expect(card.queryByRole('button', { name: /^Supprimer ou archiver/ })).not.toBeInTheDocument();
  });

  it('Modifier ouvre la fenêtre d’édition de la bonne agence', async () => {
    const user = userEvent.setup();
    stubApi([ACTIVE, SUSPENDED]);
    render(<AdminAgenciesClient />);
    await user.click(await within(await list()).findByRole('button', { name: 'Modifier Rif Cars Nador' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('Rif Cars Nador')).toBeInTheDocument();
  });
});
