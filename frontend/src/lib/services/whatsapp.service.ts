import { createHmac, timingSafeEqual } from 'node:crypto';
import { Booking } from '@/types';
import { createAdminClient } from '@/lib/supabase/server';
import { signedBookingPdfPath } from '@/lib/auth/booking-pdf-link';
import { maskPhone, withRetry } from '@/lib/notifications/retry';
import { bookingStatusLabel } from '@/lib/bookings/status';
import { CLICKDRIVE_WHATSAPP_NUMBER, SUPPORT_HOURS_SUMMARY } from '@/lib/constants/contact';
import { isValidBookingReference } from '@/lib/utils/reference';
import { isUuid } from '@/lib/availability/status';

/**
 * ========================================================================
 * Service WhatsApp Business — ClickDrive
 * Gère l'envoi de notifications via WhatsApp Business Cloud API (Meta Graph),
 * l'enregistrement des identifiants de messages (wamid) et la résilience aux erreurs.
 * ========================================================================
 */

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  /** SKIPPED : non envoyé (hors de la fenêtre de 24 h sans modèle approuvé) — jamais présenté comme envoyé */
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'SIMULATED' | 'SKIPPED';
  recipient: string;
  templateName?: string;
  error?: string;
  timestamp: string;
}

export interface WhatsAppMessageLog {
  id: string;
  messageId: string;
  recipientPhone: string;
  bookingRef?: string;
  type: 'TEMPLATE' | 'TEXT';
  templateName?: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'SIMULATED';
  error?: string;
  sentAt: string;
  payloadSummary: Record<string, unknown>;
}

export interface WhatsAppSendOptions {
  bookingRef?: string;
  bookingId?: string;
  agencyId?: string;
  language?: string;
}

export interface DeliveryMeetingNotificationParams {
  meetingPoint: string;
  scheduledAt: string;
  agentName?: string;
  agentPhone?: string;
  instructions?: string;
  flightNumber?: string;
}

export interface HandoverSummaryNotificationParams {
  type: 'PICKUP' | 'RETURN';
  mileage: number;
  fuelLevel: string;
  cleanliness?: string;
  damages?: string;
  depositStatus?: string;
  agentName?: string;
}

export interface InboundMessageEvent {
  from: string;
  name?: string;
  messageId: string;
  timestamp: string;
  type: 'text' | 'button' | 'interactive' | 'other';
  body: string;
  buttonPayload?: string;
}

export interface InboundStatusEvent {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipientId: string;
  timestamp: string;
  errors?: any[];
}

/**
 * Intention exprimée par un client. Aucune n'exécute de transition de réservation :
 * HELP, STATUS et CANCEL_REQUEST donnent une information ou orientent vers le bon canal.
 */
export type InboundIntent = 'HELP' | 'STATUS' | 'CANCEL_REQUEST' | 'DEFAULT';

export interface InboundActionResult {
  intent: InboundIntent;
  bookingRef?: string;
  customerPhone: string;
  actionTaken: string;
  replySent?: string;
}

/** Colonnes lues pour répondre à un client (aucune pièce d'identité, aucune donnée financière interne) */
const INBOUND_BOOKING_COLUMNS =
  'id, reference, booking_ref, customer_name, customer_phone, status, start_date, end_date, pickup_time, ' +
  'pickup_location, agency_id, vehicle:vehicles(brand, model), agency:agencies(name, phone, whatsapp)';

type InboundBooking = {
  id: string;
  reference: string | null;
  booking_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  pickup_time: string | null;
  pickup_location: string | null;
  agency_id: string | null;
  vehicle: { brand: string; model: string } | null;
  agency: { name: string; phone: string | null; whatsapp: string | null } | null;
};

/**
 * Commandes reconnues : le message entier (référence de dossier retirée) doit être exactement l'une d'elles.
 * « oui », « ok », « non », « non merci », « stop »… ne sont pas des commandes.
 */
const INBOUND_COMMANDS: Record<string, Exclude<InboundIntent, 'DEFAULT'>> = {
  aide: 'HELP',
  help: 'HELP',
  assistance: 'HELP',
  statut: 'STATUS',
  status: 'STATUS',
  suivi: 'STATUS',
  annuler: 'CANCEL_REQUEST',
  annulation: 'CANCEL_REQUEST',
  cancel: 'CANCEL_REQUEST',
};

const INBOUND_ACTION_LABELS: Record<InboundIntent, string> = {
  HELP: "Guide d'assistance envoyé (aucune modification)",
  STATUS: 'Statut communiqué (aucune modification)',
  CANCEL_REQUEST: "Orientation vers l'espace client / l'agence (aucune modification)",
  DEFAULT: "Menu d'accueil envoyé (aucune modification)",
};

