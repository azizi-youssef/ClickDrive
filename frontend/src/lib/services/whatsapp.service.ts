import { createHmac, timingSafeEqual } from 'node:crypto';
import { Booking } from '@/types';
import { createAdminClient } from '@/lib/supabase/server';
import { signedBookingPdfPath } from '@/lib/auth/booking-pdf-link';
import { maskPhone, withRetry } from '@/lib/notifications/retry';

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
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'SIMULATED';
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

export interface InboundActionResult {
  intent: 'CONFIRM' | 'CANCEL' | 'HELP' | 'DEFAULT';
  bookingRef?: string;
  customerPhone: string;
  actionTaken: string;
  replySent?: string;
}

export interface WebhookProcessResult {
  processedMessages: number;
  processedStatuses: number;
  results: InboundActionResult[];
}

export class WhatsAppService {
  private inMemoryLogs: WhatsAppMessageLog[] = [];
  private readonly maxInMemoryLogs = 100;

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
  ): WhatsAppMessageResult {
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
   * Notification 3 : Organisation du rendez-vous de livraison (Aéroport, Port, etc.)
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

    return this.sendTextMessage(booking.customer_phone, text, {
      bookingRef: ref,
      bookingId: booking.id,
      agencyId: booking.agency_id,
    });
  }

  /**
   * Notification 4 : Confirmation digitale de l'état des lieux (Départ / Restitution)
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

    return this.sendTextMessage(booking.customer_phone, text, {
      bookingRef: ref,
      bookingId: booking.id,
      agencyId: booking.agency_id,
    });
  }

  // ========================================================================
  // AUDIT, LOGGING ET HISTORIQUE
  // ========================================================================

  public getRecentLogs(limit: number = 20): WhatsAppMessageLog[] {
    return this.inMemoryLogs.slice(0, limit);
  }

  public getLogsByBooking(bookingRef: string): WhatsAppMessageLog[] {
    return this.inMemoryLogs.filter((l) => l.bookingRef === bookingRef);
  }

  private simulateSend(
    recipient: string,
    type: 'TEMPLATE' | 'TEXT',
    templateName: string | undefined,
    content: string,
    options: WhatsAppSendOptions
  ): WhatsAppMessageResult {
    const simulatedId = `wamid.sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();

    console.log(`[WhatsAppService] [SIMULATED] Outbound to ${maskPhone(recipient)} (${content.length} caractères)`);

    const logEntry: WhatsAppMessageLog = {
      id: crypto.randomUUID(),
      messageId: simulatedId,
      recipientPhone: recipient,
      bookingRef: options.bookingRef,
      type,
      templateName,
      status: 'SIMULATED',
      sentAt: timestamp,
      payloadSummary: { simulated: true, length: content.length },
    };

    this.pushLog(logEntry);
    this.persistAuditEvent(logEntry, options);

    return {
      success: true,
      messageId: simulatedId,
      status: 'SIMULATED',
      recipient,
      templateName,
      timestamp,
    };
  }

  private recordSuccess(
    recipient: string,
    messageId: string,
    type: 'TEMPLATE' | 'TEXT',
    templateName: string | undefined,
    options: WhatsAppSendOptions,
    payloadSummary: Record<string, unknown>
  ): WhatsAppMessageResult {
    const timestamp = new Date().toISOString();
    const logEntry: WhatsAppMessageLog = {
      id: crypto.randomUUID(),
      messageId,
      recipientPhone: recipient,
      bookingRef: options.bookingRef,
      type,
      templateName,
      status: 'SENT',
      sentAt: timestamp,
      payloadSummary,
    };

    this.pushLog(logEntry);
    this.persistAuditEvent(logEntry, options);

    return {
      success: true,
      messageId,
      status: 'SENT',
      recipient,
      templateName,
      timestamp,
    };
  }

  private recordFailure(
    recipient: string,
    errorMessage: string,
    type: 'TEMPLATE' | 'TEXT',
    templateName: string | undefined,
    options: WhatsAppSendOptions,
    rawErrorPayload?: unknown
  ): WhatsAppMessageResult {
    const timestamp = new Date().toISOString();
    const fakeId = `err_${Date.now()}`;
    console.error(`[WhatsAppService] Failed to send to ${maskPhone(recipient)}: ${errorMessage}`);

    const logEntry: WhatsAppMessageLog = {
      id: crypto.randomUUID(),
      messageId: fakeId,
      recipientPhone: recipient,
      bookingRef: options.bookingRef,
      type,
      templateName,
      status: 'FAILED',
      error: errorMessage,
      sentAt: timestamp,
      payloadSummary: { error: errorMessage, raw: rawErrorPayload },
    };

    this.pushLog(logEntry);
    this.persistAuditEvent(logEntry, options);

    return {
      success: false,
      messageId: fakeId,
      status: 'FAILED',
      recipient,
      templateName,
      error: errorMessage,
      timestamp,
    };
  }

  private pushLog(log: WhatsAppMessageLog) {
    this.inMemoryLogs.unshift(log);
    if (this.inMemoryLogs.length > this.maxInMemoryLogs) {
      this.inMemoryLogs.pop();
    }
  }

  private async persistAuditEvent(log: WhatsAppMessageLog, options: WhatsAppSendOptions) {
    try {
      const supabase = await createAdminClient();
      if (!supabase) return;

      // 1. Audit log général
      await supabase.from('audit_logs').insert({
        action: log.status === 'FAILED' ? 'WHATSAPP_MESSAGE_FAILED' : 'WHATSAPP_MESSAGE_SENT',
        entity_type: 'whatsapp_notification',
        entity_id: log.messageId,
        agency_id: options.agencyId || null,
        metadata: {
          recipient: log.recipientPhone,
          bookingRef: log.bookingRef,
          status: log.status,
          type: log.type,
          error: log.error || null,
        },
      });

      // 2. Timeline de la réservation si bookingId présent
      if (options.bookingId) {
        await supabase.from('booking_events').insert({
          booking_id: options.bookingId,
          actor_role: 'SYSTEM',
          event_type: log.status === 'FAILED' ? 'WHATSAPP_NOTIFICATION_FAILED' : 'WHATSAPP_NOTIFICATION_SENT',
          metadata: {
            messageId: log.messageId,
            recipient: log.recipientPhone,
            status: log.status,
            template: log.templateName,
          },
        });
      }
    } catch (err) {
      // Éviter de bloquer l'application si l'écriture de l'audit échoue
      console.warn('[WhatsAppService] Could not persist audit event:', err);
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
      results,
    };
  }

  /**
   * Analyse et traite un message entrant d'un client
   */
  public async handleInboundMessage(inbound: InboundMessageEvent): Promise<InboundActionResult> {
    const fromNormalized = this.normalizePhoneNumber(inbound.from);
    const bodyRaw = inbound.body || inbound.buttonPayload || '';
    const bodyClean = bodyRaw.trim().toLowerCase();

    // 1. Détection de l'intention du client (word-boundary matching, priorité CONFIRM > CANCEL > HELP)
    let intent: 'CONFIRM' | 'CANCEL' | 'HELP' | 'DEFAULT' = 'DEFAULT';

    const wordBoundary = (kw: string) => new RegExp(`(?:^|\\s|[^\\w])${kw}(?:$|\\s|[^\\w])`, 'i');

    const confirmKeywords = ['oui', 'confirmer', 'confirme', 'confirm', 'valider', 'valide', 'accepter', 'ok', 'daccord'];
    const cancelKeywords = ['annuler', 'annule', 'cancel', 'annulation', 'refuser', 'refuse', 'stop', '\\bnon\\b'];
    // AIDE keywords: eviter faux positifs sur sous-chaines courantes comme "ou"
    const helpKeywords = ['\\baide\\b', '\\bhelp\\b', '\\blieu\\b', '\\badresse\\b', 'localisation', '\\bcontact\\b', '\\bagence\\b', '\\bnumero\\b', 'numéro', '\\bretard\\b', '\\bou\\b', '\\boù\\b'];

    if (confirmKeywords.some((kw) => wordBoundary(kw).test(bodyClean))) {
      intent = 'CONFIRM';
    } else if (cancelKeywords.some((kw) => new RegExp(kw, 'i').test(bodyClean))) {
      intent = 'CANCEL';
    } else if (helpKeywords.some((kw) => new RegExp(kw, 'i').test(bodyClean))) {
      intent = 'HELP';
    }

    // 2. Recherche du dossier de réservation associé
    let booking: any = null;
    const refMatch = bodyRaw.match(/(?:#?NRD-\d+|CD-[A-Z0-9-]+)/i);
    const explicitRef = refMatch ? refMatch[0].replace(/^#/, '') : null;

    try {
      const supabase = await createAdminClient();
      if (supabase) {
        if (explicitRef) {
          const { data } = await supabase
            .from('bookings')
            .select('*, vehicle:vehicles(brand, model, year), agency:agencies(name, phone, whatsapp)')
            .eq('booking_ref', explicitRef.toUpperCase())
            .limit(1)
            .maybeSingle();
          // Une référence citée ne suffit pas : seul le titulaire du dossier peut agir dessus.
          booking =
            data && fromNormalized && this.normalizePhoneNumber(data.customer_phone || '') === fromNormalized
              ? data
              : null;
        }

        if (!booking && fromNormalized) {
          const phoneVariants = [
            fromNormalized,
            `+${fromNormalized}`,
            `0${fromNormalized.slice(3)}`,
            fromNormalized.slice(3),
          ];

          const { data } = await supabase
            .from('bookings')
            .select('*, vehicle:vehicles(brand, model, year), agency:agencies(name, phone, whatsapp)')
            .in('customer_phone', phoneVariants)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          booking = data;
        }
      }
    } catch (dbErr) {
      console.warn('[WhatsAppService] Error fetching booking for inbound message:', dbErr);
    }

    const bookingRef = booking?.booking_ref || explicitRef || undefined;
    const customerName = booking?.customer_name || inbound.name || 'Cher client';
    const vehicleName = booking?.vehicle
      ? `${booking.vehicle.brand} ${booking.vehicle.model}`
      : 'votre véhicule';
    const pickupLocation = booking?.pickup_location || 'Aéroport Nador Al-Aroui';

    let actionTaken = 'Message reçu et consigné';
    let replyText = '';

    if (intent === 'CONFIRM') {
      if (booking && booking.status === 'PENDING') {
        try {
          const supabase = await createAdminClient();
          if (supabase) {
            await supabase
              .from('bookings')
              .update({
                status: 'CONFIRMED',
                updated_at: new Date().toISOString(),
                notes: `${booking.notes || ''}\n[WhatsApp ${new Date().toISOString()}] Confirmé par le client via WhatsApp.`.trim(),
              })
              .eq('id', booking.id);

            await supabase.from('audit_logs').insert({
              action: 'WHATSAPP_INBOUND_CONFIRMED',
              entity_type: 'booking',
              entity_id: booking.id,
              agency_id: booking.agency_id,
              metadata: {
                messageId: inbound.messageId,
                from: inbound.from,
                body: inbound.body,
                bookingRef,
              },
            });
          }
        } catch (updateErr) {
          console.warn('[WhatsAppService] Error confirming booking from WhatsApp:', updateErr);
        }

        replyText =
          `✅ *Réservation confirmée avec succès !*\n\n` +
          `Bonjour *${customerName}*,\n` +
          `Votre confirmation pour le dossier *${bookingRef}* a bien été prise en compte.\n\n` +
          `🚗 *Véhicule :* ${vehicleName}\n` +
          `📍 *Lieu de prise en charge :* ${pickupLocation}\n` +
          `📅 *Période :* du ${booking.start_date} au ${booking.end_date}\n\n` +
          `L'agence partenaire prépare votre véhicule et vous accueillera à votre arrivée.\n` +
          `📄 Détails : https://clickdrive.ma/account/bookings/${encodeURIComponent(bookingRef || '')}`;
        actionTaken = `Dossier ${bookingRef} passé au statut CONFIRMED`;
      } else if (booking && booking.status === 'CONFIRMED') {
        replyText =
          `ℹ️ *Réservation déjà confirmée*\n\n` +
          `Bonjour *${customerName}*, votre réservation *${bookingRef}* est déjà activement confirmée.\n` +
          `Notre agent d'accueil vous attendra au lieu prévu (*${pickupLocation}*).`;
        actionTaken = `Dossier ${bookingRef} déjà confirmé`;
      } else {
        replyText =
          `✅ *Confirmation reçue*\n\n` +
          `Merci pour votre message ! Notre équipe a bien pris note de votre confirmation.`;
        actionTaken = `Confirmation générale enregistrée`;
      }
    } else if (intent === 'CANCEL') {
      if (booking && (booking.status === 'PENDING' || booking.status === 'CONFIRMED')) {
        try {
          const supabase = await createAdminClient();
          if (supabase) {
            await supabase
              .from('bookings')
              .update({
                status: 'CANCELLED',
                updated_at: new Date().toISOString(),
                notes: `${booking.notes || ''}\n[WhatsApp ${new Date().toISOString()}] Annulé par le client via WhatsApp.`.trim(),
              })
              .eq('id', booking.id);

            await supabase.from('audit_logs').insert({
              action: 'WHATSAPP_INBOUND_CANCELLED',
              entity_type: 'booking',
              entity_id: booking.id,
              agency_id: booking.agency_id,
              metadata: {
                messageId: inbound.messageId,
                from: inbound.from,
                body: inbound.body,
                bookingRef,
              },
            });
          }
        } catch (updateErr) {
          console.warn('[WhatsAppService] Error cancelling booking from WhatsApp:', updateErr);
        }

        replyText =
          `❌ *Annulation prise en compte*\n\n` +
          `Bonjour *${customerName}*,\n` +
          `Votre demande d'annulation pour le dossier *${bookingRef}* a bien été enregistrée. Aucun montant ne vous sera débité.\n\n` +
          `Au plaisir de vous accueillir prochainement sur ClickDrive.ma.`;
        actionTaken = `Dossier ${bookingRef} passé au statut CANCELLED`;
      } else {
        replyText =
          `❌ *Annulation*\n\n` +
          `Votre demande d'annulation a bien été enregistrée par le service client ClickDrive.`;
        actionTaken = `Demande d'annulation enregistrée`;
      }
    } else if (intent === 'HELP') {
      replyText =
        `📍 *Assistance ClickDrive — Conciergerie*\n\n` +
        `Bonjour *${customerName}*,\n` +
        (bookingRef ? `Pour votre dossier *${bookingRef}* :\n` : '') +
        `• Prise en charge : *${pickupLocation}*\n` +
        (booking?.start_date ? `• Date : *${booking.start_date} à ${booking.pickup_time || '10:00'}*\n` : '') +
        `• Assistance ClickDrive (lun–ven 9h–18h, sam. 9h–13h) : *+212 661-987654*\n\n` +
        `Répondez *CONFIRMER* pour valider ou *ANNULER* pour vous désister.`;
      actionTaken = `Guide d'assistance envoyé`;
    } else {
      replyText =
        `Bonjour *${customerName}* !\n\n` +
        `Bienvenue sur le service WhatsApp de *ClickDrive.ma*.\n` +
        `• Répondez *OUI* ou *CONFIRMER* pour valider votre réservation.\n` +
        `• Répondez *ANNULER* si vous souhaitez annuler.\n` +
        `• Répondez *AIDE* pour contacter notre conciergerie.\n\n` +
        `Un conseiller vous répondra dans les plus brefs délais si nécessaire.`;
      actionTaken = `Réponse automatique d'accueil transmise`;
    }

    if (replyText) {
      await this.sendTextMessage(inbound.from, replyText, {
        bookingRef,
        bookingId: booking?.id,
        agencyId: booking?.agency_id,
      });
    }

    try {
      const supabase = await createAdminClient();
      if (supabase) {
        await supabase.from('audit_logs').insert({
          action: 'WHATSAPP_INBOUND_MESSAGE',
          entity_type: 'whatsapp_webhook',
          entity_id: inbound.messageId,
          agency_id: booking?.agency_id || null,
          metadata: {
            from: inbound.from,
            body: inbound.body,
            intent,
            actionTaken,
            bookingRef,
          },
        });
      }
    } catch {
      // Ignorer si échec audit log
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
   * Met à jour le statut d'un message lors d'un accusé de réception Meta
   */
  public async handleStatusUpdate(event: InboundStatusEvent): Promise<void> {
    const statusMap: Record<string, WhatsAppMessageLog['status']> = {
      delivered: 'DELIVERED',
      read: 'DELIVERED',
      sent: 'SENT',
      failed: 'FAILED',
    };

    const mapped = statusMap[event.status.toLowerCase()] || 'SENT';

    const target = this.inMemoryLogs.find((l) => l.messageId === event.messageId);
    if (target) {
      target.status = mapped;
      if (event.errors && event.errors.length > 0) {
        target.error = JSON.stringify(event.errors);
      }
    }

    try {
      const supabase = await createAdminClient();
      if (supabase) {
        await supabase
          .from('audit_logs')
          .update({
            metadata: {
              status: mapped,
              deliveryTimestamp: event.timestamp,
              recipient: event.recipientId,
              errors: event.errors || null,
            },
          })
          .eq('entity_id', event.messageId);
      }
    } catch {
      // Pas bloquant
    }
  }
}

export const whatsappService = new WhatsAppService();
