/**
 * Détection d'une base pas encore migrée pour les motos
 * (migration backend/supabase/migrations/20261106000100_motorcycle_rentals.sql).
 * Les voitures continuent de fonctionner sans la migration ; seules les motos l'exigent.
 */

export const MOTORCYCLE_SCHEMA_MISSING_MESSAGE =
  "L'ajout de motos n'est pas encore activé sur ClickDrive. Réessayez plus tard ou contactez le support ClickDrive.";

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/** Colonne inconnue (42703 / PGRST204) ou contrainte de catégorie d'origine (23514) */
export function isMotorcycleSchemaMissing(error: DbError): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  if (code === '42703' || code === 'PGRST204') {
    return /vehicle_type|engine_cc|license_required/.test(message);
  }
  if (code === '23514') return message.includes('category');
  return false;
}
