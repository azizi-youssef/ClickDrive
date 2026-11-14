/**
 * Erreurs du module de suivi GPS et traduction des erreurs PostgreSQL/PostgREST en réponses HTTP.
 * Les messages renvoyés au navigateur sont neutres : le détail technique n'est journalisé que côté serveur.
 */

export type TrackingErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'DEVICE_ALREADY_REGISTERED'
  | 'VEHICLE_ALREADY_HAS_TRACKER'
  | 'GEOFENCE_NAME_TAKEN'
  | 'LIMIT_REACHED'
  | 'PROVIDER_PENDING'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL';

export class TrackingError extends Error {
  readonly status: number;
  readonly code: TrackingErrorCode;

  constructor(status: number, code: TrackingErrorCode, message: string) {
    super(message);
    this.name = 'TrackingError';
    this.status = status;
    this.code = code;
  }
}

export type DbErrorLike = { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };

/** Traduit une erreur retournée par supabase-js (code SQLSTATE dans `code`) */
export function mapDbError(error: DbErrorLike, tag: string): TrackingError {
  const code = error.code ?? '';
  const text = `${error.message ?? ''} ${error.details ?? ''}`;

  if (code === '42501') return new TrackingError(403, 'FORBIDDEN', 'Accès refusé.');
  if (code === 'P0002') return new TrackingError(404, 'NOT_FOUND', 'Élément introuvable.');
  if (code === '23505') {
    if (text.includes('uq_vehicle_trackers_vehicle')) {
      return new TrackingError(409, 'VEHICLE_ALREADY_HAS_TRACKER', 'Ce véhicule possède déjà un boîtier GPS.');
    }
    if (text.includes('uq_vehicle_trackers_device_active')) {
      // Même message que l'appareil appartienne à cette agence ou à une autre : aucune fuite entre agences
      return new TrackingError(409, 'DEVICE_ALREADY_REGISTERED', 'Ce boîtier est déjà enregistré.');
    }
    if (text.includes('uq_vehicle_geofences_name')) {
      return new TrackingError(409, 'GEOFENCE_NAME_TAKEN', 'Une zone porte déjà ce nom.');
    }
    return new TrackingError(409, 'CONFLICT', 'Cette opération entre en conflit avec un élément existant.');
  }
  if (code === '54000') return new TrackingError(409, 'LIMIT_REACHED', 'La limite de zones de l’agence est atteinte.');
  if (code === '23514') {
    if (text.includes('tracking_settings_speed_limit_required')) {
      return new TrackingError(422, 'VALIDATION', 'Renseignez une limite de vitesse pour activer l’alerte.');
    }
    return new TrackingError(422, 'VALIDATION', 'Valeur refusée : elle sort des limites autorisées.');
  }
  if (code === '23503') return new TrackingError(422, 'VALIDATION', 'Référence invalide.');
  if (code === '22023') {
    // Messages levés par nos fonctions (plage de dates, curseur…) : sûrs à renvoyer
    return new TrackingError(422, 'VALIDATION', publicValidationMessage(error.message));
  }
  if (code === '22P02' || code === '22007' || code === '22008' || code === '22003') {
    return new TrackingError(422, 'VALIDATION', 'Valeur invalide.');
  }
  if (code === 'PGRST202' || code === '42883' || code === '42P01') {
    console.error(`[Tracking ${tag}] Schéma incomplet : appliquez les migrations 20261119000100 et 20261119000200.`, error.message);
    return new TrackingError(503, 'SERVICE_UNAVAILABLE', 'Le suivi GPS n’est pas disponible pour le moment.');
  }
  console.error(`[Tracking ${tag}] Erreur base de données`, { code, message: error.message });
  return new TrackingError(500, 'INTERNAL', 'Une erreur est survenue. Réessayez dans un instant.');
}

function publicValidationMessage(message: string | null | undefined): string {
  if (!message) return 'Valeur invalide.';
  if (/31 days/.test(message)) return 'La période ne peut pas dépasser 31 jours.';
  if (/93 days/.test(message)) return 'La période ne peut pas dépasser 93 jours.';
  if (/cursor/.test(message)) return 'Curseur de pagination invalide.';
  if (/unknown setting|unknown tracker field/.test(message)) return 'Paramètre inconnu.';
  if (/reason/.test(message)) return 'Un motif d’au moins 10 caractères est requis.';
  if (/duration/.test(message)) return 'La durée doit être comprise entre 5 et 120 minutes.';
  if (/disconnected/.test(message)) return 'Ce boîtier est déconnecté.';
  return 'Valeur invalide.';
}
