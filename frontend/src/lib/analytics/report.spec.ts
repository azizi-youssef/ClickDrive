import { describe, expect, it } from 'vitest';
import { adminReportJson, agencyReportJson } from '@/tests/fixtures/analytics-report';
import { AnalyticsShapeError, parseAdminAnalyticsReport, parseAgencyAnalyticsReport } from './report';
import { readRangeParams } from './range-params';

describe('lecture des rapports de statistiques', () => {
  it('rapport agence : valeurs reprises telles quelles, détail par véhicule', () => {
    const report = parseAgencyAnalyticsReport(agencyReportJson());
    expect(report.period).toEqual({ from: '2026-10-01', to: '2026-10-30', days: 30, previousFrom: '2026-09-01', previousTo: '2026-09-30' });
    expect(report.current.requests).toBe(40);
    expect(report.monthly).toHaveLength(12);
    expect(report.monthly.at(-1)?.partial).toBe(true);
    expect(report.fleet.items?.map((item) => item.vehicleId)).toEqual(['v1', 'v2', 'v3']);
    expect(report.previousFleet.items).toBeNull();
  });

  it('nombres renvoyés en texte (numeric PostgreSQL) acceptés', () => {
    const json = agencyReportJson();
    (json.current as Record<string, unknown>).revenue = '84000.50';
    expect(parseAgencyAnalyticsReport(json).current.revenue).toBe(84000.5);
  });

  it('médiane absente : null, jamais zéro', () => {
    const json = agencyReportJson();
    (json.current as Record<string, unknown>).responseMedianMinutes = null;
    expect(parseAgencyAnalyticsReport(json).current.responseMedianMinutes).toBeNull();
  });

  it('valeur non numérique : erreur explicite plutôt qu’un faux zéro', () => {
    const json = agencyReportJson();
    (json.current as Record<string, unknown>).requests = 'beaucoup';
    expect(() => parseAgencyAnalyticsReport(json)).toThrow(AnalyticsShapeError);
    expect(() => parseAgencyAnalyticsReport(json)).toThrow(/current\.requests/);
    expect(() => parseAgencyAnalyticsReport(null)).toThrow(AnalyticsShapeError);
  });

  it('rapport plateforme : réseau, classement (note absente = null), abonnements', () => {
    const report = parseAdminAnalyticsReport(adminReportJson());
    expect(report.network.agenciesWithoutRequests).toBe(2);
    expect(report.agencies.map((agency) => agency.rating)).toEqual([4.6, null]);
    expect(report.subscriptions.mrr).toBe(1500);
    expect(report.subscriptions.monthly.at(-1)).toMatchObject({ month: '2026-10', newMrr: 300, churnedMrr: 100, partial: true });
  });
});

describe('paramètres de période des routes', () => {
  const read = (query: string) => readRangeParams(new URLSearchParams(query));

  it('absents : valeurs par défaut de la base', () => {
    expect(read('')).toEqual({ ok: true, range: { from: undefined, to: undefined } });
  });

  it('dates valides', () => {
    expect(read('from=2026-10-01&to=2026-10-30')).toEqual({ ok: true, range: { from: '2026-10-01', to: '2026-10-30' } });
  });

  it('format, date impossible, ordre et durée refusés', () => {
    expect(read('from=01/10/2026')).toEqual({ ok: false, error: 'Date de début invalide.' });
    expect(read('to=2026-02-31')).toEqual({ ok: false, error: 'Date de fin invalide.' });
    expect(read('from=2026-10-30&to=2026-10-01')).toMatchObject({ ok: false });
    expect(read('from=2020-01-01&to=2026-10-01')).toMatchObject({ ok: false });
  });
});
