/**
 * Rapports « Statistiques » (espaces agence et Super-Admin) : forme des réponses des fonctions SQL
 * agency_analytics_report() et admin_analytics_report() (migration 20261123000100), et lecture
 * validée de ces réponses. Tous les agrégats sont calculés en base ; ce module ne fait que vérifier
 * les types (une valeur non numérique lève une erreur au lieu d'afficher un faux zéro).
 * Module pur : utilisable côté serveur et dans le navigateur.
 */

export type AnalyticsPeriod = {
  from: string;
  to: string;
  days: number;
  previousFrom: string;
  previousTo: string;
};

/** Demandes reçues sur une période (date de création, heure du Maroc) */
export type AnalyticsTotals = {
  requests: number;
  accepted: number;
  pickedUp: number;
  returned: number;
  rejected: number;
  /** Expirées sans décision de l'agence */
  expiredUnanswered: number;
  /** Acceptées, puis expirées sans remise des clés */
  noShow: number;
  cancelled: number;
  alternatives: number;
  awaitingDecision: number;
  upcoming: number;
  inProgress: number;
  /** Réservations confirmées (base du chiffre d'affaires) */
  confirmed: number;
  revenue: number;
  rentalDays: number;
  responsesMeasured: number;
  /** null : aucune réponse mesurée */
  responseMedianMinutes: number | null;
  responseP90Minutes: number | null;
  respondedWithin1h: number;
  respondedWithin24h: number;
  /** Médiane des jours entre la demande et la prise en charge */
  leadTimeMedianDays: number | null;
};

export type BreakdownRow = { label: string; requests: number; confirmed: number; revenue: number };

export type AnalyticsBreakdowns = {
  vehicleTypes: BreakdownRow[];
  categories: BreakdownRow[];
  pickupLocations: BreakdownRow[];
  countries: BreakdownRow[];
  locales: BreakdownRow[];
};

export type MonthlyPoint = {
  /** AAAA-MM */
  month: string;
  requests: number;
  confirmed: number;
  revenue: number;
  previousYearRequests: number;
  previousYearRevenue: number;
  /** Mois en cours, pas encore terminé */
  partial: boolean;
};

export type FleetTypeUsage = {
  vehicleType: string;
  vehicles: number;
  occupancyRate: number | null;
  revenue: number;
  revenuePerVehicle: number | null;
};

export type VehicleUsage = {
  vehicleId: string;
  label: string;
  vehicleType: string;
  category: string;
  archived: boolean;
  availableDays: number;
  bookedDays: number;
  occupancyRate: number | null;
  bookings: number;
  revenue: number;
};

export type FleetUsage = {
  vehicles: number;
  availableDays: number;
  bookedDays: number;
  /** Nuits réservées / jours de présence en flotte, en % (null : aucun jour de présence) */
  occupancyRate: number | null;
  revenue: number;
  revenuePerVehicle: number | null;
  idleVehicles: number;
  byType: FleetTypeUsage[];
  /** Détail par véhicule (rapport agence, période courante) ; null sinon */
  items: VehicleUsage[] | null;
};

export type AnalyticsReport = {
  period: AnalyticsPeriod;
  current: AnalyticsTotals;
  previous: AnalyticsTotals;
  breakdowns: AnalyticsBreakdowns;
  monthly: MonthlyPoint[];
  fleet: FleetUsage;
  previousFleet: FleetUsage;
  generatedAt: string;
};

export type AgencyAnalyticsReport = AnalyticsReport;

export type AgencyRankingRow = {
  agencyId: string;
  name: string;
  city: string | null;
  requests: number;
  accepted: number;
  rejected: number;
  expiredUnanswered: number;
  confirmed: number;
  revenue: number;
  responsesMeasured: number;
  responseMedianMinutes: number | null;
  /** null : aucun avis publié (jamais une note par défaut) */
  rating: number | null;
  reviewCount: number;
};

export type MrrMonth = {
  month: string;
  /** MRR en fin de mois (ou à ce jour pour le mois en cours) */
  mrr: number;
  newMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  newSubscribers: number;
  churnedSubscribers: number;
  partial: boolean;
};

export type SubscriptionAnalytics = {
  mrr: number;
  subscribers: number;
  trialSubscribers: number;
  pastDue: number;
  cancelledOrExpired: number;
  averageRevenuePerSubscriber: number | null;
  plans: { slug: string; name: string; subscribers: number; mrr: number }[];
  monthly: MrrMonth[];
};

export type NetworkCounts = {
  agencies: number;
  pendingAgencies: number;
  agenciesWithoutRequests: number;
  vehicles: number;
  motorcycles: number;
};

