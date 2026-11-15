import { formatTrend, trendFigures } from '@/lib/admin/trend';
import type { CsvRow } from '@/lib/export/csv';
import type {
  AdminAnalyticsReport,
  AgencyAnalyticsReport,
  AnalyticsReport,
  AnalyticsTotals,
  BreakdownRow,
  FleetUsage,
} from './report';

/**
 * Présentation des rapports « Statistiques » : taux, entonnoir, comparaison à la période précédente,
 * libellés et export CSV. Fonctions pures (aucun calcul d'agrégat : ils viennent de la base).
 */

/** Médiane du délai de réponse affichée à partir de 3 réponses mesurées (même seuil que la fiche agence) */
export const MIN_RESPONSES_FOR_MEDIAN = 3;

/** Part entière en % ; null quand la base est vide (jamais « 0 % » pour une absence de données) */
export function percentOf(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((part / total) * 100);
}

const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return integer.format(value);
}

export function formatMoney(value: number): string {
  return `${integer.format(Math.round(value))} DH`;
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

/** Étiquette courte au-dessus d'une barre : « 3,4 k », « 12 » */
export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatRate(value: number | null): string {
  return value === null ? '—' : `${decimal.format(value)} %`;
}

/** 45 min · 2 h · 2 h 10 · 1 j 4 h */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  if (total < 24 * 60) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
  }
  const days = Math.floor(total / (24 * 60));
  const hours = Math.round((total % (24 * 60)) / 60);
  return hours === 0 ? `${days} j` : `${days} j ${hours} h`;
}

/* ── Entonnoir ───────────────────────────────────────────────────────── */

export type FunnelStep = {
  key: 'requests' | 'accepted' | 'pickedUp' | 'returned';
  label: string;
  value: number;
  /** Part de l'étape précédente (null pour la première, ou base vide) */
  conversion: number | null;
  /** Part des demandes reçues */
  ofRequests: number | null;
};

export function funnelSteps(totals: AnalyticsTotals): FunnelStep[] {
  const { requests, accepted, pickedUp, returned } = totals;
  return [
    { key: 'requests', label: 'Demandes reçues', value: requests, conversion: null, ofRequests: requests > 0 ? 100 : null },
    { key: 'accepted', label: 'Acceptées', value: accepted, conversion: percentOf(accepted, requests), ofRequests: percentOf(accepted, requests) },
    { key: 'pickedUp', label: 'Véhicule remis', value: pickedUp, conversion: percentOf(pickedUp, accepted), ofRequests: percentOf(pickedUp, requests) },
    { key: 'returned', label: 'Restituées', value: returned, conversion: percentOf(returned, pickedUp), ofRequests: percentOf(returned, requests) },
  ];
}

export type FunnelOutcome = { key: string; label: string; value: number; share: number | null; tone: 'loss' | 'open' };

/** Ce que deviennent les demandes qui ne vont pas au bout (en % des demandes reçues) */
export function funnelOutcomes(totals: AnalyticsTotals): FunnelOutcome[] {
  const share = (value: number) => percentOf(value, totals.requests);
  return [
    { key: 'rejected', label: 'Refusées', value: totals.rejected, share: share(totals.rejected), tone: 'loss' as const },
    { key: 'expiredUnanswered', label: 'Expirées sans réponse', value: totals.expiredUnanswered, share: share(totals.expiredUnanswered), tone: 'loss' as const },
    { key: 'noShow', label: 'Acceptées non retirées', value: totals.noShow, share: share(totals.noShow), tone: 'loss' as const },
    { key: 'cancelled', label: 'Annulées', value: totals.cancelled, share: share(totals.cancelled), tone: 'loss' as const },
    { key: 'awaitingDecision', label: 'En attente de décision', value: totals.awaitingDecision, share: share(totals.awaitingDecision), tone: 'open' as const },
    { key: 'upcoming', label: 'Départs à venir', value: totals.upcoming, share: share(totals.upcoming), tone: 'open' as const },
    { key: 'inProgress', label: 'Locations en cours', value: totals.inProgress, share: share(totals.inProgress), tone: 'open' as const },
  ];
}

