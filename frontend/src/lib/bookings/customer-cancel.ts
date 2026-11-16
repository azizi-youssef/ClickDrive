/**
 * Annulation d'une demande par le client lui-même (lien de suivi signé) : possible tant que l'agence
 * n'a pas accepté. Une réservation acceptée relève du contrat de l'agence : le client la contacte.
 * Même liste que la fonction SQL customer_cancel_booking_request (migration 20261124000100).
 */
export const CUSTOMER_CANCELLABLE_STATUSES = [
  'PENDING',
  'REQUESTED',
  'UNDER_REVIEW',
  'SENT_TO_AGENCY',
  'AGENCY_REVIEW',
  'ALTERNATIVE_PROPOSED',
] as const;

export function canCustomerCancel(status: string | null | undefined): boolean {
  return (CUSTOMER_CANCELLABLE_STATUSES as readonly string[]).includes(String(status ?? '').toUpperCase());
}

/** Motifs proposés au client (facultatifs) ; texte libre refusé pour ne rien stocker d'inattendu */
export const CUSTOMER_CANCEL_REASONS = ['plans_changed', 'found_elsewhere', 'dates_changed', 'other'] as const;
export type CustomerCancelReason = (typeof CUSTOMER_CANCEL_REASONS)[number];

export function isCustomerCancelReason(value: unknown): value is CustomerCancelReason {
  return typeof value === 'string' && (CUSTOMER_CANCEL_REASONS as readonly string[]).includes(value);
}
