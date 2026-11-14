import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS_DIR, errorOf } from './harness';

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
