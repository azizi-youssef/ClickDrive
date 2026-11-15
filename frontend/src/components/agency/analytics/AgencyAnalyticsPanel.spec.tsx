// @vitest-environment jsdom
import '@/tests/setup/dom';
import { fireEvent, render, screen, waitFor, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agencyReportJson, totals } from '@/tests/fixtures/analytics-report';
import { AgencyAnalyticsPanel } from './AgencyAnalyticsPanel';

const AGENCY = '11111111-1111-4111-8111-111111111111';
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ok(agencyReportJson()));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const vehicleCard = async () => (await screen.findByRole('heading', { name: 'Occupation et revenu par véhicule' })).closest('section')!;

describe('Statistiques de l’agence', () => {
  it('rapport de l’agence demandé pour la période', async () => {
    render(<AgencyAnalyticsPanel agencyId={AGENCY} agencyName="Agence Alpha" />);
    await vehicleCard();
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
    expect(url.pathname).toBe(`/api/stats/agency/${AGENCY}/analytics`);
    expect(url.searchParams.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('entonnoir : chaque étape avec son taux depuis la précédente', async () => {
    render(<AgencyAnalyticsPanel agencyId={AGENCY} agencyName="Agence Alpha" />);
    const card = (await screen.findByRole('heading', { name: 'Entonnoir des demandes' })).closest('section')!;
    // Graphique visible (le tableau équivalent, réservé aux lecteurs d'écran, répète les libellés)
    const steps = card.querySelector('ol')!;
    const accepted = within(steps).getByText('Acceptées').closest('li')!;
    expect(accepted).toHaveTextContent('30');
    expect(accepted).toHaveTextContent('75 % de l’étape précédente');
    const outcomes = card.querySelector('ul')!;
    expect(within(outcomes).getByText('Expirées sans réponse').closest('li')).toHaveTextContent('3(8 %)');
  });

  it('occupation par véhicule : véhicule sans location signalé, tri par occupation', async () => {
    const user = userEvent.setup();
    render(<AgencyAnalyticsPanel agencyId={AGENCY} agencyName="Agence Alpha" />);
    const card = await vehicleCard();
    // Tableau (grands écrans) ; le téléphone reçoit les mêmes véhicules en cartes
    const table = within(card).getByRole('table');
    const names = () => within(table).getAllByRole('rowheader').map((cell) => cell.textContent);
    expect(names()[0]).toContain('Dacia Logan');
    const idle = within(table).getByText('Renault Clio · A-2').closest('tr')!;
    expect(within(idle).getByText('Aucune location')).toBeInTheDocument();
    expect(idle).toHaveTextContent('archivé');

    await user.click(within(card).getByRole('button', { name: 'Par occupation' }));
    expect(names().map((name) => name?.split(/Économique|Scooter/)[0])).toEqual(['Yamaha NMAX', 'Dacia Logan · 1234-A-50', 'Renault Clio · A-2']);
  });

  it('téléphone : une carte par véhicule (revenu, occupation, nuits), même tri que le tableau', async () => {
    const user = userEvent.setup();
    render(<AgencyAnalyticsPanel agencyId={AGENCY} agencyName="Agence Alpha" />);
    const card = await vehicleCard();
    const list = within(card).getByRole('list', { name: 'Véhicules de la flotte' });
    expect(list.className).toMatch(/(^|\s)sm:hidden(\s|$)/);
    expect(within(card).getByRole('table').parentElement!.className).toMatch(/(^|\s)hidden(\s|$).*(^|\s)sm:block(\s|$)/);
    const items = () => within(list).getAllByRole('listitem');
    expect(items()[0]).toHaveTextContent('Dacia Logan · 1234-A-50');
    expect(items()[0]).toHaveTextContent(/20\s000\sDH/);
    expect(items()[0]).toHaveTextContent('24 / 30 nuits');
    expect(within(items()[2]).getByText('Aucune location')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Par occupation' }));
    expect(items()[0]).toHaveTextContent('Yamaha NMAX');
  });

  it('peu de réponses : pas de médiane affichée', async () => {
    fetchMock.mockResolvedValue(ok(agencyReportJson({ current: totals({ responsesMeasured: 2 }) })));
    render(<AgencyAnalyticsPanel agencyId={AGENCY} agencyName="Agence Alpha" />);
    expect((await screen.findAllByText('Pas assez de réponses')).length).toBeGreaterThanOrEqual(2);
  });

  it('période personnalisée : dates inversées refusées avant tout appel', async () => {
    const user = userEvent.setup();
    render(<AgencyAnalyticsPanel agencyId={AGENCY} agencyName="Agence Alpha" />);
    await vehicleCard();
    await user.click(screen.getByRole('button', { name: 'Personnalisée' }));
    const from = screen.getByLabelText('Du');
    const to = screen.getByLabelText('Au');
    fireEvent.change(from, { target: { value: '2026-10-30' } });
    fireEvent.change(to, { target: { value: '2026-10-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('La date de début doit précéder la date de fin.');
    expect(screen.getByRole('button', { name: 'Appliquer' })).toBeDisabled();

    fireEvent.change(to, { target: { value: '2026-10-31' } });
    await user.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const url = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost');
    expect([url.searchParams.get('from'), url.searchParams.get('to')]).toEqual(['2026-10-30', '2026-10-31']);
  });

  it('erreur de chargement : message et nouvel essai', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'Accès refusé' }), { status: 403 }));
    const user = userEvent.setup();
    render(<AgencyAnalyticsPanel agencyId={AGENCY} agencyName="Agence Alpha" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Accès refusé');
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    await vehicleCard();
  });

  it('flotte vide : état vide explicite', async () => {
    const report = agencyReportJson();
    (report.fleet as { items: unknown[] }).items = [];
    fetchMock.mockResolvedValue(ok(report));
    render(<AgencyAnalyticsPanel agencyId={AGENCY} agencyName="Agence Alpha" />);
    const card = await vehicleCard();
    expect(within(card).getByText('Aucun véhicule dans la flotte sur cette période.')).toBeInTheDocument();
  });
});
