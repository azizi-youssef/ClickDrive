/**
 * Envoi d'e-mails transactionnels via l'API HTTP de Resend (aucune dépendance supplémentaire).
 *
 * Configuration (variables d'environnement serveur) :
 *   RESEND_API_KEY      clé d'API Resend
 *   EMAIL_FROM          expéditeur vérifié, ex. « ClickDrive <notifications@clickdrive.ma> »
 *   CONTACT_INBOX_EMAIL boîte de l'équipe qui reçoit les messages de contact (défaut : contact@clickdrive.ma)
 *
 * Ne simule jamais un succès : sans configuration, l'envoi est « skipped » et l'appelant le sait.
 * Les adresses des destinataires ne sont jamais écrites dans les journaux.
 */

export type EmailMessage = {
  to: string | readonly string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type EmailResult =
  | { status: 'sent'; id: string }
  | { status: 'skipped'; reason: 'not_configured' | 'invalid_recipient' }
  | { status: 'failed'; error: string };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_PATTERN = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export const DEFAULT_CONTACT_INBOX = 'contact@clickdrive.ma';

export function isEmailAddress(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value.trim());
}

export function emailConfiguration(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

export function contactInbox(): string {
  const configured = process.env.CONTACT_INBOX_EMAIL?.trim();
  return isEmailAddress(configured) ? configured : DEFAULT_CONTACT_INBOX;
}

export async function sendEmail(message: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  // Destinataire absent (champ non chargé, client sans e-mail) : « skipped », jamais d'exception
  const candidates: unknown[] = Array.isArray(message.to) ? [...message.to] : [message.to];
  const recipients = candidates
    .filter((address): address is string => typeof address === 'string')
    .map((address) => address.trim())
    .filter(isEmailAddress);
  if (recipients.length === 0) return { status: 'skipped', reason: 'invalid_recipient' };

  const configuration = emailConfiguration();
  if (!configuration) {
    console.warn(`[Email] RESEND_API_KEY ou EMAIL_FROM absent : e-mail non envoyé (« ${message.subject} »).`);
    return { status: 'skipped', reason: 'not_configured' };
  }

  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: configuration.from,
        to: recipients,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(isEmailAddress(message.replyTo) ? { reply_to: message.replyTo.trim() } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { id?: unknown; message?: unknown } | null;
    if (!response.ok) {
      const error = typeof body?.message === 'string' ? body.message : `HTTP ${response.status}`;
      console.error(`[Email] Envoi refusé par le fournisseur (« ${message.subject} ») : ${error}`);
      return { status: 'failed', error };
    }
    return { status: 'sent', id: typeof body?.id === 'string' ? body.id : '' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Erreur réseau';
    console.error(`[Email] Envoi impossible (« ${message.subject} ») : ${reason}`);
    return { status: 'failed', error: reason };
  }
}
