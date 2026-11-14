import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodType } from 'zod';
import { TrackingError, mapDbError } from './errors';

/** Ce dont les services ont besoin : injectable (client Supabase de l'utilisateur, service-role, ou double de test) */
export type TrackingDb = Pick<SupabaseClient, 'rpc' | 'from'>;

/**
 * Appelle une fonction SQL du module. Les erreurs PostgreSQL sont traduites en TrackingError ; si un schéma est
 * fourni, la réponse est validée (une dérive entre migration et code ne doit pas atteindre l'interface).
 */
export async function callRpc<T = unknown>(
  db: TrackingDb,
  fn: string,
  args: Record<string, unknown>,
  options: { schema?: ZodType; tag?: string } = {}
): Promise<T> {
  const tag = options.tag ?? fn;
  const { data, error } = await db.rpc(fn, args);
  if (error) throw mapDbError(error, tag);
  if (!options.schema) return data as T;
  const parsed = options.schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[Tracking ${tag}] Réponse inattendue de la base :`, parsed.error.issues.slice(0, 3).map((issue) => issue.path.join('.') + ' ' + issue.message));
    throw new TrackingError(500, 'INTERNAL', 'Une erreur est survenue. Réessayez dans un instant.');
  }
  return parsed.data as T;
}
