import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Liens signés (HMAC-SHA256) donnés au client par e-mail ou WhatsApp, sans compte :
 *  - « track » : page de suivi de la demande (/suivi/<référence>) ;
 *  - « review » : formulaire d'avis après restitution (/avis/<référence>).
 * Même secret que les liens PDF ; chaque usage a son propre préfixe, un lien ne vaut que pour son usage.
 */

export type BookingLinkPurpose = 'track' | 'review';

const TTL_SECONDS: Record<BookingLinkPurpose, number> = {
  track: 120 * 24 * 60 * 60,
  review: 60 * 24 * 60 * 60,
};

const PATHS: Record<BookingLinkPurpose, string> = {
  track: '/suivi',
  review: '/avis',
};

function linkSecret(): string | null {
  return process.env.BOOKING_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function sign(purpose: BookingLinkPurpose, reference: string, expiresAt: number, secret: string): string {
  return createHmac('sha256', secret)
    .update(`booking-${purpose}:${reference.trim().toUpperCase()}:${expiresAt}`)
    .digest('base64url');
}

/** Chemin relatif signé, ou null sans secret serveur (le lien ne serait pas vérifiable) */
export function signedBookingLink(purpose: BookingLinkPurpose, reference: string, now = Date.now()): string | null {
  const secret = linkSecret();
  if (!secret || !reference.trim()) return null;
  const expiresAt = Math.floor(now / 1000) + TTL_SECONDS[purpose];
  return `${PATHS[purpose]}/${encodeURIComponent(reference.trim())}?exp=${expiresAt}&sig=${sign(purpose, reference, expiresAt, secret)}`;
}

export function verifyBookingLink(
  purpose: BookingLinkPurpose,
  reference: string,
  exp: string | null | undefined,
  sig: string | null | undefined,
  now = Date.now()
): boolean {
  const secret = linkSecret();
  if (!secret || !exp || !sig || !/^\d+$/.test(exp)) return false;
  const expiresAt = Number(exp);
  if (expiresAt < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(sign(purpose, reference, expiresAt, secret));
  const received = Buffer.from(sig);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