export type AdminAnalyticsReport = AnalyticsReport & {
  network: NetworkCounts;
  agencies: AgencyRankingRow[];
  subscriptions: SubscriptionAnalytics;
};

/* ── Lecture validée ─────────────────────────────────────────────────── */

export class AnalyticsShapeError extends Error {
  constructor(path: string) {
    super(`Réponse de statistiques invalide (${path}).`);
    this.name = 'AnalyticsShapeError';
  }
}

type Rec = Record<string, unknown>;

function record(value: unknown, path: string): Rec {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new AnalyticsShapeError(path);
  return value as Rec;
}

function num(value: unknown, path: string): number {
  const result = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isFinite(result)) throw new AnalyticsShapeError(path);
  return result;
}

function numOrNull(value: unknown, path: string): number | null {
  return value === null || value === undefined ? null : num(value, path);
}

function str(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new AnalyticsShapeError(path);
  return value;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function list<T>(value: unknown, path: string, item: (entry: unknown, index: number) => T): T[] {
  if (!Array.isArray(value)) throw new AnalyticsShapeError(path);
  return value.map(item);
}

function nums<K extends string>(source: Rec, keys: readonly K[], path: string): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, num(source[key], `${path}.${key}`)])) as Record<K, number>;
}

const TOTAL_COUNTS = [
  'requests',
  'accepted',
  'pickedUp',
  'returned',
  'rejected',
  'expiredUnanswered',
  'noShow',
  'cancelled',
  'alternatives',
  'awaitingDecision',
  'upcoming',
  'inProgress',
  'confirmed',
  'revenue',
  'rentalDays',
  'responsesMeasured',
  'respondedWithin1h',
  'respondedWithin24h',
] as const;

export function parseTotals(value: unknown, path = 'totals'): AnalyticsTotals {
  const source = record(value, path);
  return {
    ...nums(source, TOTAL_COUNTS, path),
    responseMedianMinutes: numOrNull(source.responseMedianMinutes, `${path}.responseMedianMinutes`),
    responseP90Minutes: numOrNull(source.responseP90Minutes, `${path}.responseP90Minutes`),
    leadTimeMedianDays: numOrNull(source.leadTimeMedianDays, `${path}.leadTimeMedianDays`),
  };
}

function parseBreakdownRows(value: unknown, path: string): BreakdownRow[] {
  return list(value ?? [], path, (entry, index) => {
    const row = record(entry, `${path}[${index}]`);
    return {
      label: str(row.label, `${path}[${index}].label`),
      ...nums(row, ['requests', 'confirmed', 'revenue'] as const, `${path}[${index}]`),
    };
  });
}

function parseBreakdowns(value: unknown): AnalyticsBreakdowns {
  const source = record(value, 'breakdowns');
  return {
    vehicleTypes: parseBreakdownRows(source.vehicleTypes, 'breakdowns.vehicleTypes'),
    categories: parseBreakdownRows(source.categories, 'breakdowns.categories'),
    pickupLocations: parseBreakdownRows(source.pickupLocations, 'breakdowns.pickupLocations'),
    countries: parseBreakdownRows(source.countries, 'breakdowns.countries'),
    locales: parseBreakdownRows(source.locales, 'breakdowns.locales'),
  };
}

function parseMonthly(value: unknown): MonthlyPoint[] {
  return list(value, 'monthly', (entry, index) => {
    const path = `monthly[${index}]`;
    const row = record(entry, path);
    return {
      month: str(row.month, `${path}.month`),
      ...nums(row, ['requests', 'confirmed', 'revenue', 'previousYearRequests', 'previousYearRevenue'] as const, path),
      partial: row.partial === true,
    };
  });
}

