import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { contactInbox, sendEmail, type EmailResult } from '@/lib/email/send';
import { contactAcknowledgementEmail, contactTeamAlertEmail } from '@/lib/email/templates';
import type { ContactMessageInput } from '@/lib/validations/contact';

export class ContactUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactUnavailableError';
  }
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Référence lisible : MSG-AAAAMMJJ-XXXXXX (sans caractères ambigus) */
export function contactReference(now = new Date(), bytes: Uint8Array = randomBytes(6)): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Array.from(bytes, (byte) => REFERENCE_ALPHABET.charAt(byte % REFERENCE_ALPHABET.length)).join('');
  return `MSG-${day}-${suffix}`;
}

export type ContactSubmission = {
  reference: string;
  teamNotified: EmailResult['status'];
  acknowledged: EmailResult['status'];
};

/**
 * Enregistre le message puis prévient l'équipe et accuse réception à l'expéditeur.
 * Le message est conservé même si les e-mails échouent : il reste consultable dans l'administration.
 */
export async function submitContactMessage(input: ContactMessageInput): Promise<ContactSubmission> {
  const supabase = await createAdminClient();
  if (!supabase) throw new ContactUnavailableError('Base de données indisponible pour enregistrer le message.');

  let reference = contactReference();
  let inserted: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    const { data, error } = await supabase
      .from('contact_messages')
      .insert({
        reference,
        name: input.name,
        email: input.email,
        phone: input.phone,
        category: input.category,
        subject: input.subject,
        message: input.message,
      })
      .select('id')
      .single();
    if (!error && data) {
      inserted = data as { id: string };
    } else if (error?.code === '23505') {
      reference = contactReference(); // collision de référence (rarissime) : on en tire une autre
    } else {
      throw new ContactUnavailableError(error?.message ?? 'Enregistrement du message impossible.');
    }
  }
  if (!inserted) throw new ContactUnavailableError('Enregistrement du message impossible.');

  const content = { reference, ...input };
  const [team, acknowledgement] = await Promise.all([
    sendEmail({ to: contactInbox(), replyTo: input.email, ...contactTeamAlertEmail(content) }),
    sendEmail({ to: input.email, replyTo: contactInbox(), ...contactAcknowledgementEmail(content) }),
  ]);

  const now = new Date().toISOString();
  const delivered = {
    ...(team.status === 'sent' ? { team_notified_at: now } : {}),
    ...(acknowledgement.status === 'sent' ? { acknowledged_at: now } : {}),
  };
  if (Object.keys(delivered).length > 0) {
    const { error } = await supabase.from('contact_messages').update(delivered).eq('id', inserted.id);
    if (error) console.warn('[Contact] Suivi des envois non enregistré :', error.message);
  }

  return { reference, teamNotified: team.status, acknowledged: acknowledgement.status };
}