/* ── Délai de réponse ────────────────────────────────────────────────── */

export type ResponseSummary = {
  medianMinutes: number;
  p90Minutes: number | null;
  measured: number;
  within1h: number | null;
  within24h: number | null;
};

/** null sous 3 réponses mesurées : la médiane ne dirait rien de fiable */
export function responseSummary(totals: AnalyticsTotals): ResponseSummary | null {
  if (totals.responseMedianMinutes === null || totals.responsesMeasured < MIN_RESPONSES_FOR_MEDIAN) return null;
  return {
    medianMinutes: totals.responseMedianMinutes,
    p90Minutes: totals.responseP90Minutes,
    measured: totals.responsesMeasured,
    within1h: percentOf(totals.respondedWithin1h, totals.responsesMeasured),
    within24h: percentOf(totals.respondedWithin24h, totals.responsesMeasured),
  };
}

/* ── Comparaison à la période précédente ─────────────────────────────── */

export type MetricUnit = 'count' | 'money' | 'percent' | 'minutes' | 'days';

export type MetricComparison = {
  key: string;
  label: string;
  unit: MetricUnit;
  current: number | null;
  previous: number | null;
  /** Une hausse est une mauvaise nouvelle (délai, refus, expirations) */
  invert?: boolean;
};

function averageOf(total: number, count: number): number | null {
  return count > 0 ? Math.round((total / count) * 10) / 10 : null;
}

function fleetRate(fleet: FleetUsage): number | null {
  return fleet.occupancyRate;
}

export function metricComparisons(report: AnalyticsReport): MetricComparison[] {
  const { current: c, previous: p } = report;
  const median = (totals: AnalyticsTotals) =>
    totals.responsesMeasured >= MIN_RESPONSES_FOR_MEDIAN ? totals.responseMedianMinutes : null;
  return [
    { key: 'requests', label: 'Demandes reçues', unit: 'count', current: c.requests, previous: p.requests },
    { key: 'acceptanceRate', label: 'Taux d’acceptation', unit: 'percent', current: percentOf(c.accepted, c.requests), previous: percentOf(p.accepted, p.requests) },
    { key: 'confirmed', label: 'Réservations confirmées', unit: 'count', current: c.confirmed, previous: p.confirmed },
    { key: 'revenue', label: 'Chiffre d’affaires confirmé', unit: 'money', current: c.revenue, previous: p.revenue },
    { key: 'averageBasket', label: 'Panier moyen', unit: 'money', current: averageOf(c.revenue, c.confirmed), previous: averageOf(p.revenue, p.confirmed) },
    { key: 'averageRentalDays', label: 'Durée moyenne de location', unit: 'days', current: averageOf(c.rentalDays, c.confirmed), previous: averageOf(p.rentalDays, p.confirmed) },
    { key: 'responseMedian', label: 'Délai de réponse médian', unit: 'minutes', current: median(c), previous: median(p), invert: true },
    { key: 'rejectionRate', label: 'Taux de refus', unit: 'percent', current: percentOf(c.rejected, c.requests), previous: percentOf(p.rejected, p.requests), invert: true },
    { key: 'expiryRate', label: 'Taux d’expiration sans réponse', unit: 'percent', current: percentOf(c.expiredUnanswered, c.requests), previous: percentOf(p.expiredUnanswered, p.requests), invert: true },
    { key: 'occupancy', label: 'Taux d’occupation de la flotte', unit: 'percent', current: fleetRate(report.fleet), previous: fleetRate(report.previousFleet) },
    { key: 'revenuePerVehicle', label: 'Revenu par véhicule', unit: 'money', current: report.fleet.revenuePerVehicle, previous: report.previousFleet.revenuePerVehicle },
  ];
}

export function formatMetric(unit: MetricUnit, value: number | null): string {
  if (value === null) return '—';
  switch (unit) {
    case 'money':
      return formatMoney(value);
    case 'percent':
      return formatRate(value);
    case 'minutes':
      return formatDuration(value);
    case 'days':
      return `${decimal.format(value)} j`;
    default:
      return formatCount(value);
  }
}

export type ComparisonDirection = 'up' | 'down' | 'flat';

