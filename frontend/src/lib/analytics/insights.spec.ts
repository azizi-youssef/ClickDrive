import { describe, expect, it } from 'vitest';
import { adminReportJson, agencyReportJson, totals } from '@/tests/fixtures/analytics-report';
import { toCsv } from '@/lib/export/csv';
import { parseAdminAnalyticsReport, parseAgencyAnalyticsReport, parseTotals } from './report';
import {
  adminAnalyticsCsvRows,
  agencyAnalyticsCsvRows,
  comparisonBadge,
  formatDuration,
  funnelOutcomes,
  funnelSteps,
  metricComparisons,
  monthLabel,
  percentOf,
  rangeError,
  resolveAnalyticsRange,
  responseSummary,
  type MetricComparison,
} from './insights';

describe('percentOf', () => {
  it('part entière, null pour une base vide (jamais « 0 % » sans données)', () => {
    expect(percentOf(30, 40)).toBe(75);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBeNull();
    expect(percentOf(3, Number.NaN)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('minutes, heures, jours', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(130)).toBe('2 h 10');
    expect(formatDuration(24 * 60 + 4 * 60)).toBe('1 j 4 h');
    expect(formatDuration(2 * 24 * 60)).toBe('2 j');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('entonnoir', () => {
  const t = parseTotals(totals());

  it('chaque étape rapportée à la précédente et aux demandes reçues', () => {
    expect(funnelSteps(t).map((step) => [step.key, step.value, step.conversion, step.ofRequests])).toEqual([
      ['requests', 40, null, 100],
      ['accepted', 30, 75, 75],
      ['pickedUp', 22, 73, 55],
      ['returned', 18, 82, 45],
    ]);
  });

  it('pertes et demandes encore ouvertes, en % des demandes reçues', () => {
    const outcomes = Object.fromEntries(funnelOutcomes(t).map((outcome) => [outcome.key, [outcome.value, outcome.share, outcome.tone]]));
    expect(outcomes.rejected).toEqual([4, 10, 'loss']);
    expect(outcomes.expiredUnanswered).toEqual([3, 8, 'loss']);
    expect(outcomes.noShow).toEqual([2, 5, 'loss']);
    expect(outcomes.awaitingDecision).toEqual([1, 3, 'open']);
  });

  it('aucune demande : pas de taux inventé', () => {
    const empty = parseTotals(totals({ requests: 0, accepted: 0, pickedUp: 0, returned: 0 }));
    expect(funnelSteps(empty).every((step) => step.conversion === null && step.ofRequests === null)).toBe(true);
  });
});

describe('délai de réponse', () => {
  it('résumé à partir de 3 réponses mesurées', () => {
    expect(responseSummary(parseTotals(totals()))).toEqual({ medianMinutes: 42, p90Minutes: 300, measured: 34, within1h: 59, within24h: 97 });
  });

  it('moins de 3 réponses : aucune médiane affichée', () => {
    expect(responseSummary(parseTotals(totals({ responsesMeasured: 2 })))).toBeNull();
    expect(responseSummary(parseTotals(totals({ responseMedianMinutes: null, responsesMeasured: 0 })))).toBeNull();
  });
});

describe('comparaison à la période précédente', () => {
  const report = parseAgencyAnalyticsReport(agencyReportJson());
  const metrics = Object.fromEntries(metricComparisons(report).map((metric) => [metric.key, metric]));

  it('mêmes indicateurs calculés sur les deux périodes', () => {
    expect(metrics.requests).toMatchObject({ current: 40, previous: 32 });
    expect(metrics.acceptanceRate).toMatchObject({ current: 75, previous: 63 });
    expect(metrics.averageBasket).toMatchObject({ current: 3000, previous: 3181.8 });
    expect(metrics.responseMedian).toMatchObject({ current: 42, previous: 60, invert: true });
    expect(metrics.occupancy).toMatchObject({ current: 40, previous: 30 });
  });

  it('volume : écart et % (base ≥ 10) ; taux : points ; délai : durée, une baisse est une bonne nouvelle', () => {
    expect(comparisonBadge(metrics.requests)).toEqual({ text: '+8 (+25 %)', direction: 'up', tone: 'good' });
    expect(comparisonBadge(metrics.acceptanceRate)).toEqual({ text: '+12 pts', direction: 'up', tone: 'good' });
    expect(comparisonBadge(metrics.responseMedian)).toEqual({ text: '−18 min', direction: 'down', tone: 'good' });
    expect(comparisonBadge(metrics.revenue)).toEqual({ text: '+20 %', direction: 'up', tone: 'good' });
    expect(comparisonBadge(metrics.rejectionRate)).toMatchObject({ direction: 'down', tone: 'good' });
  });

  it('valeur manquante d’un côté : pas de comparaison ; égalité : « stable »', () => {
    const missing: MetricComparison = { key: 'x', label: 'x', unit: 'minutes', current: 30, previous: null };
    expect(comparisonBadge(missing)).toBeNull();
    expect(comparisonBadge({ ...missing, unit: 'count', previous: 30 })).toEqual({ text: 'stable', direction: 'flat', tone: 'neutral' });
  });

  it('petite base : écart absolu sans pourcentage trompeur', () => {
    expect(comparisonBadge({ key: 'x', label: 'x', unit: 'count', current: 3, previous: 2 })?.text).toBe('+1');
  });
});

describe('libellés et périodes', () => {
  it('mois en français, sans décalage de fuseau', () => {
    expect(monthLabel('2026-10')).toBe('oct. 26');
    expect(monthLabel('2026-01', 'long')).toBe('janvier 2026');
  });

  it('préréglages : bornes incluses, dates locales', () => {
    const now = new Date(2026, 10, 15, 23, 30);
    expect(resolveAnalyticsRange('7d', now)).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(resolveAnalyticsRange('30d', now)).toEqual({ from: '2026-10-17', to: '2026-11-15' });
    expect(resolveAnalyticsRange('12m', now)).toEqual({ from: '2025-11-16', to: '2026-11-15' });
    expect(resolveAnalyticsRange('ytd', now)).toEqual({ from: '2026-01-01', to: '2026-11-15' });
  });

  it('période personnalisée : ordre et durée maximale', () => {
    expect(rangeError('2026-10-01', '2026-10-30')).toBeNull();
    expect(rangeError('2026-10-30', '2026-10-01')).toMatch(/précéder/);
    expect(rangeError('2020-01-01', '2026-10-01')).toMatch(/3 ans/);
    expect(rangeError('', '2026-10-01')).toMatch(/invalides/);
  });
});

describe('export CSV', () => {
  it('agence : indicateurs comparés, entonnoir, mois, répartitions et détail par véhicule', () => {
    const csv = toCsv(agencyAnalyticsCsvRows(parseAgencyAnalyticsReport(agencyReportJson()), 'Agence Alpha'));
    expect(csv).toContain('Statistiques ClickDrive — Agence Alpha');
    expect(csv).toContain('Période;2026-10-01;2026-10-30;30 jours');
    expect(csv).toContain('Demandes reçues;40;32');
    expect(csv).toContain('Délai de réponse médian (min);42;60');
    expect(csv).toContain('Acceptées;30;75;75');
    expect(csv).toContain('2026-10;21;17;31000;8;15000;oui');
    expect(csv).toContain('Langue du client;');
    expect(csv).toContain('Néerlandais;10;25;6;18000');
    expect(csv).toContain('Renault Clio · A-2;Voiture;Économique;oui;30;0;0;0;0');
  });

  it('plateforme : réseau, classement (médiane masquée sous 3 réponses) et mouvements MRR', () => {
    const csv = toCsv(adminAnalyticsCsvRows(parseAdminAnalyticsReport(adminReportJson())));
    expect(csv).toContain('Agences sans demande sur la période;2');
    expect(csv).toContain('Agence Alpha;Nador;25;20;80;2;1;19;60000;35;22;4.6;12');
    expect(csv).toContain('Agence Sans Avis;;15;10;67;2;2;9;24000;;2;;0');
    expect(csv).toContain('MRR (DH par mois);1500');
    expect(csv).toContain('2026-10;1400;300;0;0;100;1;1;oui');
  });
});
