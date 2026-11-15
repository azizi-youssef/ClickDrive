import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS_DIR, createTestDatabase, errorOf } from './harness';

/**
 * Une migration appliquée sur une base sans le schéma de départ (projet vide, mauvais projet sélectionné
 * dans l'éditeur SQL) doit échouer tout de suite avec un message clair, sans rien créer.
 */
describe('Migrations de sécurité : prérequis vérifiés', () => {
  it.each([
    ['20261114000100_vehicle_capacity_enforcement.sql', 'Migration 20261114000100 : tables absentes'],
    ['20261115000100_vehicle_privileges_and_platform_policies.sql', 'Migration 20261115000100 : tables absentes'],
  ])('%s sur une base vide : message explicite, aucune application partielle', async (file, message) => {
    const db = await PGlite.create();
    try {
      const error = await errorOf(db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')));
      expect(error).toContain(message);
      expect(error).toContain('public.vehicles');
      await db.exec('ROLLBACK').catch(() => undefined);
      const { rows } = await db.query<{ fn: string | null }>(`SELECT to_regprocedure('public.enforce_vehicle_capacity()')::text AS fn`);
      expect(rows[0].fn).toBeNull();
    } finally {
      await db.close();
    }
  });
});

const migration = (file: string) => readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

describe('Statistiques (20261123000100, 20261123000200) : prérequis vérifiés', () => {
  it.each([
    ['20261123000100_business_intelligence_reports.sql', 'Migration 20261123000100 : tables absentes', 'public.admin_analytics_report(date,date)'],
    ['20261123000200_admin_subscription_statistics.sql', 'Migration 20261123000200 : tables absentes', 'public.admin_subscription_statistics()'],
  ])('%s sur une base vide : message explicite, rien de créé', async (file, message, fn) => {
    const db = await PGlite.create();
    try {
      expect(await errorOf(db.exec(migration(file)))).toContain(message);
      await db.exec('ROLLBACK').catch(() => undefined);
      const { rows } = await db.query<{ fn: string | null }>(`SELECT to_regprocedure($1)::text AS fn`, [fn]);
      expect(rows[0].fn).toBeNull();
    } finally {
      await db.close();
    }
  });

  it('migration antérieure sautée (customer_locale) : colonne et fichier nommés, rien d’appliqué, puis succès une fois rattrapée', async () => {
    const { db, migrations } = await createTestDatabase();
    try {
      const failed = migrations.find((report) => !report.ok);
      if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
      // Base dans l'état décrit : 20261111000100 jamais appliquée, statistiques pas encore installées
      await db.exec(`
        DROP FUNCTION public.admin_analytics_report(DATE, DATE);
        DROP FUNCTION public.agency_analytics_report(UUID, DATE, DATE);
        DROP FUNCTION public.analytics_breakdowns(UUID, DATE, DATE);
        DROP FUNCTION public.analytics_agency_ranking(DATE, DATE);
        DROP FUNCTION public.analytics_period_totals(UUID, DATE, DATE);
        DROP FUNCTION public.analytics_booking_facts(UUID, DATE, DATE);
        ALTER TABLE public.bookings DROP COLUMN customer_locale;
      `);

      const error = await errorOf(db.exec(migration('20261123000100_business_intelligence_reports.sql')));
      expect(error).toContain('Migration 20261123000100 : colonnes absentes de cette base : public.bookings.customer_locale (20261111000100_customer_locale.sql).');
      await db.exec('ROLLBACK').catch(() => undefined);
      const { rows } = await db.query<{ fn: string | null }>(`SELECT to_regprocedure('public.admin_analytics_report(date,date)')::text AS fn`);
      expect(rows[0].fn).toBeNull();

      // Rattrapage : la migration sautée, puis celle des statistiques
      await db.exec(migration('20261111000100_customer_locale.sql'));
      await db.exec(migration('20261123000100_business_intelligence_reports.sql'));
      const after = await db.query<{ fn: string | null }>(`SELECT to_regprocedure('public.admin_analytics_report(date,date)')::text AS fn`);
      expect(after.rows[0].fn).not.toBeNull();
      // Rejouée : sans effet (aucun doublon dans le journal MRR, fonctions remplacées)
      await db.exec(migration('20261123000100_business_intelligence_reports.sql'));
      await db.exec(migration('20261123000200_admin_subscription_statistics.sql'));
    } finally {
      await db.close();
    }
  });
});
