// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, within } from '@/tests/setup/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OverviewPanel, type AgendaResource, type OverviewResource } from './OverviewPanel';

const stats = (pendingBookings: number): OverviewResource => ({
  loading: false,
  error: null,
  data: {
    totalVehicles: 12, availableVehicles: 4, reservedVehicles: 2, rentedVehicles: 5, maintenanceVehicles: 1,
    pendingBookings, confirmedBookings: 7, completedBookings: 41, cancelledBookings: 6,
    grossRevenue: 98400, occupancyRate: 42,
  },
});
const agenda: AgendaResource = { loading: false, error: null, data: { upcomingPickups: [], upcomingReturns: [], recentActivity: [] } };

function setup(props: Partial<React.ComponentProps<typeof OverviewPanel>> & { pending?: number } = {}) {
  const { pending = 2, ...rest } = props;
  const handlers = {
    onRetry: vi.fn(), onOpenBookings: vi.fn(), onOpenFleet: vi.fn(), onOpenCalendar: vi.fn(), onOpenSubscription: vi.fn(),
  };
  const view = render(<OverviewPanel stats={stats(pending)} agenda={agenda} {...handlers} {...rest} />);
  return { ...view, ...handlers };
}

const kpi = () => screen.getByRole('button', { name: /^À traiter/ });
const alertButton = () => screen.getByRole('button', { name: /attend(ent)? votre réponse/ });
const quickAction = () => screen.getByRole('button', { name: /Traiter les réservations/ });

describe('Vue d’ensemble agence — demandes à traiter', () => {
  it('le compteur du serveur (toute la file) prime sur l’indicateur de la période', () => {
    setup({ pending: 2, pendingNow: 5 });
    expect(within(kpi()).getByText('5')).toBeInTheDocument();
    expect(alertButton()).toHaveTextContent('5 demandes de réservation attendent votre réponse');
  });

  it('une demande ancienne, hors de la période affichée, déclenche quand même l’alerte', () => {
    // Période « Aujourd'hui » : 0 demande créée, mais 3 attendent toujours une réponse
    setup({ pending: 0, pendingNow: 3 });
    expect(alertButton()).toHaveTextContent('3 demandes');
    expect(within(kpi()).getByText('3')).toBeInTheDocument();
  });

  it('sans compteur du serveur : repli sur l’indicateur de la période', () => {
    setup({ pending: 2 });
    expect(alertButton()).toHaveTextContent('2 demandes');
  });

  it('rien en attente : ni alerte, ni indicateur urgent', () => {
    setup({ pending: 0, pendingNow: 0 });
    expect(screen.queryByRole('button', { name: /attend(ent)? votre réponse/ })).not.toBeInTheDocument();
    expect(within(kpi()).getByText('Aucune demande en attente')).toBeInTheDocument();
  });

  it('le singulier est accordé', () => {
    setup({ pending: 1, pendingNow: 1 });
    expect(alertButton()).toHaveTextContent('1 demande de réservation attend votre réponse');
  });

  it('indicateur, alerte et action rapide ouvrent la liste déjà filtrée, pas la liste complète', async () => {
    const user = userEvent.setup();
    const { onOpenPending, onOpenBookings } = { onOpenPending: vi.fn(), onOpenBookings: vi.fn() };
    setup({ pendingNow: 4, onOpenPending, onOpenBookings });
    await user.click(kpi());
    await user.click(alertButton());
    await user.click(quickAction());
    expect(onOpenPending).toHaveBeenCalledTimes(3);
    expect(onOpenBookings).not.toHaveBeenCalled();
  });

  it('sans ouverture filtrée fournie : retour à la liste des réservations', async () => {
    const user = userEvent.setup();
    const { onOpenBookings } = setup({ pendingNow: 4 });
    await user.click(kpi());
    expect(onOpenBookings).toHaveBeenCalledTimes(1);
  });

  it('« Confirmées » garde son accès à la liste complète', async () => {
    const user = userEvent.setup();
    const { onOpenBookings, onOpenPending } = { onOpenBookings: vi.fn(), onOpenPending: vi.fn() };
    setup({ onOpenBookings, onOpenPending });
    await user.click(screen.getByRole('button', { name: /^Confirmées/ }));
    expect(onOpenBookings).toHaveBeenCalledTimes(1);
    expect(onOpenPending).not.toHaveBeenCalled();
  });
});