export type ComparisonBadge = { text: string; direction: ComparisonDirection; tone: 'good' | 'bad' | 'neutral' };

/**
 * Écart avec la période précédente : en points pour un taux, en durée pour un délai, en valeur (et % si
 * la base compte au moins 10 éléments) pour un volume. null si l'une des deux valeurs manque.
 */
export function comparisonBadge(metric: MetricComparison): ComparisonBadge | null {
  const { current, previous, unit, invert } = metric;
  if (current === null || previous === null) return null;
  const delta = Math.round((current - previous) * 10) / 10;
  const direction: ComparisonDirection = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const tone = direction === 'flat' ? 'neutral' : (direction === 'up') !== Boolean(invert) ? 'good' : 'bad';
  const sign = delta > 0 ? '+' : '−';
  let text: string;
  if (delta === 0) text = 'stable';
  else if (unit === 'percent') text = `${sign}${decimal.format(Math.abs(delta))} pt${Math.abs(delta) >= 2 ? 's' : ''}`;
  else if (unit === 'minutes') text = `${sign}${formatDuration(Math.abs(delta))}`;
  else if (unit === 'days') text = `${sign}${decimal.format(Math.abs(delta))} j`;
  else if (unit === 'money') {
    const figures = trendFigures(Math.round(current), Math.round(previous));
    text = figures.percent === null ? `${sign}${formatMoney(Math.abs(delta))}` : `${figures.percent > 0 ? '+' : '−'}${integer.format(Math.abs(figures.percent))} %`;
  } else text = formatTrend(trendFigures(current, previous));
  return { text, direction, tone };
}

/* ── Libellés ────────────────────────────────────────────────────────── */

const LOCALE_LABELS: Record<string, string> = {
  fr: 'Français',
  ar: 'Arabe',
  en: 'Anglais',
  de: 'Allemand',
  es: 'Espagnol',
  nl: 'Néerlandais',
};

export function localeLabel(code: string): string {
  return LOCALE_LABELS[code] ?? code.toUpperCase();
}

export function vehicleTypeLabel(type: string, plural = true): string {
  if (type === 'MOTORCYCLE') return plural ? 'Motos' : 'Moto';
  if (type === 'CAR') return plural ? 'Voitures' : 'Voiture';
  return type;
}

const monthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthNarrow = new Intl.DateTimeFormat('fr-FR', { month: 'narrow', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function utcDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(iso.slice(0, 10));
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, match[3] ? Number(match[3]) : 1));
}

/** « 2026-10 » → « oct. 26 » (« octobre 2026 » en long, « O » en initiale pour les petits écrans) */
export function monthLabel(month: string, style: 'short' | 'long' | 'narrow' = 'short'): string {
  const date = utcDate(month);
  if (!date) return month;
  return (style === 'long' ? monthLong : style === 'narrow' ? monthNarrow : monthShort).format(date);
}

export function dayLabel(iso: string): string {
  const date = utcDate(iso);
  return date ? dayFormat.format(date) : iso;
}

/** « 1 oct. 2026 – 30 oct. 2026 » */
export function periodLabel(from: string, to: string): string {
  return from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;
}

/** Lignes d'une répartition avec leur part des demandes (somme de la dimension) */
export function withShares(rows: readonly BreakdownRow[], total: number): (BreakdownRow & { share: number | null })[] {
  return rows.map((row) => ({ ...row, share: percentOf(row.requests, total) }));
}

/* ── Périodes proposées ──────────────────────────────────────────────── */

export type AnalyticsPreset = '7d' | '30d' | '90d' | '12m' | 'ytd' | 'custom';

export const ANALYTICS_PRESETS: readonly { value: Exclude<AnalyticsPreset, 'custom'>; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '12m', label: '12 mois' },
  { value: 'ytd', label: 'Cette année' },
] as const;

/** Date locale du navigateur au format AAAA-MM-JJ (pas toISOString : décalage UTC le soir) */
export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function resolveAnalyticsRange(preset: Exclude<AnalyticsPreset, 'custom'>, now = new Date()): { from: string; to: string } {
  const to = localIsoDate(now);
  if (preset === 'ytd') return { from: `${now.getFullYear()}-01-01`, to };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === '12m') {
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
  } else {
    start.setDate(start.getDate() - ((preset === '7d' ? 7 : preset === '30d' ? 30 : 90) - 1));
  }
  return { from: localIsoDate(start), to };
}

