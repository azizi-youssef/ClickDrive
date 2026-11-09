import type { Booking } from '@/types';
import { contactInbox, sendEmail, type EmailResult } from '@/lib/email/send';
import {
  bookingAgencyReminderEmail,
  bookingNewAgencyEmail,
  bookingPendingAlternativesEmail,
  bookingReceivedCustomerEmail,
  bookingStatusCustomerEmail,
  customerFallbacks,
  reviewRequestEmail,
  type AlternativeVehicle,
  type BookingEmailInput,
} from '@/lib/email/templates';
import { intlTag, resolveLocale, type Locale } from '@/lib/i18n/config';
import { localizeHref } from '@/lib/i18n/routing';
import { signedBookingPdfPath } from '@/lib/auth/booking-pdf-link';
import { signedBookingLink } from '@/lib/auth/booking-access-link';
import { sendBookingTemplate, type BookingTemplateKey, type TemplateOutcome } from './whatsapp-templates';
import { bookingsService } from '@/lib/services/bookings.service';

/**
 * Suivi d'une demande de réservation, par e-mail et WhatsApp (modèles approuvés) :
 * accusé au client et alerte à l'agence à la création, réponse de l'agence au client,
 * puis relances (agence silencieuse, alternatives au client, avis après la location).
 * Les envois de la création et des réponses partent après la réponse HTTP (after()) :
 * un fournisseur lent ou absent ne bloque jamais la réservation.
 * Le client est prévenu dans la langue de sa demande (bookings.customer_locale, français par défaut),
 * avec des liens vers les pages de cette langue ; l'agence, toujours en français.
 */

export type ChannelOutcome = { email: EmailResult['status']; whatsapp: TemplateOutcome };

/** Langue du client enregistrée avec la demande */
function customerLocale(booking: Booking): Locale {
  return resolveLocale(booking.customer_locale ?? null);
}

/** Adresse absolue d'une page publique dans la langue du client (/suivi/… → /nl/suivi/…) */
function customerUrl(appUrl: string, path: string, locale: Locale): string {
  return `${appUrl}${localizeHref(path, locale)}`;
}

/** Lien absolu de suivi sans compte, ou null sans secret de signature */
export function trackingUrl(reference: string, appUrl: string, locale: Locale = 'fr'): string | null {
  const path = reference ? signedBookingLink('track', reference) : null;
  return path ? customerUrl(appUrl, path, locale) : null;
}

function referenceOf(booking: Booking): string {
  return booking.reference || booking.booking_ref || '';
}

function vehicleLabel(booking: Booking, locale: Locale = 'fr'): string {
  const vehicle = booking.vehicle;
  return vehicle ? `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ''}` : customerFallbacks(locale).vehicle;
}

function firstName(booking: Booking): string {
  return (booking.customer_name ?? '').trim().split(/\s+/)[0] || 'Bonjour';
}

