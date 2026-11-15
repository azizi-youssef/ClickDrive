// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BookingsPanel,
  formatBookingPeriod,
  type AgencyBookingRow,
  type BookingQuery,
  type BookingsPage,
} from './BookingsPanel';

const row = (overrides: Partial<AgencyBookingRow> = {}): AgencyBookingRow => ({
  id: 'b1',
  booking_ref: 'CD-2611-0041',
  reference: null,
  vehicle_id: 'v1',
  customer_name: 'Nadia Chraibi',
  start_date: '2026-11-15',
  end_date: '2026-11-18',
  total_days: 3,
  total_price: 1350,
  commission_rate: 0,
  commission_amount: 0,
  agency_amount: 1350,
  status: 'REQUESTED',
  created_at: '2026-11-14T09:00:00Z',
  vehicle: { id: 'v1', brand: 'Dacia', model: 'Logan', category: 'ECONOMY' },
  ...overrides,
});

const WAITING = row();
const CONFIRMED = row({ id: 'b2', booking_ref: 'CD-2611-0042', customer_name: 'Omar Haddad', status: 'APPROVED', total_days: 1 });

const pageOf = (data: AgencyBookingRow[]): BookingsPage => ({ data, meta: { page: 1, pageSize: 15, total: data.length, totalPages: 1 } });
const baseQuery: BookingQuery = { q: '', status: '', sort: 'created_at' };

function setup(props: Partial<React.ComponentProps<typeof BookingsPanel>> = {}) {
  const handlers = { onQueryChange: vi.fn(), onPageChange: vi.fn(), onRetry: vi.fn(), onOpenDetail: vi.fn() };
  const view = render(
    <BookingsPanel page={pageOf([WAITING, CONFIRMED])} loading={false} error={null} query={baseQuery} canAct busy={false} {...handlers} {...props} />
  );
  return { ...view, ...handlers };
}

afterEach(() => vi.useRealTimers());

describe('Réservations de l’agence — cartes et tableau', () => {
  it('le tableau n’a plus de largeur minimale : « Statut » et « Ouvrir » ne sortent plus de l’écran', () => {
    setup();
    const table = screen.getByRole('table', { hidden: true });
    expect(table.className).not.toMatch(/min-w-\[/);
    // Tableau masqué sous 56 rem de largeur utile, cartes l'inverse (container queries)
    expect(table.closest('div.hidden')!.className).toMatch(/@4xl:block/);
    expect(screen.getByRole('list', { name: 'Réservations de votre agence' }).className).toMatch(/@4xl:hidden/);
    expect(table.closest('.\\@container')).not.toBeNull();
  });

  it('chaque réservation est présente en carte et en ligne, avec statut, période formatée et montant', () => {
    setup();
    const card = within(within(screen.getByRole('list', { name: 'Réservations de votre agence' })).getAllByRole('listitem')[0]!);
    expect(card.getByText('CD-2611-0041')).toBeInTheDocument();
    expect(card.getByText('Nadia Chraibi')).toBeInTheDocument();
    expect(card.getByText('Nouvelle demande')).toBeInTheDocument();
    expect(card.getByText('Dacia Logan')).toBeInTheDocument();
    expect(card.getByText(/15 nov\. → 18 nov\./)).toBeInTheDocument();
    expect(card.getByText(/3 jours/)).toBeInTheDocument();

    const rows = within(screen.getByRole('table', { hidden: true })).getAllByRole('row', { hidden: true });
    expect(rows).toHaveLength(3); // en-tête + 2 réservations
    expect(within(rows[1]!).getByText('Nadia Chraibi')).toBeInTheDocument();
  });

  it('jamais de date ISO ni de flèche ASCII « -> »', () => {
    const { container } = setup();
    expect(container.textContent).not.toMatch(/2026-11-1\d/);
    expect(container.textContent).not.toContain('->');
  });

  it('une demande qui attend une réponse est repérée (barre d’accent) ; une réservation confirmée non', () => {
    setup();
    const items = within(screen.getByRole('list', { name: 'Réservations de votre agence' })).getAllByRole('listitem');
    expect(items[0]!.className).toMatch(/border-s-amber-400/);
    expect(items[1]!.className).not.toMatch(/border-s-amber-400/);
  });

  it('« Ouvrir » porte la référence du dossier et ouvre la bonne réservation (carte comme tableau)', async () => {
    const user = userEvent.setup();
    const { onOpenDetail } = setup();
    const cards = screen.getByRole('list', { name: 'Réservations de votre agence' });
    await user.click(within(cards).getByRole('button', { name: 'Ouvrir la réservation CD-2611-0042' }));
    expect(onOpenDetail).toHaveBeenLastCalledWith(CONFIRMED);
    await user.click(within(screen.getByRole('table', { hidden: true })).getByRole('button', { name: 'Ouvrir la réservation CD-2611-0041', hidden: true }));
    expect(onOpenDetail).toHaveBeenLastCalledWith(WAITING);
  });

  it('les textes sont accentués', () => {
    setup({ page: pageOf([]) });
    expect(screen.getByText('Aucun dossier ne correspond à ces critères pour votre agence.')).toBeInTheDocument();
  });
});

describe('Réservations de l’agence — filtres pilotés par l’espace agence', () => {
  it('le filtre affiché est celui de la requête (pas un état local perdu au changement de section)', () => {
    setup({ query: { ...baseQuery, status: 'TO_PROCESS' } });
    expect(screen.getByRole('combobox', { name: 'Filtrer par statut' })).toHaveValue('TO_PROCESS');
    expect(screen.getByRole('option', { name: 'Toutes les demandes à traiter' })).toBeInTheDocument();
  });

  it('changer le statut émet la requête complète, sans perdre les autres filtres', async () => {
    const user = userEvent.setup();
    const { onQueryChange } = setup({ query: { q: 'nadia', status: '', sort: 'start_date', type: 'CAR' } });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrer par statut' }), 'TO_PROCESS');
    expect(onQueryChange).toHaveBeenCalledWith({ q: 'nadia', status: 'TO_PROCESS', sort: 'start_date', type: 'CAR' });
  });

  it('la recherche attend une courte pause, puis émet avec le statut courant', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onQueryChange } = setup({ query: { ...baseQuery, status: 'TO_PROCESS' } });
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher une réservation' }), 'omar');
    expect(onQueryChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith({ q: 'omar', status: 'TO_PROCESS', sort: 'created_at' });
  });

  it('les champs ont un identifiant HTML valide (sans espace)', () => {
    setup();
    for (const control of [screen.getByRole('combobox', { name: 'Filtrer par statut' }), screen.getByRole('searchbox')]) {
      expect(control.id).not.toMatch(/\s/);
      expect(control.id).not.toBe('');
    }
  });
});