/** Au plus 1 096 jours (limite de la base) */
export const MAX_RANGE_DAYS = 1096;

export function rangeError(from: string, to: string): string | null {
  const start = utcDate(from);
  const end = utcDate(to);
  if (!start || !end) return 'Dates invalides.';
  if (start > end) return 'La date de début doit précéder la date de fin.';
  if ((end.getTime() - start.getTime()) / 86_400_000 + 1 > MAX_RANGE_DAYS) return 'Choisissez une période de 3 ans au plus.';
  return null;
}

/* ── Export CSV ──────────────────────────────────────────────────────── */

function csvMetric(unit: MetricUnit, value: number | null): number | string {
  if (value === null) return '';
  return unit === 'money' ? Math.round(value) : value;
}

function unitSuffix(unit: MetricUnit): string {
  return unit === 'money' ? ' (DH)' : unit === 'percent' ? ' (%)' : unit === 'minutes' ? ' (min)' : unit === 'days' ? ' (jours)' : '';
}

function breakdownSection(title: string, rows: readonly BreakdownRow[], total: number, label: (value: string) => string = (v) => v): CsvRow[] {
  return [
    [title, 'Demandes', 'Part des demandes (%)', 'Confirmées', 'Chiffre d’affaires (DH)'],
    ...rows.map((row) => [label(row.label), row.requests, percentOf(row.requests, total) ?? '', row.confirmed, Math.round(row.revenue)]),
    [],
  ];
}

function commonCsvRows(report: AnalyticsReport, title: string): CsvRow[] {
  const { period, current } = report;
  return [
    [title],
    ['Période', period.from, period.to, `${period.days} jours`],
    ['Période précédente', period.previousFrom, period.previousTo],
    ['Fuseau horaire', 'Africa/Casablanca'],
    [],
    ['Indicateur', 'Période', 'Période précédente'],
    ...metricComparisons(report).map((metric) => [
      `${metric.label}${unitSuffix(metric.unit)}`,
      csvMetric(metric.unit, metric.current),
      csvMetric(metric.unit, metric.previous),
    ]),
    [],
    ['Entonnoir', 'Demandes', 'Taux depuis l’étape précédente (%)', 'Part des demandes reçues (%)'],
    ...funnelSteps(current).map((step) => [step.label, step.value, step.conversion ?? '', step.ofRequests ?? '']),
    ...funnelOutcomes(current).map((outcome) => [outcome.label, outcome.value, '', outcome.share ?? '']),
    [],
    ['Délai de réponse', 'Valeur'],
    ['Réponses mesurées', current.responsesMeasured],
    ['Médiane (min)', current.responseMedianMinutes ?? ''],
    ['90e centile (min)', current.responseP90Minutes ?? ''],
    ['Répondues en moins d’1 h', current.respondedWithin1h],
    ['Répondues en moins de 24 h', current.respondedWithin24h],
    ['Délai d’anticipation médian (jours)', current.leadTimeMedianDays ?? ''],
    [],
    ['Mois', 'Demandes', 'Confirmées', 'Chiffre d’affaires (DH)', 'Demandes un an plus tôt', 'Chiffre d’affaires un an plus tôt (DH)', 'Mois en cours'],
    ...report.monthly.map((point) => [
      point.month,
      point.requests,
      point.confirmed,
      Math.round(point.revenue),
      point.previousYearRequests,
      Math.round(point.previousYearRevenue),
      point.partial ? 'oui' : '',
    ]),
    [],
    ...breakdownSection('Type de véhicule', report.breakdowns.vehicleTypes, current.requests, (value) => vehicleTypeLabel(value)),
    ...breakdownSection('Catégorie', report.breakdowns.categories, current.requests),
    ...breakdownSection('Point de prise en charge', report.breakdowns.pickupLocations, current.requests),
    ...breakdownSection('Pays du client', report.breakdowns.countries, current.requests),
    ...breakdownSection('Langue du client', report.breakdowns.locales, current.requests, localeLabel),
    ['Flotte', 'Véhicules', 'Taux d’occupation (%)', 'Revenu (DH)', 'Revenu par véhicule (DH)'],
    ['Total', report.fleet.vehicles, report.fleet.occupancyRate ?? '', report.fleet.revenue, report.fleet.revenuePerVehicle ?? ''],
    ...report.fleet.byType.map((row) => [vehicleTypeLabel(row.vehicleType), row.vehicles, row.occupancyRate ?? '', row.revenue, row.revenuePerVehicle ?? '']),
    [],
  ];
}

