// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, waitFor, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminReportJson } from '@/tests/fixtures/analytics-report';

const downloads = vi.hoisted(() => ({ calls: [] as { name: string; rows: readonly (readonly unknown[])[] }[] }));

vi.mock('@/lib/supabase/realtime', () => ({ useRealtimeRefresh: () => undefined }));
vi.mock('@/lib/export/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/export/csv')>()),
  downloadCsv: (name: string, rows: readonly (readonly unknown[])[]) => downloads.calls.push({ name, rows }),
}));

import { AdminAnalyticsClient } from './AdminAnalyticsClient';

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  downloads.calls = [];
  fetchMock = vi.fn(async () => ok(adminReportJson()));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const requestedUrl = (index: number) => new URL(String(fetchMock.mock.calls[index][0]), 'http://localhost');

describe('Statistiques plateforme', () => {
  it('squelette, puis rapport de la période par défaut (30 jours) demandé à l’API', async () => {
    render(<AdminAnalyticsClient />);
    expect(screen.getByRole('status', { name: 'Chargement des statistiques' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Revenu récurrent mensuel (MRR plateforme)' })).toBeInTheDocument();

    const url = requestedUrl(0);
    expect(url.pathname).toBe('/api/admin/analytics');
    const from = new Date(`${url.searchParams.get('from')}T00:00:00`);
    const to = new Date(`${url.searchParams.get('to')}T00:00:00`);
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1).toBe(30);
  });

  it('MRR, adoption et mouvement du mois', async () => {
    render(<AdminAnalyticsClient />);
    const banner = (await screen.findByRole('heading', { name: 'Revenu récurrent mensuel (MRR plateforme)' })).closest('section')!;
    expect(within(banner).getByText(/1\s500\sDH/)).toBeInTheDocument();
    expect(banner).toHaveTextContent(/4 agences abonnées \(67 % du réseau actif\)/);
    expect(banner).toHaveTextContent(/octobre 2026 : \+200\sDH net/);
    expect(banner).toHaveTextContent('1 en essai');
  });

  it('indicateurs comparés à la période précédente', async () => {
    render(<AdminAnalyticsClient />);
    const tile = (await screen.findByRole('heading', { name: 'Demandes reçues' })).closest('article')!;
    expect(tile).toHaveTextContent('40');
    expect(tile).toHaveTextContent(/\+8 \(\+25 %\) vs période préc\./);
    const response = screen.getByRole('heading', { name: 'Délai de réponse médian' }).closest('article')!;
    expect(response).toHaveTextContent('42 min');
    // Délai en baisse : bonne nouvelle, affichée comme telle
    expect(within(response).getByText(/−18 min/)).toHaveClass('text-emerald-700');
  });

  it('changer de période recharge le rapport sans effacer l’écran', async () => {
    const user = userEvent.setup();
    render(<AdminAnalyticsClient />);
    await screen.findByRole('heading', { name: 'Entonnoir des demandes' });

    await user.click(screen.getByRole('button', { name: '90 jours' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const url = requestedUrl(1);
    const days = (Date.parse(String(url.searchParams.get('to'))) - Date.parse(String(url.searchParams.get('from')))) / 86_400_000 + 1;
    expect(Math.round(days)).toBe(90);
    expect(screen.getByRole('heading', { name: 'Entonnoir des demandes' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Chargement des statistiques' })).not.toBeInTheDocument();
  });

  it('erreur : message et nouvel essai', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'Accès refusé' }), { status: 403 }));
    const user = userEvent.setup();
    render(<AdminAnalyticsClient />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Accès refusé');
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { name: 'Entonnoir des demandes' })).toBeInTheDocument();
  });

  it('tendance : mois vide sans barre, mois en cours signalé, repère « un an plus tôt », tableau d’un clic', async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminAnalyticsClient />);
    const card = (await screen.findByRole('heading', { name: 'Demandes par mois' })).closest('section')!;
    expect(within(card).getAllByText('en cours')).toHaveLength(1);
    expect(card.querySelectorAll('[data-bar="value"]')).toHaveLength(11);
    expect(card.querySelectorAll('[data-bar="previous-year"]')).toHaveLength(12);
    // Le tableau reste lisible au lecteur d'écran pendant que le graphique est affiché
    expect(within(card).getByRole('table', { name: 'Demandes et chiffre d’affaires par mois' })).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Tableau' }));
    const table = within(card).getByRole('table', { name: 'Demandes et chiffre d’affaires par mois' });
    expect(within(table).getByRole('rowheader', { name: 'oct. 26 (en cours)' })).toBeInTheDocument();
    expect(card.querySelectorAll('[data-bar="value"]')).toHaveLength(0);
    expect(container).toBeTruthy();
  });

  it('classement : note absente = « Aucun avis », médiane masquée sous 3 réponses', async () => {
    render(<AdminAnalyticsClient />);
    const row = (await screen.findByRole('rowheader', { name: 'Agence Sans Avis' })).closest('tr')!;
    expect(within(row).getByText('Aucun avis')).toBeInTheDocument();
    expect(within(row).queryByText(/\/ 5/)).not.toBeInTheDocument();
    expect(within(row).queryByText(/min/)).not.toBeInTheDocument();
    const alpha = screen.getByRole('rowheader', { name: 'Agence Alpha' }).closest('tr')!;
    expect(alpha).toHaveTextContent('80 %');
    expect(alpha).toHaveTextContent('35 min');
    expect(alpha).toHaveTextContent('4.6 / 5');
    expect(screen.getByText(/2 agences actives sans aucune demande/)).toBeInTheDocument();
  });

  it('export CSV du rapport affiché', async () => {
    const user = userEvent.setup();
    render(<AdminAnalyticsClient />);
    await screen.findByRole('heading', { name: 'Entonnoir des demandes' });
    await user.click(screen.getByRole('button', { name: /Exporter CSV/ }));
    expect(downloads.calls).toHaveLength(1);
    expect(downloads.calls[0].name).toMatch(/^clickdrive-statistiques-2026-10-01-au-2026-10-30-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(downloads.calls[0].rows).toContainEqual(['MRR (DH par mois)', 1500]);
  });

  it('aucune demande sur la période : états vides explicites', async () => {
    const empty = adminReportJson();
    Object.assign(empty.current, { requests: 0, accepted: 0, pickedUp: 0, returned: 0 });
    empty.agencies = [];
    empty.breakdowns = { vehicleTypes: [], categories: [], pickupLocations: [], countries: [], locales: [] };
    fetchMock.mockResolvedValue(ok(empty));
    render(<AdminAnalyticsClient />);
    expect(await screen.findByText('Aucune demande reçue sur la période.', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getAllByText('Aucune donnée sur la période.').length).toBe(4);
  });
});