const BOOKING_REFERENCE_IN_TEXT = /(?:CD-\d{4}-\d{6}|#?NRD-\d{4,6})/gi;

/** Référence de dossier citée dans le message (format strict), sinon null */
export function extractBookingReference(text: string): string | null {
  const match = text.match(BOOKING_REFERENCE_IN_TEXT)?.[0];
  if (!match) return null;
  const ref = match.replace(/^#/, '').toUpperCase();
  return isValidBookingReference(ref) ? ref : null;
}

function normalizeCommand(value: string): string {
  return value
    .replace(BOOKING_REFERENCE_IN_TEXT, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Intention explicite : commande exacte (texte ou identifiant de bouton), sinon DEFAULT */
export function detectInboundIntent(text: string, buttonPayload?: string): InboundIntent {
  for (const candidate of [buttonPayload, text]) {
    if (!candidate) continue;
    const intent = INBOUND_COMMANDS[normalizeCommand(candidate)];
    if (intent) return intent;
  }
  return 'DEFAULT';
}

/** Variantes de saisie du numéro de l'expéditeur (le résultat est revérifié après normalisation) */
function phoneVariants(normalized: string): string[] {
  const variants = new Set([normalized, `+${normalized}`, `00${normalized}`]);
  if (normalized.startsWith('212') && normalized.length === 12) variants.add(`0${normalized.slice(3)}`);
  return [...variants];
}

/** Variables d'environnement des modèles de notification opérationnelle (docs/whatsapp-templates.md) */
const DELIVERY_MEETING_TEMPLATE_ENV = 'WHATSAPP_TEMPLATE_DELIVERY_MEETING';
const HANDOVER_SUMMARY_TEMPLATE_ENV = 'WHATSAPP_TEMPLATE_HANDOVER_SUMMARY';

function templateNameFromEnv(variable: string): string | null {
  const value = process.env[variable]?.trim();
  return value ? value : null;
}

/** Paramètre de modèle : pas de saut de ligne ni de tabulation (refusés par Meta), longueur bornée */
function toTemplateParameter(value: unknown): string {
  const text = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim();
  return (text || '—').slice(0, 300);
}

/** Message journalisé (sans texte), tel que lu par la page d'administration */
export type WhatsAppMessageRecord = {
  id: string;
  wamid: string | null;
  direction: 'OUTBOUND' | 'INBOUND';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SIMULATED' | 'RECEIVED';
  phone: string;
  message_type: 'TEXT' | 'TEMPLATE' | 'INBOUND';
  template_name: string | null;
  booking_ref: string | null;
  error: string | null;
  status_at: string | null;
  created_at: string;
};

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://clickdrive.ma').replace(/\/+$/, '');
}

const INBOUND_MENU =
  `• *AIDE* : rendez-vous et contacts\n` +
  `• *STATUT* : où en est votre demande\n` +
  `• *ANNULER* : comment annuler une réservation`;

/** Réponse automatique : information seulement, jamais l'annonce d'une modification */
function buildInboundReply(intent: InboundIntent, booking: InboundBooking | null, customerName: string): string {
  const ref = booking ? booking.reference || booking.booking_ref || '' : '';
  const supportLine = `Assistance ClickDrive (${SUPPORT_HOURS_SUMMARY}) : *+${CLICKDRIVE_WHATSAPP_NUMBER}*`;
  const agencyPhone = booking?.agency?.whatsapp || booking?.agency?.phone || null;
  const agencyLine = booking?.agency?.name && agencyPhone ? `• Agence ${booking.agency.name} : *${agencyPhone}*\n` : '';
  const trackingUrl = ref ? `${appBaseUrl()}/account/bookings/${encodeURIComponent(ref)}` : `${appBaseUrl()}/account`;

  if (intent === 'HELP') {
    const vehicle = booking?.vehicle ? ` (${booking.vehicle.brand} ${booking.vehicle.model})` : '';
    return (
      `📍 *Assistance ClickDrive*\n\n` +
      `Bonjour *${customerName}*,\n` +
      (booking
        ? `Votre dossier *${ref}*${vehicle} :\n` +
          `• Prise en charge : *${booking.pickup_location || "à confirmer avec l'agence"}*\n` +
          (booking.start_date ? `• Date : *${booking.start_date}${booking.pickup_time ? ` à ${booking.pickup_time.slice(0, 5)}` : ''}*\n` : '') +
          agencyLine
        : '') +
      `• ${supportLine}\n\n` +
      INBOUND_MENU
    );
  }

  if (intent === 'STATUS') {
    if (!booking) {
      return (
        `Bonjour *${customerName}*,\n` +
        `Aucune réservation n'est associée à ce numéro. Écrivez *STATUT* depuis le numéro indiqué lors de la demande, ` +
        `ou consultez votre espace client : ${trackingUrl}`
      );
    }
    return (
      `Bonjour *${customerName}*,\n` +
      `Dossier *${ref}* : *${bookingStatusLabel(booking.status, 'fr', 'customer')}*.\n` +
      `Détails : ${trackingUrl}`
    );
  }

  if (intent === 'CANCEL_REQUEST') {
    return (
      `Bonjour *${customerName}*,\n` +
      `Votre réservation n'a pas été modifiée : une annulation ne se fait pas par message WhatsApp.\n` +
      `• Votre espace client : ${trackingUrl}\n` +
      (agencyLine || '') +
      `• ${supportLine}`
    );
  }

  return (
    `Bonjour *${customerName}* !\n\n` +
    `Bienvenue sur le service WhatsApp de *ClickDrive*. Ce canal ne modifie pas vos réservations.\n` +
    `${INBOUND_MENU}\n\n` +
    `Un conseiller vous répondra dans les plus brefs délais si nécessaire.`
  );
}

export interface WebhookProcessResult {
  processedMessages: number;
  processedStatuses: number;
  /** Messages entrants déjà traités (renvoi du webhook par Meta) : ignorés */
  duplicateMessages?: number;
  results: InboundActionResult[];
}

export class WhatsAppService {

  /**
   * Vérifie si les identifiants officiels WhatsApp Business Cloud API sont configurés
   */
  public isConfigured(): boolean {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    return Boolean(token && phoneId && token.trim().length > 10 && phoneId.trim().length > 3);
  }

  /**
   * Normalise un numéro de téléphone au format international attendu par WhatsApp (E.164 sans le '+')
   * Ex: "06 12 34 56 78" -> "212612345678"
   * Ex: "+212 612-345678" -> "212612345678"
   */
  public normalizePhoneNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Remplacer 00 en tête par +
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.slice(2);
    }

    // Gestion du format local marocain (06... ou 07...)
    if (/^0[67]\d{8}$/.test(cleaned)) {
      return `212${cleaned.slice(1)}`;
    }

    // Format déjà préfixé par +
    if (cleaned.startsWith('+')) {
      return cleaned.slice(1);
    }

    // Si commence déjà par 212
    if (cleaned.startsWith('212') && cleaned.length === 12) {
      return cleaned;
    }

    return cleaned;
  }

  /**
   * Valide si le numéro est exploitable pour WhatsApp
   */
  public isValidPhoneNumber(phone: string): boolean {
    const normalized = this.normalizePhoneNumber(phone);
    return /^\d{8,15}$/.test(normalized);
  }

  /**
   * Génère un lien URL direct WhatsApp (Click to Chat)
   */
  public generateDirectChatUrl(phone: string, defaultText: string = ''): string {
    const normalized = this.normalizePhoneNumber(phone);
    const query = defaultText ? `?text=${encodeURIComponent(defaultText)}` : '';
    return `https://wa.me/${normalized}${query}`;
  }

  /**
   * Envoi de message texte libre (utilise la session WhatsApp ouverte ou mode simulation)
   */
  public async sendTextMessage(
    recipientPhone: string,
    messageText: string,
    options: WhatsAppSendOptions = {}
  ): Promise<WhatsAppMessageResult> {
    const normalized = this.normalizePhoneNumber(recipientPhone);

    if (!this.isValidPhoneNumber(normalized)) {
      return this.recordFailure(
        normalized,
        'Numéro de téléphone invalide ou format non reconnu.',
        'TEXT',
        undefined,
        options
      );
    }

    if (!this.isConfigured()) {
      return this.handleNotConfigured(normalized, 'TEXT', undefined, messageText, options);
    }

    return this.deliver(
      normalized,
      'TEXT',
      undefined,
      options,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalized,
        type: 'text',
        text: { preview_url: true, body: messageText },
      },
      { length: messageText.length }
    );
  }

  /**
   * Envoi d'un template WhatsApp Business officiel
   */
  public async sendTemplateMessage(
    recipientPhone: string,
    templateName: string,
    parameters: Array<{ type: string; text?: string }>,
    options: WhatsAppSendOptions = {}
  ): Promise<WhatsAppMessageResult> {
    const normalized = this.normalizePhoneNumber(recipientPhone);
    const languageCode = options.language || 'fr';

    if (!this.isValidPhoneNumber(normalized)) {
      return this.recordFailure(
        normalized,
        'Numéro de téléphone invalide.',
        'TEMPLATE',
        templateName,
        options
      );
    }

    if (!this.isConfigured()) {
      return this.handleNotConfigured(normalized, 'TEMPLATE', templateName, JSON.stringify(parameters), options);
    }

    return this.deliver(
      normalized,
      'TEMPLATE',
      templateName,
      options,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalized,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [{ type: 'body', parameters }],
        },
      },
      { parameterCount: parameters.length }
    );
  }

  /**
   * Appel Graph API avec nouvelles tentatives contrôlées (voir lib/notifications/retry.ts).
   * Le résumé enregistré ne contient ni le texte du message ni les paramètres (données personnelles).
   */
  private async deliver(
    recipient: string,
    type: 'TEMPLATE' | 'TEXT',
    templateName: string | undefined,
    options: WhatsAppSendOptions,
    payload: Record<string, unknown>,
    summary: Record<string, unknown>
  ): Promise<WhatsAppMessageResult> {
    const token = process.env.WHATSAPP_API_TOKEN || process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;

    const { outcome, attempts } = await withRetry<Record<string, unknown>>(async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const retryAfter = Number(response.headers.get('retry-after'));
        return { kind: 'response', status: response.status, data, retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null };
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError';
        return isTimeout ? { kind: 'timeout', error } : { kind: 'network-error', error };
      }
    });

    if (outcome.kind !== 'response') {
      const message =
        outcome.kind === 'timeout'
          ? 'Délai dépassé lors de l\'envoi WhatsApp (non renvoyé pour éviter un doublon).'
          : `Erreur réseau lors de l'envoi WhatsApp : ${outcome.error.message}`;
      return this.recordFailure(recipient, message, type, templateName, options, { attempts });
    }
    if (outcome.status < 200 || outcome.status >= 300) {
      return this.recordFailure(recipient, this.formatMetaApiError(outcome.data), type, templateName, options, {
        attempts,
        httpStatus: outcome.status,
        meta: outcome.data,
      });
    }

    const messages = outcome.data?.messages as Array<{ id?: string }> | undefined;
    const wamid = messages?.[0]?.id || `wamid.${Date.now()}`;
    return this.recordSuccess(recipient, wamid, type, templateName, options, { ...summary, attempts });
  }

  /**
   * WhatsApp non configuré : simulation en développement uniquement.
   * En production, c'est un échec explicite (jamais un faux succès).
   */
  private handleNotConfigured(
    recipient: string,
    type: 'TEMPLATE' | 'TEXT',
    templateName: string | undefined,
    content: string,
    options: WhatsAppSendOptions
  ): Promise<WhatsAppMessageResult> {
    if (process.env.NODE_ENV === 'production') {
      return this.recordFailure(
        recipient,
        'WhatsApp Business non configuré (WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID) : message non envoyé.',
        type,
        templateName,
        options
      );
    }
    return this.simulateSend(recipient, type, templateName, content, options);
  }

  // ========================================================================
  // NOTIFICATIONS MÉTIER CLICKDRIVE
  // ========================================================================

  /**
   * Notification 1 : Confirmation de réservation envoyée au client
   */
  public async sendBookingConfirmation(
    booking: Booking,
    options: WhatsAppSendOptions = {}
  ): Promise<WhatsAppMessageResult> {
    const ref = booking.reference || booking.booking_ref || '';
    const phone = booking.customer_phone;
    const vehicleName = booking.vehicle
      ? `${booking.vehicle.brand} ${booking.vehicle.model}`
      : 'Véhicule sélectionné';
    const dates = `${booking.start_date} → ${booking.end_date}`;

    const text =
      `🚗 *CLICKDRIVE — Confirmation de Réservation*\n\n` +
      `Bonjour *${booking.customer_name}*,\n\n` +
      `Votre réservation a bien été enregistrée :\n` +
      `• *Réf. dossier :* ${ref}\n` +
      `• *Véhicule :* ${vehicleName}\n` +
      `• *Période :* ${dates} (${booking.total_days} jours)\n` +
      `• *Lieu de prise en charge :* ${booking.pickup_location || 'Agence'}\n` +
      `• *Montant total :* ${booking.total_price} MAD\n` +
      `• *Caution à l'arrivée :* ${booking.deposit_amount || 3000} MAD (empreinte)\n\n` +
      `Un agent vous contactera pour organiser l'accueil et la remise des clés.\n` +
      `📄 Suivi en direct : https://clickdrive.ma/account/bookings/${encodeURIComponent(ref)}`;

    return this.sendTextMessage(phone, text, {
      ...options,
      bookingRef: ref,
      bookingId: booking.id,
      agencyId: booking.agency_id,
    });
  }

  /**
   * Notification 2 : Alerte envoyée à l'agence pour toute nouvelle demande
   */
  public async sendAgencyNewBookingAlert(
    booking: Booking,
    agencyPhone: string,
    appUrl?: string
  ): Promise<WhatsAppMessageResult> {
    const baseUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://clickdrive.ma';
    const ref = booking.reference || booking.booking_ref || '';
    const pdfUrl = `${baseUrl}${signedBookingPdfPath(ref)}`;
    const vehicleName = booking.vehicle
      ? `${booking.vehicle.brand} ${booking.vehicle.model} (${booking.vehicle.year})`
      : 'Véhicule';

    const text =
      `🚨 *NOUVELLE DEMANDE DE LOCATION CLICKDRIVE*\n\n` +
      `*Dossier :* ${ref}\n` +
      `*Véhicule :* ${vehicleName}\n` +
      `*Client :* ${booking.customer_name} (${booking.customer_phone})\n` +
      `*Période :* du ${booking.start_date} au ${booking.end_date} (${booking.total_days} j)\n` +
      `*Rendez-vous :* ${booking.pickup_location}\n` +
      (booking.flight_number ? `*Vol d'arrivée :* ${booking.flight_number}\n` : '') +
      `*Total :* ${booking.total_price} MAD | *Caution :* ${booking.deposit_amount || 3000} MAD\n\n` +
      `📄 Fiche PDF : ${pdfUrl}\n` +
      `⚡ Valider : ${baseUrl}/agency?booking=${encodeURIComponent(ref)}`;

    return this.sendTextMessage(agencyPhone, text, {
      bookingRef: ref,
      bookingId: booking.id,
      agencyId: booking.agency_id,
    });
  }

  /**
   * Message à l'initiative de ClickDrive vers un client. WhatsApp refuse un texte libre hors de la fenêtre
   * de 24 h ouverte par le dernier message du client : on envoie alors le modèle approuvé s'il est configuré,
   * sinon rien (statut SKIPPED, jamais présenté comme envoyé).
   */
  public async sendCustomerMessage(
    phone: string,
    text: string,
    options: WhatsAppSendOptions,
    template: { name: string | null; parameters: unknown[] } | null
  ): Promise<WhatsAppMessageResult> {
    // Non configuré : simulation en développement, échec explicite en production (voir handleNotConfigured)
    if (!this.isConfigured()) return this.sendTextMessage(phone, text, options);

    if (await this.isConversationWindowOpen(phone)) return this.sendTextMessage(phone, text, options);
    if (template?.name) {
      return this.sendTemplateMessage(
        phone,
        template.name,
        template.parameters.map((value) => ({ type: 'text', text: toTemplateParameter(value) })),
        options
      );
    }

    console.warn(
      `[WhatsAppService] Message non envoyé à ${maskPhone(this.normalizePhoneNumber(phone))} : hors de la fenêtre de 24 h et aucun modèle configuré.`
    );
    return {
      success: false,
      status: 'SKIPPED',
      recipient: this.normalizePhoneNumber(phone),
      error: 'Hors de la fenêtre de 24 h : un modèle WhatsApp approuvé est nécessaire.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fenêtre de 24 h ouverte : le client a écrit il y a moins de 23 h (marge d'une heure).
   * Toute erreur de lecture vaut « fermée » : on n'envoie alors que des modèles.
   */
  public async isConversationWindowOpen(phone: string): Promise<boolean> {
    const normalized = this.normalizePhoneNumber(phone);
    if (!normalized) return false;
    try {
      const supabase = await createAdminClient();
      if (!supabase) return false;
      const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('direction', 'INBOUND')
        .eq('phone', normalized)
        .gte('created_at', since)
        .limit(1);
      if (error) {
        console.warn('[WhatsAppService] Fenêtre de 24 h invérifiable :', error.message);
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Notification 3 : Organisation du rendez-vous de livraison (Aéroport, Port, etc.)
   * Modèle (WHATSAPP_TEMPLATE_DELIVERY_MEETING) : {{1}} nom · {{2}} référence · {{3}} lieu · {{4}} date et heure · {{5}} consignes
   */
  public async sendDeliveryMeetingInvite(
    booking: Booking,
    params: DeliveryMeetingNotificationParams
  ): Promise<WhatsAppMessageResult> {
    const ref = booking.reference || booking.booking_ref || '';
    const text =
      `📍 *CLICKDRIVE — Organisation de votre Rendez-vous*\n\n` +
      `Bonjour *${booking.customer_name}*,\n\n` +
      `Votre rendez-vous pour la remise du véhicule est planifié :\n` +
      `• *Dossier :* ${ref}\n` +
      `• *Lieu :* ${params.meetingPoint}\n` +
      `• *Date & Heure :* ${params.scheduledAt}\n` +
      (params.flightNumber ? `• *Vol suivi :* ${params.flightNumber}\n` : '') +
      (params.agentName ? `• *Agent d'accueil :* ${params.agentName} (${params.agentPhone || ''})\n` : '') +
      (params.instructions ? `\nℹ️ *Consignes :* ${params.instructions}\n` : '') +
      `\nMerci d'avoir préparé votre permis de conduire original et pièce d'identité.`;

    const instructions = [params.agentName ? `Agent : ${params.agentName} ${params.agentPhone || ''}`.trim() : '', params.instructions || '']
      .filter(Boolean)
      .join(' — ');

    return this.sendCustomerMessage(
      booking.customer_phone,
      text,
      { bookingRef: ref, bookingId: booking.id, agencyId: booking.agency_id },
      {
        name: templateNameFromEnv(DELIVERY_MEETING_TEMPLATE_ENV),
        parameters: [booking.customer_name, ref, params.meetingPoint, params.scheduledAt, instructions || '—'],
      }
    );
  }

  /**
   * Notification 4 : Confirmation digitale de l'état des lieux (Départ / Restitution)
   * Modèle (WHATSAPP_TEMPLATE_HANDOVER_SUMMARY) : {{1}} nom · {{2}} référence · {{3}} « remise » ou « restitution »
   * · {{4}} kilométrage · {{5}} carburant · {{6}} caution
   */
  public async sendHandoverSummary(
    booking: Booking,
    params: HandoverSummaryNotificationParams
  ): Promise<WhatsAppMessageResult> {
    const ref = booking.reference || booking.booking_ref || '';
    const isPickup = params.type === 'PICKUP';
    const title = isPickup
      ? `🔑 *CLICKDRIVE — Remise des Clés Validée (Départ)*`
      : `🏁 *CLICKDRIVE — Restitution du Véhicule Validée*`;

    const text =
      `${title}\n\n` +
      `Bonjour *${booking.customer_name}*,\n\n` +
      `L'état des lieux digital du dossier *${ref}* a été enregistré :\n` +
      `• *Kilométrage relevé :* ${params.mileage.toLocaleString('fr-FR')} km\n` +
      `• *Niveau de carburant :* ${params.fuelLevel}\n` +
      (params.cleanliness ? `• *Propreté :* ${params.cleanliness}\n` : '') +
      (params.damages ? `• *Observations état :* ${params.damages}\n` : '') +
      (params.depositStatus ? `• *Statut caution :* ${params.depositStatus}\n` : '') +
      (params.agentName ? `• *Agent certifié :* ${params.agentName}\n` : '') +
      `\nMerci pour votre confiance avec ClickDrive !`;

    return this.sendCustomerMessage(
      booking.customer_phone,
      text,
      { bookingRef: ref, bookingId: booking.id, agencyId: booking.agency_id },
      {
        name: templateNameFromEnv(HANDOVER_SUMMARY_TEMPLATE_ENV),
        parameters: [
          booking.customer_name,
          ref,
          isPickup ? 'remise' : 'restitution',
          `${params.mileage.toLocaleString('fr-FR')} km`,
          params.fuelLevel,
          params.depositStatus || '—',
        ],
      }
    );
  }

  // ========================================================================
  // JOURNAL DES MESSAGES (whatsapp_messages + audit_logs)
  // ========================================================================

  /**
   * Derniers messages, lus en base (partagés par toutes les instances serveur).
   * Sans table (migration 20261117000100 non appliquée) ou sans clé service-role : liste vide, journalisée.
   */
  public async listRecentMessages(limit = 50): Promise<WhatsAppMessageRecord[]> {
    try {
      const supabase = await createAdminClient();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, wamid, direction, status, phone, message_type, template_name, booking_ref, error, status_at, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(1, limit), 200));
      if (error) {
        console.warn('[WhatsAppService] Journal des messages illisible :', error.message);
        return [];
      }
      return (data ?? []) as WhatsAppMessageRecord[];
    } catch (error) {
      console.warn('[WhatsAppService] Journal des messages illisible :', error instanceof Error ? error.message : error);
      return [];
    }
  }

  private async simulateSend(
    recipient: string,
    type: 'TEMPLATE' | 'TEXT',
    templateName: string | undefined,
    content: string,
    options: WhatsAppSendOptions
  ): Promise<WhatsAppMessageResult> {
    const simulatedId = `wamid.sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();

    console.log(`[WhatsAppService] [SIMULATED] Outbound to ${maskPhone(recipient)} (${content.length} caractères)`);

    await this.persistMessage(
      {
        id: crypto.randomUUID(),
        messageId: simulatedId,
        recipientPhone: recipient,
        bookingRef: options.bookingRef,
        type,
        templateName,
        status: 'SIMULATED',
        sentAt: timestamp,
        payloadSummary: { simulated: true, length: content.length },
      },
      options
    );

    return {
      success: true,
      messageId: simulatedId,
      status: 'SIMULATED',
      recipient,
      templateName,
      timestamp,
    };
  }

  private async recordSuccess(
    recipient: string,
    messageId: string,
    type: 'TEMPLATE' | 'TEXT',
    templateName: string | undefined,
    options: WhatsAppSendOptions,
    payloadSummary: Record<string, unknown>
  ): Promise<WhatsAppMessageResult> {
    const timestamp = new Date().toISOString();
    await this.persistMessage(
      {
        id: crypto.randomUUID(),
        messageId,
        recipientPhone: recipient,
        bookingRef: options.bookingRef,
        type,
        templateName,
        status: 'SENT',
        sentAt: timestamp,
        payloadSummary,
      },
      options
    );

    return {
      success: true,
      messageId,
      status: 'SENT',
      recipient,
      templateName,
      timestamp,
    };
  }

  private async recordFailure(
    recipient: string,
    errorMessage: string,
    type: 'TEMPLATE' | 'TEXT',
    templateName: string | undefined,
    options: WhatsAppSendOptions,
    rawErrorPayload?: unknown
  ): Promise<WhatsAppMessageResult> {
    const timestamp = new Date().toISOString();
    console.error(`[WhatsAppService] Failed to send to ${maskPhone(recipient)}: ${errorMessage}`);
    if (rawErrorPayload !== undefined) console.error('[WhatsAppService] Meta error detail:', rawErrorPayload);

    await this.persistMessage(
      {
        id: crypto.randomUUID(),
        messageId: '',
        recipientPhone: recipient,
        bookingRef: options.bookingRef,
        type,
        templateName,
        status: 'FAILED',
        error: errorMessage,
        sentAt: timestamp,
        payloadSummary: { error: errorMessage },
      },
      options
    );

    return {
      success: false,
      status: 'FAILED',
      recipient,
      templateName,
      error: errorMessage,
      timestamp,
    };
  }

  /**
   * Journal d'un envoi : whatsapp_messages (statut de livraison, sans texte) et audit_logs (trace de sécurité).
   * Attendu par l'appelant (aucune écriture perdue en fin de requête) ; un échec est journalisé, jamais masqué.
   */
  private async persistMessage(log: WhatsAppMessageLog, options: WhatsAppSendOptions): Promise<void> {
    try {
      const supabase = await createAdminClient();
      if (!supabase) return;
      const bookingId = options.bookingId && isUuid(options.bookingId) ? options.bookingId : null;
      const agencyId = options.agencyId && isUuid(options.agencyId) ? options.agencyId : null;

      const [messageRes, auditRes] = await Promise.all([
        supabase.rpc('record_whatsapp_outbound', {
          p_wamid: log.messageId || null,
          p_status: log.status,
          p_phone: log.recipientPhone,
          p_message_type: log.type,
          p_template_name: log.templateName ?? null,
          p_booking_id: bookingId,
          p_booking_ref: log.bookingRef ?? null,
          p_agency_id: agencyId,
          p_error: log.error ?? null,
        }),
        supabase.from('audit_logs').insert({
          action: log.status === 'FAILED' ? 'WHATSAPP_MESSAGE_FAILED' : 'WHATSAPP_MESSAGE_SENT',
          entity_type: 'whatsapp_notification',
          // Colonne NOT NULL : un envoi refusé avant Meta n'a pas de wamid (identifiant explicite, jamais un faux wamid)
          entity_id: log.messageId || `unsent:${log.id}`,
          agency_id: agencyId,
          metadata: {
            recipient: maskPhone(log.recipientPhone),
            bookingRef: log.bookingRef,
            status: log.status,
            type: log.type,
            template: log.templateName ?? null,
            error: log.error || null,
          },
        }),
      ]);
      if (messageRes.error) console.warn('[WhatsAppService] Message non journalisé :', messageRes.error.message);
      if (auditRes.error) console.warn('[WhatsAppService] Audit non enregistré :', auditRes.error.message);

      if (bookingId) {
        const { error } = await supabase.from('booking_events').insert({
          booking_id: bookingId,
          actor_role: 'SYSTEM',
          event_type: log.status === 'FAILED' ? 'WHATSAPP_NOTIFICATION_FAILED' : 'WHATSAPP_NOTIFICATION_SENT',
          metadata: {
            messageId: log.messageId || null,
            status: log.status,
            template: log.templateName ?? null,
          },
        });
        if (error) console.warn('[WhatsAppService] Historique de réservation non enregistré :', error.message);
      }
    } catch (err) {
      // Ne jamais bloquer l'envoi si la journalisation échoue
      console.warn('[WhatsAppService] Could not persist message log:', err instanceof Error ? err.message : err);
    }
  }

  /**
   * Message entrant : enregistré une seule fois par wamid. Renvoie « duplicate » si Meta renvoie un message
   * déjà traité (aucune nouvelle réponse), « new » sinon. Sans journal disponible : « unrecorded » (traité,
   * le dédoublonnage étant impossible).
   */
  private async claimInboundMessage(
    messageId: string,
    from: string,
    timestamp: string | undefined
  ): Promise<'new' | 'duplicate' | 'unrecorded'> {
    if (!messageId) return 'unrecorded';
    try {
      const supabase = await createAdminClient();
      if (!supabase) return 'unrecorded';
      const seconds = Number(timestamp);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .upsert(
          {
            wamid: messageId,
            direction: 'INBOUND',
            status: 'RECEIVED',
            phone: this.normalizePhoneNumber(from),
            message_type: 'INBOUND',
            status_at: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : new Date().toISOString(),
          },
          { onConflict: 'wamid', ignoreDuplicates: true }
        )
        .select('id');
      if (error) {
        console.warn('[WhatsAppService] Message entrant non journalisé (dédoublonnage impossible) :', error.message);
        return 'unrecorded';
      }
      return Array.isArray(data) && data.length > 0 ? 'new' : 'duplicate';
    } catch {
      return 'unrecorded';
    }
  }

  private formatMetaApiError(data: any): string {
    const err = data?.error;
    if (!err) return 'Erreur inconnue de l\'API WhatsApp Meta';

    const code = err.code ? `[Code ${err.code}] ` : '';
    const message = err.message || 'Détails non fournis';
    const fbtrace = err.fbtrace_id ? ` (Trace: ${err.fbtrace_id})` : '';

    return `${code}${message}${fbtrace}`;
  }

  // ========================================================================
  // RÉCEPTION BIDIRECTIONNELLE & WEBHOOK META BUSINESS
  // ========================================================================

  /**
   * Vérifie le webhook entrant lors de l'enregistrement chez Meta (Sécurisé R1)
   * - En production : rejette si WHATSAPP_WEBHOOK_VERIFY_TOKEN n'est pas défini (pas de fallback prévisible)
   * - Comparaison temporelle constante (timingSafeEqual) pour immuniser contre les attaques par canal auxiliaire
   */
  public verifyWebhook(mode: string | null, token: string | null, challenge: string | null): string | null {
    const isProduction = process.env.NODE_ENV === 'production';
    const envToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (!envToken) {
      if (isProduction) {
        console.error('[WhatsAppService] ERREUR CRITIQUE DE SÉCURITÉ : WHATSAPP_WEBHOOK_VERIFY_TOKEN absent en production. Requête Meta rejetée.');
        return null;
      }
      console.warn('[WhatsAppService] Avertissement : WHATSAPP_WEBHOOK_VERIFY_TOKEN non configuré dans .env.local, utilisation du fallback dev.');
    }

    const expectedToken = envToken || 'klickdrive_whatsapp_secure_webhook_token_2026';

    if (mode === 'subscribe' && token && challenge && this.timingSafeStringEqual(token, expectedToken)) {
      return challenge;
    }
    return null;
  }

  /**
   * Vérifie l'en-tête X-Hub-Signature-256 (HMAC-SHA256 du corps brut avec l'App Secret Meta).
   * - En production : rejette si WHATSAPP_APP_SECRET n'est pas défini
   * - En développement sans secret : accepte avec un avertissement
   */
  public verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;

    if (!appSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[WhatsAppService] ERREUR CRITIQUE DE SÉCURITÉ : WHATSAPP_APP_SECRET absent en production. Webhook rejeté.');
        return false;
      }
      console.warn('[WhatsAppService] Avertissement : WHATSAPP_APP_SECRET non configuré, signature du webhook non vérifiée (dev).');
      return true;
    }

    if (!signatureHeader?.startsWith('sha256=')) return false;
    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`;
    return this.timingSafeStringEqual(signatureHeader, expected);
  }

  /**
   * Comparaison en temps constant de deux chaînes pour parer les timing attacks
   */
  private timingSafeStringEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Traite la charge utile d'un webhook entrant de Meta WhatsApp Business
   */
  public async processWebhookPayload(payload: any): Promise<WebhookProcessResult> {
    const results: InboundActionResult[] = [];
    let processedMessages = 0;
    let processedStatuses = 0;
    let duplicateMessages = 0;

    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const val = change?.value;
        if (!val || val.messaging_product !== 'whatsapp') continue;

        // 1. Accusés de réception et livraison (sent, delivered, read, failed)
        if (Array.isArray(val.statuses)) {
          for (const st of val.statuses) {
            processedStatuses++;
            await this.handleStatusUpdate({
              messageId: st.id,
              status: st.status,
              recipientId: st.recipient_id,
              timestamp: st.timestamp,
              errors: st.errors,
            });
          }
        }

        // 2. Messages entrants (clients répondant par WhatsApp)
        if (Array.isArray(val.messages)) {
          const contact = val.contacts?.[0];
          const contactName = contact?.profile?.name;

          for (const msg of val.messages) {
            // Renvoi par Meta d'un message déjà traité : aucune nouvelle réponse
            if ((await this.claimInboundMessage(String(msg?.id ?? ''), String(msg?.from ?? ''), msg?.timestamp)) === 'duplicate') {
              duplicateMessages++;
              continue;
            }
            processedMessages++;
            let body = '';
            let buttonPayload: string | undefined;

            if (msg.type === 'text' && msg.text?.body) {
              body = msg.text.body;
            } else if (msg.type === 'button' && msg.button?.text) {
              body = msg.button.text;
              buttonPayload = msg.button.payload;
            } else if (msg.type === 'interactive') {
              body = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
              buttonPayload = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
            }

            const inboundEvent: InboundMessageEvent = {
              from: msg.from,
              name: contactName,
              messageId: msg.id,
              timestamp: msg.timestamp || new Date().toISOString(),
              type: msg.type,
              body,
              buttonPayload,
            };

            const actionResult = await this.handleInboundMessage(inboundEvent);
            results.push(actionResult);
          }
        }
      }
    }

    return {
      processedMessages,
      processedStatuses,
      duplicateMessages,
      results,
    };
  }

  /**
   * Message entrant d'un client. WhatsApp est un canal de communication, jamais un canal d'administration :
   * - aucun message ne confirme, n'annule ni ne modifie une réservation (l'agence décide par l'API
   *   authentifiée, le client passe par son espace ou par l'agence) ;
   * - seules des commandes exactes sont reconnues (AIDE, STATUT, ANNULER) ; tout autre message, y compris
   *   « oui », « ok », « non merci » ou « stop », reçoit le menu, sans aucune écriture métier ;
   * - un dossier n'est associé qu'à son titulaire : numéro de l'expéditeur identique à celui de la réservation.
   */
  public async handleInboundMessage(inbound: InboundMessageEvent): Promise<InboundActionResult> {
    const fromNormalized = this.normalizePhoneNumber(inbound.from);
    const explicitRef = extractBookingReference(`${inbound.body || ''} ${inbound.buttonPayload || ''}`);
    const intent = detectInboundIntent(inbound.body || '', inbound.buttonPayload);

    const booking = fromNormalized ? await this.findCustomerBooking(fromNormalized, explicitRef) : null;
    const bookingRef = booking ? booking.reference || booking.booking_ref || undefined : undefined;
    const customerName = booking?.customer_name || inbound.name || 'Cher client';
    const replyText = buildInboundReply(intent, booking, customerName);
    const actionTaken = INBOUND_ACTION_LABELS[intent];

    await this.sendTextMessage(inbound.from, replyText, {
      bookingRef,
      bookingId: booking?.id,
      agencyId: booking?.agency_id ?? undefined,
    });

    try {
      const supabase = await createAdminClient();
      if (supabase) {
        const { error } = await supabase.from('audit_logs').insert({
          action: 'WHATSAPP_INBOUND_MESSAGE',
          entity_type: 'whatsapp_webhook',
          entity_id: inbound.messageId,
          agency_id: booking?.agency_id || null,
          metadata: {
            from: inbound.from,
            body: (inbound.body || '').slice(0, 500),
            intent,
            actionTaken,
            bookingRef: bookingRef ?? null,
          },
        });
        if (error) console.warn('[WhatsAppService] Inbound audit log not recorded:', error.message);
      }
    } catch (auditError) {
      console.warn('[WhatsAppService] Inbound audit log not recorded:', auditError instanceof Error ? auditError.message : auditError);
    }

    return {
      intent,
      bookingRef,
      customerPhone: inbound.from,
      actionTaken,
      replySent: replyText,
    };
  }

  /**
   * Réservation du titulaire du numéro (lecture seule, colonnes explicites).
   * Client service-role justifié : le webhook n'a pas de session utilisateur ; l'expéditeur est authentifié
   * par la signature Meta et le dossier n'est retenu que si son téléphone correspond à l'expéditeur.
   * Toute erreur donne « aucun dossier » : la réponse reste générique.
   */
  private async findCustomerBooking(fromNormalized: string, explicitRef: string | null): Promise<InboundBooking | null> {
    let supabase: Awaited<ReturnType<typeof createAdminClient>>;
    try {
      supabase = await createAdminClient();
    } catch {
      return null;
    }
    if (!supabase) return null;

    const ownedBySender = (row: InboundBooking | null): row is InboundBooking =>
      Boolean(row && this.normalizePhoneNumber(row.customer_phone || '') === fromNormalized);

    try {
      if (explicitRef) {
        const { data, error } = await supabase
          .from('bookings')
          .select(INBOUND_BOOKING_COLUMNS)
          .or(`reference.eq.${explicitRef},booking_ref.eq.${explicitRef}`)
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn('[WhatsAppService] Inbound booking lookup failed:', error.message);
          return null;
        }
        // Une référence citée ne suffit pas : seul le titulaire du dossier obtient ses informations.
        const row = data as unknown as InboundBooking | null;
        if (ownedBySender(row)) return row;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(INBOUND_BOOKING_COLUMNS)
        .in('customer_phone', phoneVariants(fromNormalized))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[WhatsAppService] Inbound booking lookup failed:', error.message);
        return null;
      }
      const row = data as unknown as InboundBooking | null;
      return ownedBySender(row) ? row : null;
    } catch (lookupError) {
      console.warn('[WhatsAppService] Inbound booking lookup threw:', lookupError instanceof Error ? lookupError.message : lookupError);
      return null;
    }
  }

  /**
   * Accusé de réception Meta (sent, delivered, read, failed) : enregistré dans whatsapp_messages sans jamais
   * faire reculer un statut (un « delivered » arrivé après « read » est ignoré). L'entrée audit_logs de l'envoi
   * n'est plus modifiée. Renvoie le statut retenu, ou null s'il n'a pas pu être enregistré.
   */
  public async handleStatusUpdate(event: InboundStatusEvent): Promise<string | null> {
    const statusMap: Record<string, string> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };
    const mapped = statusMap[String(event.status ?? '').toLowerCase()];
    if (!mapped || !event.messageId) return null;

    const seconds = Number(event.timestamp);
    const errorText =
      Array.isArray(event.errors) && event.errors.length > 0
        ? event.errors.map((e) => `${e?.code ?? ''} ${e?.title ?? e?.message ?? ''}`.trim()).join(' ; ').slice(0, 500)
        : null;

    try {
      const supabase = await createAdminClient();
      if (!supabase) return null;
      const { data, error } = await supabase.rpc('record_whatsapp_status', {
        p_wamid: event.messageId,
        p_status: mapped,
        p_phone: this.normalizePhoneNumber(event.recipientId || ''),
        p_error: errorText,
        p_status_at: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null,
      });
      if (error) {
        console.warn('[WhatsAppService] Statut de livraison non enregistré :', error.message);
        return null;
      }
      return typeof data === 'string' ? data : null;
    } catch {
      return null;
    }
  }
}

export const whatsappService = new WhatsAppService();