export function agencyAnalyticsCsvRows(report: AgencyAnalyticsReport, agencyName: string): CsvRow[] {
  return [
    ...commonCsvRows(report, `Statistiques ClickDrive — ${agencyName}`),
    ['Véhicule', 'Type', 'Catégorie', 'Archivé', 'Jours en flotte', 'Nuits réservées', 'Taux d’occupation (%)', 'Réservations', 'Revenu des nuits de la période (DH)'],
    ...(report.fleet.items ?? []).map((item) => [
      item.label,
      vehicleTypeLabel(item.vehicleType, false),
      item.category,
      item.archived ? 'oui' : '',
      item.availableDays,
      item.bookedDays,
      item.occupancyRate ?? '',
      item.bookings,
      item.revenue,
    ]),
  ];
}

export function adminAnalyticsCsvRows(report: AdminAnalyticsReport): CsvRow[] {
  const { subscriptions, network } = report;
  return [
    ...commonCsvRows(report, 'Statistiques plateforme ClickDrive'),
    ['Réseau', 'Valeur'],
    ['Agences actives', network.agencies],
    ['Agences en attente de validation', network.pendingAgencies],
    ['Agences sans demande sur la période', network.agenciesWithoutRequests],
    ['Véhicules', network.vehicles],
    ['Dont motos', network.motorcycles],
    [],
    ['Agence', 'Ville', 'Demandes', 'Acceptées', 'Taux d’acceptation (%)', 'Refusées', 'Expirées sans réponse', 'Confirmées', 'Chiffre d’affaires (DH)', 'Délai de réponse médian (min)', 'Réponses mesurées', 'Note', 'Avis'],
    ...report.agencies.map((agency) => [
      agency.name,
      agency.city ?? '',
      agency.requests,
      agency.accepted,
      percentOf(agency.accepted, agency.requests) ?? '',
      agency.rejected,
      agency.expiredUnanswered,
      agency.confirmed,
      Math.round(agency.revenue),
      agency.responsesMeasured >= MIN_RESPONSES_FOR_MEDIAN ? agency.responseMedianMinutes ?? '' : '',
      agency.responsesMeasured,
      agency.rating ?? '',
      agency.reviewCount,
    ]),
    [],
    ['Revenu récurrent', 'Valeur'],
    ['MRR (DH par mois)', subscriptions.mrr],
    ['Agences abonnées', subscriptions.subscribers],
    ['Dont en essai', subscriptions.trialSubscribers],
    ['Paiement en retard', subscriptions.pastDue],
    ['Résiliées ou expirées', subscriptions.cancelledOrExpired],
    ['Revenu moyen par agence abonnée (DH)', subscriptions.averageRevenuePerSubscriber ?? ''],
    [],
    ['Formule', 'Agences abonnées', 'MRR (DH)'],
    ...subscriptions.plans.map((plan) => [plan.name, plan.subscribers, plan.mrr]),
    [],
    ['Mois', 'MRR fin de mois (DH)', 'Nouveaux (DH)', 'Hausses (DH)', 'Baisses (DH)', 'Résiliations (DH)', 'Nouvelles agences', 'Agences perdues', 'Mois en cours'],
    ...subscriptions.monthly.map((month) => [
      month.month,
      month.mrr,
      month.newMrr,
      month.expansionMrr,
      month.contractionMrr,
      month.churnedMrr,
      month.newSubscribers,
      month.churnedSubscribers,
      month.partial ? 'oui' : '',
    ]),
  ];
}
