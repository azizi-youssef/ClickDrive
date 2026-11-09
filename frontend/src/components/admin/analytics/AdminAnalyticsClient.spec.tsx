// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, within } from '@/tests/setup/render';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAnalyticsClient } from './AdminAnalyticsClient';

vi.mock('@/lib/supabase/realtime', () => ({ useRealtimeRefresh: () => undefined }));

const month = (key: string, label: string, bookings: number, confirmed: number, partial = false) => ({
  key,
  month: label,
  bookings,
  confirmed,
  partial,
});

const payload = {
  kpis: {
    totalBookings: 33,
    confirmedBookings: 14,
    pendingBookings: 5,
    cancelledBookings: 4,
    confirmationRate: 42,
    cancellationRate: 12,
    averageRentalDays: 4.2,
    totalAgencies: 6,
    totalVehicles: 40,
  },
  subscriptions: { monthlyRecurringRevenue: 1500, activeSubscribers: 4, fleetCapacityTotal: 90 },
  monthlyTrends: [
    month('2026-06', 'juin 26', 0, 0),
    month('2026-07', 'juil. 26', 4, 2),
    month('2026-08', 'août 26', 6, 3),
    month('2026-09', 'sept. 26', 8, 3),
    month('2026-10', 'oct. 26', 12, 5),
    month('2026-11', 'nov. 26', 3, 1, true),
  ],
  categoryBreakdown: [],
  topAgencies: [{ name: 'Agence Sans Avis', city: null, count: 5, rating: null }],
  topLocations: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('Statistiques admin — graphique et tendances honnêtes', () => {
  it('mois vide sans barre, valeurs écrites, mois en cours marqué, tendance sur le volume', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: payload }), { status: 200 })));
    const { container } = render(<AdminAnalyticsClient />);

    // Tendance : dernier mois complet (oct.) contre le précédent (sept.) ; base 8 < 10 → pas de %
    expect(await screen.findByText('12 demandes en oct. 26 · +4 vs sept. 26')).toBeInTheDocument();

    // Une barre (et son segment « confirmées ») par mois non vide ; juin (0) n'en a aucune
    const bars = container.querySelectorAll('[style*="height"]');
    expect(bars).toHaveLength(5 * 2);

    // Alternative textuelle complète, mois en cours signalé
    const table = screen.getByRole('table', { name: 'Demandes de réservation par mois' });
    expect(within(table).getByRole('rowheader', { name: 'nov. 26 (en cours)' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'juin 26' })).toBeInTheDocument();

    // La tendance du volume n'est plus accrochée au taux de confirmation
    expect(screen.queryByText(/demandes en .* sur 30 jours/)).not.toBeInTheDocument();
  });

  it('agence sans avis : « Aucun avis », jamais une note inventée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: payload }), { status: 200 })));
    render(<AdminAnalyticsClient />);
    const row = (await screen.findByText('Agence Sans Avis')).closest('tr')!;
    expect(within(row).getByText('Aucun avis')).toBeInTheDocument();
    expect(within(row).queryByText(/\/ 5/)).not.toBeInTheDocument();
  });
});
