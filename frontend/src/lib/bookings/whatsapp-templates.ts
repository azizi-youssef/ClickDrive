import { whatsappService } from '@/lib/services/whatsapp.service';
import type { Locale } from '@/lib/i18n/config';

/**
 * Notifications WhatsApp automatiques d'une demande de réservation.
 *
 * WhatsApp n'autorise une entreprise à écrire en premier qu'avec un MODÈLE approuvé par Meta :
 * un message libre est refusé hors de la fenêtre de 24 h ouverte par le client. Chaque envoi
 * passe donc par un modèle dont le nom est fourni par une variable d'environnement ; sans ce nom,
 * l'envoi est « skipped » (jamais présenté comme envoyé). Textes à soumettre à Meta :
 * docs/whatsapp-templates.md (l'ordre des paramètres ci-dessous est celui des {{n}}).
 */

export const BOOKING_TEMPLATES = {
  /** {{1}} référence · {{2}} véhicule · {{3}} début · {{4}} fin · {{5}} lieu · {{6}} lien espace agence */
  agencyNewRequest: 'WHATSAPP_TEMPLATE_AGENCY_NEW_REQUEST',
  /** {{1}} référence · {{2}} véhicule · {{3}} attente (« 45 min ») · {{4}} lien espace agence */
  agencyReminder: 'WHATSAPP_TEMPLATE_AGENCY_REMINDER',
  /** {{1}} prénom · {{2}} référence · {{3}} véhicule · {{4}} agence · {{5}} lien de suivi */
  requestReceived: 'WHATSAPP_TEMPLATE_REQUEST_RECEIVED',
  /** {{1}} prénom · {{2}} agence · {{3}} référence · {{4}} véhicule · {{5}} début · {{6}} fin · {{7}} lien de suivi */
  requestConfirmed: 'WHATSAPP_TEMPLATE_REQUEST_CONFIRMED',
  /** {{1}} prénom · {{2}} agence · {{3}} référence · {{4}} lien de suivi */
  requestRejected: 'WHATSAPP_TEMPLATE_REQUEST_REJECTED',
  /** {{1}} prénom · {{2}} agence · {{3}} référence · {{4}} lien de suivi */
  requestAlternative: 'WHATSAPP_TEMPLATE_REQUEST_ALTERNATIVE',
  /** {{1}} prénom · {{2}} véhicule · {{3}} lien d'avis */
  reviewRequest: 'WHATSAPP_TEMPLATE_REVIEW_REQUEST',
} as const;

export type BookingTemplateKey = keyof typeof BOOKING_TEMPLATES;

export type TemplateOutcome = 'sent' | 'skipped' | 'failed';

/**
 * Langue du modèle : Meta approuve chaque traduction d'un modèle séparément, et un envoi dans une
 * langue non approuvée est refusé. WHATSAPP_TEMPLATE_LANGUAGES liste les langues approuvées
 * (« fr,en,nl ») ; une autre langue, ou l'absence de la variable, envoie la version française.
 */
export function templateLanguage(locale: Locale | null | undefined): string {
  const approved = (process.env.WHATSAPP_TEMPLATE_LANGUAGES ?? 'fr')
    .split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
  return locale && approved.includes(locale) ? locale : 'fr';
}

export function templateName(key: BookingTemplateKey): string | null {
  const value = process.env[BOOKING_TEMPLATES[key]]?.trim();
  return value ? value : null;
}

/** Paramètre de modèle : pas de saut de ligne ni de tabulation (refusés par Meta), longueur bornée */
export function templateParameter(value: unknown): string {
  const text = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim();
  return (text || '—').slice(0, 300);
}

export async function sendBookingTemplate(
  key: BookingTemplateKey,
  phone: string | null | undefined,
  parameters: readonly unknown[],
  context: { bookingRef: string; bookingId?: string; agencyId?: string; locale?: Locale }
): Promise<TemplateOutcome> {
  const name = templateName(key);
  if (!name) return 'skipped';
  if (!phone || phone.replace(/\D/g, '').length < 8) return 'skipped';
  try {
    const result = await whatsappService.sendTemplateMessage(
      phone,
      name,
      parameters.map((value) => ({ type: 'text', text: templateParameter(value) })),
      {
        language: templateLanguage(context.locale),
        bookingRef: context.bookingRef,
        bookingId: context.bookingId,
        agencyId: context.agencyId,
      }
    );
    return result.success ? 'sent' : 'failed';
  } catch (error) {
    console.error(`[WhatsApp] Modèle ${key} non envoyé pour ${context.bookingRef} :`, error instanceof Error ? error.message : error);
    return 'failed';
  }
}