describe('Réservations de l’agence — états', () => {
  it('rien à traiter : message positif et retour à toutes les réservations (pas « aucune réservation »)', async () => {
    const user = userEvent.setup();
    const { onQueryChange } = setup({ page: pageOf([]), query: { ...baseQuery, status: 'TO_PROCESS' } });
    expect(screen.getByText('Aucune demande à traiter')).toBeInTheDocument();
    expect(screen.queryByText('Aucune réservation')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voir toutes les réservations' }));
    expect(onQueryChange).toHaveBeenCalledWith({ ...baseQuery, status: '' });
  });

  it('aucun résultat pour une recherche, même filtrée sur « à traiter » : message neutre', () => {
    setup({ page: pageOf([]), query: { ...baseQuery, status: 'TO_PROCESS', q: 'zzz' } });
    expect(screen.getByText('Aucune réservation')).toBeInTheDocument();
    expect(screen.queryByText('Aucune demande à traiter')).not.toBeInTheDocument();
  });

  it('chargement initial : squelette, ni liste ni tableau', () => {
    setup({ page: null, loading: true });
    expect(screen.queryByRole('table', { hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Réservations de votre agence' })).not.toBeInTheDocument();
  });

  it('erreur : message et nouvel essai', async () => {
    const user = userEvent.setup();
    const { onRetry } = setup({ error: 'Impossible de charger les réservations.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger les réservations.');
    await user.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('un rôle sans droit de traitement le lit', () => {
    setup({ canAct: false });
    expect(screen.getByText('Votre rôle ne permet pas de traiter les demandes de réservation.')).toBeInTheDocument();
  });
});

describe('formatBookingPeriod', () => {
  const now = new Date(2026, 10, 15);
  it('même année que maintenant : jour et mois seulement', () => {
    expect(formatBookingPeriod('2026-11-15', '2026-11-18', now)).toBe('15 nov. → 18 nov.');
  });
  it('autre année : l’année est indiquée', () => {
    expect(formatBookingPeriod('2026-12-30', '2027-01-02', now)).toBe('30 déc. 2026 → 2 janv. 2027');
  });
  it('date illisible : la valeur d’origine, jamais « Invalid Date »', () => {
    expect(formatBookingPeriod('n/a', '2026-11-18', now)).toBe('n/a → 2026-11-18');
  });
});
