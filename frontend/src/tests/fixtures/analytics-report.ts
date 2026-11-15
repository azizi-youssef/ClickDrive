/**
 * Rapports de statistiques tels que les renvoient agency_analytics_report() / admin_analytics_report()
 * (JSON brut). Valeurs cohérentes entre elles, pour les tests unitaires, de route et de composants.
 */

export const totals = (overrides: Record<string, unknown> = {}) => ({
  requests: 40,
  accepted: 30,
  pickedUp: 22,
  returned: 18,
  rejected: 4,
  expiredUnanswered: 3,
  noShow: 2,
  cancelled: 2,
  alternatives: 1,
  awaitingDecision: 1,
  upcoming: 6,
  inProgress: 4,
  confirmed: 28,
  revenue: 84000,
  rentalDays: 112,
  responsesMeasured: 34,
  responseMedianMinutes: 42,
  responseP90Minutes: 300,
  respondedWithin1h: 20,
  respondedWithin24h: 33,
  leadTimeMedianDays: 12.5,
  ...overrides,
});

const monthKeys = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

export const monthly = () =>
  monthKeys.map((month, index) => ({
    month,
    requests: index === 2 ? 0 : 10 + index,
    confirmed: index === 2 ? 0 : 6 + index,
    revenue: index === 2 ? 0 : 20000 + index * 1000,
    previousYearRequests: index === 11 ? 8 : 5,
    previousYearRevenue: 15000,
    partial: index === 11,
  }));

export const fleet = (overrides: Record<string, unknown> = {}) => ({
  vehicles: 3,
  availableDays: 90,
  bookedDays: 36,
  occupancyRate: 40,
  revenue: 30000,
  revenuePerVehicle: 10000,
  idleVehicles: 1,
  byType: [
    { vehicleType: 'CAR', vehicles: 2, occupancyRate: 55, revenue: 27000, revenuePerVehicle: 13500 },
    { vehicleType: 'MOTORCYCLE', vehicles: 1, occupancyRate: 10, revenue: 3000, revenuePerVehicle: 3000 },
  ],
  items: null as unknown,
  ...overrides,
});

export const breakdowns = () => ({
  vehicleTypes: [
    { label: 'CAR', requests: 34, confirmed: 25, revenue: 78000 },
    { label: 'MOTORCYCLE', requests: 6, confirmed: 3, revenue: 6000 },
  ],
  categories: [
    { label: 'Économique', requests: 25, confirmed: 18, revenue: 50000 },
    { label: 'SUV', requests: 9, confirmed: 7, revenue: 28000 },
  ],
  pickupLocations: [
    { label: 'Aéroport Nador Al-Aroui', requests: 30, confirmed: 22, revenue: 66000 },
    { label: 'Port de Beni Ansar', requests: 10, confirmed: 6, revenue: 18000 },
  ],
  countries: [
    { label: 'Maroc', requests: 20, confirmed: 14, revenue: 40000 },
    { label: 'France', requests: 12, confirmed: 9, revenue: 30000 },
  ],
  locales: [
    { label: 'fr', requests: 30, confirmed: 22, revenue: 66000 },
    { label: 'nl', requests: 10, confirmed: 6, revenue: 18000 },
  ],
});

export const period = () => ({ from: '2026-10-01', to: '2026-10-30', days: 30, previousFrom: '2026-09-01', previousTo: '2026-09-30' });

export function agencyReportJson(overrides: Record<string, unknown> = {}) {
  return {
    period: period(),
    current: totals(),
    previous: totals({ requests: 32, accepted: 20, revenue: 70000, confirmed: 22, responseMedianMinutes: 60, rejected: 6 }),
    breakdowns: breakdowns(),
    monthly: monthly(),
    fleet: fleet({
      items: [
        { vehicleId: 'v1', label: 'Dacia Logan · 1234-A-50', vehicleType: 'CAR', category: 'Économique', archived: false, availableDays: 30, bookedDays: 24, occupancyRate: 80, bookings: 5, revenue: 20000 },
        { vehicleId: 'v2', label: 'Yamaha NMAX', vehicleType: 'MOTORCYCLE', category: 'Scooter', archived: false, availableDays: 30, bookedDays: 27, occupancyRate: 90, bookings: 6, revenue: 10000 },
        { vehicleId: 'v3', label: 'Renault Clio · A-2', vehicleType: 'CAR', category: 'Économique', archived: true, availableDays: 30, bookedDays: 0, occupancyRate: 0, bookings: 0, revenue: 0 },
      ],
    }),
    previousFleet: fleet({ occupancyRate: 30, revenuePerVehicle: 8000 }),
    generatedAt: '2026-10-30T12:00:00Z',
    ...overrides,
  };
}

export function adminReportJson(overrides: Record<string, unknown> = {}) {
  return {
    ...agencyReportJson(),
    fleet: fleet(),
    network: { agencies: 6, pendingAgencies: 1, agenciesWithoutRequests: 2, vehicles: 40, motorcycles: 6 },
    agencies: [
      { agencyId: 'a1', name: 'Agence Alpha', city: 'Nador', requests: 25, accepted: 20, rejected: 2, expiredUnanswered: 1, confirmed: 19, revenue: 60000, responsesMeasured: 22, responseMedianMinutes: 35, rating: 4.6, reviewCount: 12 },
      { agencyId: 'a2', name: 'Agence Sans Avis', city: null, requests: 15, accepted: 10, rejected: 2, expiredUnanswered: 2, confirmed: 9, revenue: 24000, responsesMeasured: 2, responseMedianMinutes: 20, rating: null, reviewCount: 0 },
    ],
    subscriptions: {
      mrr: 1500,
      subscribers: 4,
      trialSubscribers: 1,
      pastDue: 0,
      cancelledOrExpired: 1,
      averageRevenuePerSubscriber: 375,
      plans: [
        { slug: 'starter', name: 'Starter', subscribers: 3, mrr: 900 },
        { slug: 'pro', name: 'Pro', subscribers: 1, mrr: 600 },
      ],
      monthly: monthKeys.map((month, index) => ({
        month,
        mrr: index < 6 ? 0 : 900 + (index - 6) * 100,
        newMrr: index === 6 ? 900 : index === 11 ? 300 : 0,
        expansionMrr: index === 9 ? 200 : 0,
        contractionMrr: 0,
        churnedMrr: index === 11 ? 100 : 0,
        newSubscribers: index === 6 ? 3 : index === 11 ? 1 : 0,
        churnedSubscribers: index === 11 ? 1 : 0,
        partial: index === 11,
      })),
    },
    ...overrides,
  };
}
