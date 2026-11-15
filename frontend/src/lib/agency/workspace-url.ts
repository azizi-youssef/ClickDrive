/** Filtres portés par l'adresse d'une vue (la liste des réservations garde son filtre de statut au rechargement, au partage et à « Précédent »). */
export type WorkspaceFilters = { status?: string };

/**
 * Adresse d'une vue de l'espace agence : chaque section et la réservation ouverte ont leur lien
 * (partage, actualisation, Précédent). Les e-mails et WhatsApp envoient vers `/agency?booking=REF`.
 */
export function workspaceUrl(section: string, bookingRef?: string | null, filters?: WorkspaceFilters): string {
  const params = new URLSearchParams();
  if (section !== 'overview') params.set('section', section);
  if (filters?.status) params.set('status', filters.status);
  if (bookingRef) params.set('booking', bookingRef);
  const query = params.toString();
  return query ? `/agency?${query}` : '/agency';
}

/** Section demandée par l'adresse : une section connue, sinon les réservations (lien vers un dossier) ou l'accueil */
export function sectionFromUrl(
  sectionParam: string | null,
  bookingParam: string | null,
  knownSections: ReadonlySet<string>
): string {
  if (sectionParam && knownSections.has(sectionParam)) return sectionParam;
  return bookingParam ? 'bookings' : 'overview';
}

/** Filtre de statut de l'adresse : une valeur connue, sinon aucun filtre (une adresse modifiée à la main ne casse rien) */
export function statusFromUrl(statusParam: string | null, knownStatuses: ReadonlySet<string>): string {
  return statusParam && knownStatuses.has(statusParam) ? statusParam : '';
}
