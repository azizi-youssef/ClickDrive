/**
 * Adresse e-mail d'un client qui n'en a pas donné.
 *
 * bookings.customer_email est NOT NULL et sert de clé « client » (regroupement des dossiers d'un même
 * client) : une demande sans e-mail y reçoit une adresse de substitution « <chiffres du téléphone>@clickdrive.ma ».
 * Aucune boîte ne la lit : elle n'est jamais affichée comme une vraie adresse ni utilisée pour un envoi
 * (un envoi rebondirait, et une boîte « attrape-tout » du domaine recevrait les données du client).
 * Même motif côté base : migration 20261121000100 (sélection des relances).
 */

const PLACEHOLDER_DOMAIN = 'clickdrive.ma';
const PLACEHOLDER_PATTERN = /^[0-9]*@clickdrive\.ma$/i;

/** Adresse de substitution enregistrée pour une demande sans e-mail */
export function placeholderCustomerEmail(phone: string): string {
  return `${phone.replace(/[^0-9]/g, '')}@${PLACEHOLDER_DOMAIN}`;
}

/** Vrai pour une adresse de substitution (jamais une vraie boîte du client) */
export function isPlaceholderCustomerEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && PLACEHOLDER_PATTERN.test(email.trim());
}

/** Adresse à laquelle écrire au client, ou null s'il n'en a pas donné */
export function deliverableCustomerEmail(email: string | null | undefined): string | null {
  const value = email?.trim();
  return value && !isPlaceholderCustomerEmail(value) ? value : null;
}