/** Date courte pour WhatsApp : « 12 déc. » (dans la langue du destinataire) */
function shortDate(value: string, locale: Locale = 'fr'): string {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(`${intlTag(locale)}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function agencyPhone(booking: Booking): string | null {
  return booking.agency?.whatsapp || booking.agency?.phone || null;
}

/**
 * Données d'un e-mail. `locale` : langue du destinataire (celle du client pour ses e-mails, le
 * français pour l'agence) ; le lien de suivi suit la langue du client.
 */
function emailInput(
  booking: Booking,
  status: string,
  appUrl: string,
  reason?: string | null,
  locale: Locale = customerLocale(booking)
): BookingEmailInput {
  const reference = referenceOf(booking);
  return {
    locale,
    reference,
    status,
    customerName: booking.customer_name,
    vehicleLabel: vehicleLabel(booking, locale),
    agencyName: booking.agency?.name ?? customerFallbacks(locale).agency,
    startDate: booking.start_date,
    endDate: booking.end_date,
    totalDays: booking.total_days,
    totalPrice: booking.total_price,
    pickupLocation: booking.pickup_location,
    pdfUrl: reference ? `${appUrl}${signedBookingPdfPath(reference)}` : null,
    trackingUrl: trackingUrl(reference, appUrl, customerLocale(booking)),
    ferryDetails: booking.ferry_details ?? null,
    reason: reason ?? null,
  };
}

function logOutcome(label: string, reference: string, result: EmailResult) {
  if (result.status === 'failed') console.error(`[BookingEmail] ${label} ${reference} : échec (${result.error})`);
  else if (result.status === 'skipped' && result.reason === 'invalid_recipient') {
    console.warn(`[BookingEmail] ${label} ${reference} : aucune adresse valide`);
  }
}

function context(booking: Booking, locale: Locale = 'fr') {
  return { bookingRef: referenceOf(booking), bookingId: booking.id, agencyId: booking.agency_id, locale };
}

export async function notifyBookingCreated(booking: Booking, appUrl: string): Promise<void> {
  const locale = customerLocale(booking);
  const input = emailInput(booking, booking.status, appUrl);
  const agencyInput = emailInput(booking, booking.status, appUrl, null, 'fr');
  const dashboardUrl = `${appUrl}/agency?booking=${encodeURIComponent(input.reference)}`;
  const [customer, agency] = await Promise.all([
    sendEmail({ to: booking.customer_email, replyTo: contactInbox(), ...bookingReceivedCustomerEmail(input) }),
    sendEmail({ to: booking.agency?.email ?? '', ...bookingNewAgencyEmail({ ...agencyInput, dashboardUrl }) }),
    sendBookingTemplate(
      'agencyNewRequest',
      agencyPhone(booking),
      [agencyInput.reference, agencyInput.vehicleLabel, shortDate(booking.start_date), shortDate(booking.end_date), booking.pickup_location || 'À l’agence', dashboardUrl],
      context(booking)
    ),
    sendBookingTemplate(
      'requestReceived',
      booking.customer_phone,
      [firstName(booking), input.reference, input.vehicleLabel, input.agencyName, input.trackingUrl ?? customerUrl(appUrl, '/account', locale)],
      context(booking, locale)
    ),
  ]);
  logOutcome('Accusé client', input.reference, customer);
  logOutcome('Alerte agence', input.reference, agency);
}

const STATUS_TEMPLATES: Record<string, BookingTemplateKey> = {
  CONFIRMED: 'requestConfirmed',
  APPROVED: 'requestConfirmed',
  REJECTED: 'requestRejected',
  ALTERNATIVE_PROPOSED: 'requestAlternative',
};

export async function notifyBookingStatus(
  booking: Booking,
  status: string,
  appUrl: string,
  reason?: string | null
): Promise<void> {
  const locale = customerLocale(booking);
  const input = emailInput(booking, status, appUrl, reason);
  const rendered = bookingStatusCustomerEmail(input);
  const templateKey = STATUS_TEMPLATES[status];
  const link = input.trackingUrl ?? customerUrl(appUrl, '/account', locale);
  const parameters =
    templateKey === 'requestConfirmed'
      ? [firstName(booking), input.agencyName, input.reference, input.vehicleLabel, shortDate(booking.start_date, locale), shortDate(booking.end_date, locale), link]
      : [firstName(booking), input.agencyName, input.reference, link];
  const [email] = await Promise.all([
    rendered
      ? sendEmail({ to: booking.customer_email, replyTo: contactInbox(), ...rendered })
      : Promise.resolve<EmailResult>({ status: 'skipped', reason: 'invalid_recipient' }),
    templateKey ? sendBookingTemplate(templateKey, booking.customer_phone, parameters, context(booking, locale)) : Promise.resolve('skipped'),
  ]);
  if (rendered) logOutcome(`Statut ${status}`, input.reference, email);
}

/**
 * Réponse de l'agence notifiée à partir de la référence : la réservation est relue avec les
 * coordonnées du client (la lecture faite pour le contrôle d'accès ne les contient pas).
 */
export async function notifyBookingStatusByReference(
  reference: string,
  status: string,
  appUrl: string,
  reason?: string | null
): Promise<void> {
  const booking = await bookingsService.getBookingByReference(reference, true);
  if (!booking) {
    console.warn(`[BookingNotify] Réservation ${reference} introuvable : client non prévenu (${status}).`);
    return;
  }
  await notifyBookingStatus(booking, status, appUrl, reason);
}

/** Durée d'attente lisible : « 45 min », « 2 h 10 » */
export function waitingLabel(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}

/** Relance de l'agence qui n'a pas encore répondu */
export async function remindAgency(booking: Booking, appUrl: string, waitingMinutes: number): Promise<ChannelOutcome> {
  const input = emailInput(booking, booking.status, appUrl, null, 'fr');
  const dashboardUrl = `${appUrl}/agency?booking=${encodeURIComponent(input.reference)}`;
  const label = waitingLabel(waitingMinutes);
  const [email, whatsapp] = await Promise.all([
    sendEmail({ to: booking.agency?.email ?? '', ...bookingAgencyReminderEmail({ ...input, dashboardUrl, waitingLabel: label }) }),
    sendBookingTemplate('agencyReminder', agencyPhone(booking), [input.reference, input.vehicleLabel, label, dashboardUrl], context(booking)),
  ]);
  logOutcome('Relance agence', input.reference, email);
  return { email: email.status, whatsapp };
}

/** Le client attend toujours : véhicules libres aux mêmes dates (sa demande reste valable) */
export async function offerPendingAlternatives(
  booking: Booking,
  appUrl: string,
  alternatives: readonly AlternativeVehicle[]
): Promise<ChannelOutcome> {
  const locale = customerLocale(booking);
  const input = emailInput(booking, booking.status, appUrl);
  const dates = `startDate=${booking.start_date.slice(0, 10)}&endDate=${booking.end_date.slice(0, 10)}`;
  const searchUrl = customerUrl(appUrl, `/search?${dates}`, locale);
  // Fiches des véhicules proposés dans la langue du client
  const localized = alternatives.map((vehicle) =>
    vehicle.url.startsWith(appUrl) ? { ...vehicle, url: customerUrl(appUrl, vehicle.url.slice(appUrl.length), locale) } : vehicle
  );
  const email = await sendEmail({
    to: booking.customer_email,
    replyTo: contactInbox(),
    ...bookingPendingAlternativesEmail({ ...input, alternatives: localized, searchUrl }),
  });
  logOutcome('Alternatives client', input.reference, email);
  return { email: email.status, whatsapp: 'skipped' };
}

/** Demande d'avis après la restitution (lien signé, sans compte) */
export async function requestReview(booking: Booking, appUrl: string): Promise<ChannelOutcome> {
  const locale = customerLocale(booking);
  const reference = referenceOf(booking);
  const path = signedBookingLink('review', reference);
  if (!path) return { email: 'skipped', whatsapp: 'skipped' };
  const reviewUrl = customerUrl(appUrl, path, locale);
  const [email, whatsapp] = await Promise.all([
    sendEmail({
      to: booking.customer_email,
      replyTo: contactInbox(),
      ...reviewRequestEmail({
        customerName: booking.customer_name,
        vehicleLabel: vehicleLabel(booking, locale),
        agencyName: booking.agency?.name ?? customerFallbacks(locale).agency,
        reference,
        reviewUrl,
        locale,
      }),
    }),
    sendBookingTemplate('reviewRequest', booking.customer_phone, [firstName(booking), vehicleLabel(booking, locale), reviewUrl], context(booking, locale)),
  ]);
  logOutcome('Demande d’avis', reference, email);
  return { email: email.status, whatsapp };
}