function parseFleet(value: unknown, path: string): FleetUsage {
  const source = record(value, path);
  return {
    ...nums(source, ['vehicles', 'availableDays', 'bookedDays', 'revenue', 'idleVehicles'] as const, path),
    occupancyRate: numOrNull(source.occupancyRate, `${path}.occupancyRate`),
    revenuePerVehicle: numOrNull(source.revenuePerVehicle, `${path}.revenuePerVehicle`),
    byType: list(source.byType ?? [], `${path}.byType`, (entry, index) => {
      const row = record(entry, `${path}.byType[${index}]`);
      return {
        vehicleType: str(row.vehicleType, `${path}.byType[${index}].vehicleType`),
        vehicles: num(row.vehicles, `${path}.byType[${index}].vehicles`),
        occupancyRate: numOrNull(row.occupancyRate, `${path}.byType[${index}].occupancyRate`),
        revenue: num(row.revenue, `${path}.byType[${index}].revenue`),
        revenuePerVehicle: numOrNull(row.revenuePerVehicle, `${path}.byType[${index}].revenuePerVehicle`),
      };
    }),
    items:
      source.items === null || source.items === undefined
        ? null
        : list(source.items, `${path}.items`, (entry, index) => {
            const itemPath = `${path}.items[${index}]`;
            const row = record(entry, itemPath);
            return {
              vehicleId: str(row.vehicleId, `${itemPath}.vehicleId`),
              label: strOrNull(row.label) ?? 'Véhicule',
              vehicleType: str(row.vehicleType, `${itemPath}.vehicleType`),
              category: strOrNull(row.category) ?? '—',
              archived: row.archived === true,
              ...nums(row, ['availableDays', 'bookedDays', 'bookings', 'revenue'] as const, itemPath),
              occupancyRate: numOrNull(row.occupancyRate, `${itemPath}.occupancyRate`),
            };
          }),
  };
}

function parsePeriod(value: unknown): AnalyticsPeriod {
  const source = record(value, 'period');
  return {
    from: str(source.from, 'period.from'),
    to: str(source.to, 'period.to'),
    days: num(source.days, 'period.days'),
    previousFrom: str(source.previousFrom, 'period.previousFrom'),
    previousTo: str(source.previousTo, 'period.previousTo'),
  };
}

function parseCommon(value: unknown): AnalyticsReport {
  const source = record(value, 'report');
  return {
    period: parsePeriod(source.period),
    current: parseTotals(source.current, 'current'),
    previous: parseTotals(source.previous, 'previous'),
    breakdowns: parseBreakdowns(source.breakdowns),
    monthly: parseMonthly(source.monthly),
    fleet: parseFleet(source.fleet, 'fleet'),
    previousFleet: parseFleet(source.previousFleet, 'previousFleet'),
    generatedAt: typeof source.generatedAt === 'string' ? source.generatedAt : new Date().toISOString(),
  };
}

export function parseAgencyAnalyticsReport(value: unknown): AgencyAnalyticsReport {
  return parseCommon(value);
}

function parseSubscriptions(value: unknown): SubscriptionAnalytics {
  const source = record(value, 'subscriptions');
  return {
    ...nums(source, ['mrr', 'subscribers', 'trialSubscribers', 'pastDue', 'cancelledOrExpired'] as const, 'subscriptions'),
    averageRevenuePerSubscriber: numOrNull(source.averageRevenuePerSubscriber, 'subscriptions.averageRevenuePerSubscriber'),
    plans: list(source.plans ?? [], 'subscriptions.plans', (entry, index) => {
      const row = record(entry, `subscriptions.plans[${index}]`);
      return {
        slug: str(row.slug, `subscriptions.plans[${index}].slug`),
        name: str(row.name, `subscriptions.plans[${index}].name`),
        ...nums(row, ['subscribers', 'mrr'] as const, `subscriptions.plans[${index}]`),
      };
    }),
    monthly: list(source.monthly ?? [], 'subscriptions.monthly', (entry, index) => {
      const path = `subscriptions.monthly[${index}]`;
      const row = record(entry, path);
      return {
        month: str(row.month, `${path}.month`),
        ...nums(
          row,
          ['mrr', 'newMrr', 'expansionMrr', 'contractionMrr', 'churnedMrr', 'newSubscribers', 'churnedSubscribers'] as const,
          path
        ),
        partial: row.partial === true,
      };
    }),
  };
}

export function parseAdminAnalyticsReport(value: unknown): AdminAnalyticsReport {
  const common = parseCommon(value);
  const source = record(value, 'report');
  const network = record(source.network, 'network');
  return {
    ...common,
    network: nums(network, ['agencies', 'pendingAgencies', 'agenciesWithoutRequests', 'vehicles', 'motorcycles'] as const, 'network'),
    agencies: list(source.agencies ?? [], 'agencies', (entry, index) => {
      const path = `agencies[${index}]`;
      const row = record(entry, path);
      return {
        agencyId: str(row.agencyId, `${path}.agencyId`),
        name: strOrNull(row.name) ?? 'Agence',
        city: strOrNull(row.city),
        ...nums(row, ['requests', 'accepted', 'rejected', 'expiredUnanswered', 'confirmed', 'revenue', 'responsesMeasured', 'reviewCount'] as const, path),
        responseMedianMinutes: numOrNull(row.responseMedianMinutes, `${path}.responseMedianMinutes`),
        rating: numOrNull(row.rating, `${path}.rating`),
      };
    }),
    subscriptions: parseSubscriptions(source.subscriptions),
  };
}
