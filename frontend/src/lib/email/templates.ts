import type { EmailMessage } from './send';
import { bookingNextStepHint } from '@/lib/bookings/status';
import { CLICKDRIVE_WHATSAPP_NUMBER } from '@/lib/constants/contact';
import type { Locale } from '@/lib/i18n/config';
import { formatDate as formatLocaleDate, formatMoney, interpolate, plural } from '@/lib/i18n/format';
import { CUSTOMER_EMAIL_COPY, type CustomerEmailCopy } from './customer-copy';

/**
 * Gabarits des e-mails transactionnels. Les e-mails aux clients suivent la langue de leur demande
 * (ou du formulaire de contact) ; ceux destinés aux agences et à l'équipe restent en français.
 * Toute donnée saisie par un visiteur est échappée avant d'entrer dans le HTML.
 */

type Rendered = Pick<EmailMessage, 'subject' | 'html' | 'text'>;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Retire les retours à la ligne d'une valeur placée dans un objet d'e-mail */
function oneLine(value: unknown, max = 120): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

function copyFor(locale: Locale | null | undefined): CustomerEmailCopy {
  return (locale && CUSTOMER_EMAIL_COPY[locale]) || CUSTOMER_EMAIL_COPY.fr;
}

/** « : » précédé d'une espace en français, collé ailleurs */
function colon(locale: Locale | null | undefined): string {
  return !locale || locale === 'fr' ? ' : ' : ': ';
}

function formatMad(amount: unknown, locale: Locale = 'fr'): string {
  const value = Number(amount);
  return Number.isFinite(value) ? formatMoney(value, locale, 'MAD') : '—';
}

function formatDate(value: unknown, locale: Locale = 'fr'): string {
  const text = String(value ?? '');
  const match = /^\d{4}-\d{2}-\d{2}/.exec(text);
  if (!match) return text || '—';
  return formatLocaleDate(match[0], locale, 'long') || text;
}

function layout(title: string, bodyHtml: string, locale: Locale = 'fr'): string {
  const copy = copyFor(locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const footer = interpolate(copy.footer, { whatsapp: CLICKDRIVE_WHATSAPP_NUMBER });
  return `<!doctype html><html lang="${copy.htmlLang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#0b1220">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e3e6eb">
<tr><td style="padding:20px 24px;border-bottom:1px solid #eef0f3;font-size:18px;font-weight:bold" dir="ltr">ClickDrive <span style="color:#c92f3b">Nador</span></td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #eef0f3;font-size:12px;color:#5b6472">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

function rows(entries: readonly (readonly [string, unknown])[], locale: Locale = 'fr'): { html: string; text: string } {
  const visible = entries.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;font-size:14px">${visible
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#5b6472;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:bold">${escapeHtml(value)}</td></tr>`
      )
      .join('')}</table>`,
    text: visible.map(([label, value]) => `${label}${colon(locale)}${value}`).join('\n'),
  };
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#c92f3b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${escapeHtml(label)}</a></p>`;
}

/* ── Contact ──────────────────────────────────────────────────────────────── */

/** Libellés des catégories, en français (alerte à l'équipe) */
export const CONTACT_CATEGORY_LABELS: Record<string, string> = CUSTOMER_EMAIL_COPY.fr.contact.categories;

export type ContactEmailInput = {
  reference: string;
  name: string;
  email: string;
  phone?: string | null;
  category: string;
  subject?: string | null;
  message: string;
  /** Langue du formulaire, pour l'accusé de réception */
  locale?: Locale;
};

export function contactAcknowledgementEmail(input: ContactEmailInput): Rendered {
  const locale = input.locale ?? 'fr';
  const copy = copyFor(locale);
  const category = copy.contact.categories[input.category] ?? input.category;
  const details = rows(
    [
      [copy.labels.reference, input.reference],
      [copy.labels.category, category],
      [copy.labels.subject, input.subject],
    ],
    locale
  );
  const hello = interpolate(copy.hello, { name: input.name });
  return {
    subject: interpolate(copy.contact.subject, { reference: input.reference }),
    html: layout(
      copy.contact.title,
      `<p>${escapeHtml(hello)}</p><p>${escapeHtml(copy.contact.intro)}</p>${details.html}<p style="color:#5b6472;font-size:13px">${escapeHtml(copy.contact.yourMessage)}</p><blockquote style="margin:0;padding:12px 16px;background:#f5f6f8;border-radius:8px;white-space:pre-line;font-size:14px">${escapeHtml(input.message)}</blockquote>`,
      locale
    ),
    text: `${hello}\n\n${copy.contact.intro}\n\n${details.text}\n\n${copy.contact.yourMessage}\n${input.message}`,
  };
}

export function contactTeamAlertEmail(input: ContactEmailInput): Rendered {
  const category = CONTACT_CATEGORY_LABELS[input.category] ?? input.category;
  const details = rows([
    ['Référence', input.reference],
    ['Nom', input.name],
    ['E-mail', input.email],
    ['Téléphone', input.phone],
    ['Catégorie', category],
    ['Objet', input.subject],
    ['Langue', input.locale && input.locale !== 'fr' ? input.locale.toUpperCase() : null],
  ]);
  return {
    subject: `[Contact] ${oneLine(category, 60)} — ${oneLine(input.name, 60)} (${input.reference})`,
    html: layout(
      'Nouveau message de contact',
      `<p><strong>Nouveau message reçu depuis le formulaire de contact.</strong> Répondre à cet e-mail écrit directement à l’expéditeur.</p>${details.html}<blockquote style="margin:0;padding:12px 16px;background:#f5f6f8;border-radius:8px;white-space:pre-line;font-size:14px">${escapeHtml(input.message)}</blockquote>`
    ),
    text: `Nouveau message reçu depuis le formulaire de contact.\n\n${details.text}\n\n${input.message}`,
  };
}

/* ── Réservations ─────────────────────────────────────────────────────────── */

export type BookingEmailInput = {
  reference: string;
  status: string;
  customerName: string;
  vehicleLabel: string;
  agencyName: string;
  startDate: string;
  endDate: string;
  totalDays?: number | null;
  totalPrice?: number | null;
  pickupLocation?: string | null;
  /** Lien absolu vers le bon de réservation (PDF signé) */
  pdfUrl?: string | null;
  /** Motif de refus saisi par l'agence */
  reason?: string | null;
  /** Lien absolu de suivi sans compte (signé) */
  trackingUrl?: string | null;
  /** Arrivée en ferry au port (compagnie, traversée, heure) */
  ferryDetails?: string | null;
  /** Langue du client (e-mails au client seulement) */
  locale?: Locale;
};

function bookingDetails(input: BookingEmailInput, locale: Locale = 'fr') {
  const labels = copyFor(locale).labels;
  return rows(
    [
      [labels.reference, input.reference],
      [labels.vehicle, input.vehicleLabel],
      [labels.agency, input.agencyName],
      [labels.from, formatDate(input.startDate, locale)],
      [labels.to, formatDate(input.endDate, locale)],
      [labels.duration, input.totalDays ? plural(locale, input.totalDays, copyFor(locale).days) : null],
      [labels.pickup, input.pickupLocation],
      [labels.ferry, input.ferryDetails],
      [labels.total, input.totalPrice ? formatMad(input.totalPrice, locale) : null],
    ],
    locale
  );
}

export function bookingReceivedCustomerEmail(input: BookingEmailInput): Rendered {
  const locale = input.locale ?? 'fr';
  const copy = copyFor(locale);
  const c = copy.received;
  const details = bookingDetails(input, locale);
  const hello = interpolate(copy.hello, { name: input.customerName });
  const pending = interpolate(c.pending, { agency: input.agencyName });
  const pdf = input.pdfUrl ? button(input.pdfUrl, c.pdf) : '';
  const tracking = input.trackingUrl ? button(input.trackingUrl, c.track) : '';
  const trackingText = input.trackingUrl ? `\n\n${c.trackText}${colon(locale)}${input.trackingUrl}` : '';
  return {
    subject: interpolate(c.subject, { reference: input.reference, vehicle: oneLine(input.vehicleLabel, 60) }),
    html: layout(
      c.title,
      `<p>${escapeHtml(hello)}</p><p>${escapeHtml(c.intro)} <strong>${escapeHtml(c.notConfirmed)}</strong>${colon(locale)}${escapeHtml(pending)}</p>${details.html}${tracking}${pdf}<p style="color:#5b6472;font-size:13px">${escapeHtml(c.keepReference)}</p>`,
      locale
    ),
    text: `${hello}\n\n${c.intro} ${c.notConfirmed}${colon(locale)}${pending}\n\n${details.text}${trackingText}${input.pdfUrl ? `\n\n${c.pdfText}${colon(locale)}${input.pdfUrl}` : ''}`,
  };
}

export function bookingNewAgencyEmail(input: BookingEmailInput & { dashboardUrl: string }): Rendered {
  const details = bookingDetails(input);
  return {
    subject: `Nouvelle demande ${input.reference} — ${oneLine(input.vehicleLabel, 60)}`,
    html: layout(
      'Nouvelle demande de réservation',
      `<p>Une nouvelle demande de réservation attend votre réponse.</p>${details.html}${button(input.dashboardUrl, 'Répondre à la demande')}<p style="color:#5b6472;font-size:13px">Les coordonnées complètes du client sont dans votre espace agence.</p>`
    ),
    text: `Une nouvelle demande de réservation attend votre réponse.\n\n${details.text}\n\nRépondre : ${input.dashboardUrl}`,
  };
}

const STATUS_WITH_EMAIL = ['APPROVED', 'CONFIRMED', 'REJECTED', 'ALTERNATIVE_PROPOSED'] as const;
type StatusWithEmail = (typeof STATUS_WITH_EMAIL)[number];

/** E-mail au client après la réponse de l'agence ; null pour un statut qui n'appelle pas d'e-mail */
export function bookingStatusCustomerEmail(input: BookingEmailInput): Rendered | null {
  if (!(STATUS_WITH_EMAIL as readonly string[]).includes(input.status)) return null;
  const locale = input.locale ?? 'fr';
  const copy = copyFor(locale);
  const c = copy.status;
  const label = c.labels[input.status as StatusWithEmail];
  const details = bookingDetails(input, locale);
  const hello = interpolate(copy.hello, { name: input.customerName });
  const hint = bookingNextStepHint(input.status, locale);
  const reasonText = input.status === 'REJECTED' && input.reason ? interpolate(c.reason, { reason: input.reason }) : '';
  const reason = reasonText ? `<p>${escapeHtml(reasonText)}</p>` : '';
  const withPdf = Boolean(input.pdfUrl) && input.status !== 'REJECTED';
  const pdf = withPdf && input.pdfUrl ? button(input.pdfUrl, c.pdf) : '';
  const tracking = input.trackingUrl ? button(input.trackingUrl, c.track) : '';
  const title = interpolate(c.subject, { reference: input.reference, label });
  return {
    subject: title,
    html: layout(title, `<p>${escapeHtml(hello)}</p><p>${escapeHtml(hint)}</p>${reason}${details.html}${tracking}${pdf}`, locale),
    text: `${hello}\n\n${hint}${reasonText ? `\n${reasonText}` : ''}\n\n${details.text}${withPdf ? `\n\n${c.pdfText}${colon(locale)}${input.pdfUrl}` : ''}`,
  };
}

/* ── Relances et avis ─────────────────────────────────────────────────────── */

/** Relance de l'agence : une demande attend sa réponse */
export function bookingAgencyReminderEmail(
  input: BookingEmailInput & { dashboardUrl: string; waitingLabel: string }
): Rendered {
  const details = bookingDetails(input);
  return {
    subject: `Rappel : la demande ${input.reference} attend votre réponse depuis ${input.waitingLabel}`,
    html: layout(
      'Demande en attente',
      `<p>La demande ${escapeHtml(input.reference)} attend votre réponse depuis <strong>${escapeHtml(input.waitingLabel)}</strong>. Le client ne sait pas encore si le véhicule est disponible.</p>${details.html}${button(input.dashboardUrl, 'Répondre maintenant')}<p style="color:#5b6472;font-size:13px">Si le véhicule n’est plus libre, refusez la demande ou proposez une alternative : le client pourra réserver ailleurs.</p>`
    ),
    text: `La demande ${input.reference} attend votre réponse depuis ${input.waitingLabel}.\n\n${details.text}\n\nRépondre : ${input.dashboardUrl}`,
  };
}

export type AlternativeVehicle = { label: string; pricePerDay: number; url: string };

/** Le client attend toujours : véhicules libres aux mêmes dates, sans annuler sa demande */
export function bookingPendingAlternativesEmail(
  input: BookingEmailInput & { alternatives: readonly AlternativeVehicle[]; searchUrl: string }
): Rendered {
  const locale = input.locale ?? 'fr';
  const copy = copyFor(locale);
  const c = copy.alternatives;
  const hello = interpolate(copy.hello, { name: input.customerName });
  const intro = interpolate(c.intro, { agency: input.agencyName, vehicle: input.vehicleLabel });
  const price = (vehicle: AlternativeVehicle) => `${formatMad(vehicle.pricePerDay, locale)} / ${copy.perDay}`;
  const list = input.alternatives
    .map(
      (vehicle) =>
        `<li style="margin:6px 0"><a href="${escapeHtml(vehicle.url)}" style="color:#0b1220;font-weight:bold">${escapeHtml(vehicle.label)}</a> — ${escapeHtml(price(vehicle))}</li>`
    )
    .join('');
  const tracking = input.trackingUrl ? button(input.trackingUrl, c.track) : '';
  return {
    subject: interpolate(c.subject, { reference: input.reference }),
    html: layout(
      c.title,
      `<p>${escapeHtml(hello)}</p><p>${escapeHtml(intro)}</p><ul style="padding-inline-start:18px">${list}</ul><p><a href="${escapeHtml(input.searchUrl)}">${escapeHtml(c.seeAll)}</a></p>${tracking}`,
      locale
    ),
    text: `${hello}\n\n${intro}\n${input.alternatives
      .map((vehicle) => `- ${vehicle.label} (${price(vehicle)})${colon(locale)}${vehicle.url}`)
      .join('\n')}\n\n${c.allText}${colon(locale)}${input.searchUrl}${input.trackingUrl ? `\n${c.trackText}${colon(locale)}${input.trackingUrl}` : ''}`,
  };
}

/** Demande d'avis après la restitution du véhicule */
export function reviewRequestEmail(input: {
  customerName: string;
  vehicleLabel: string;
  agencyName: string;
  reference: string;
  reviewUrl: string;
  locale?: Locale;
}): Rendered {
  const locale = input.locale ?? 'fr';
  const copy = copyFor(locale);
  const c = copy.review;
  const hello = interpolate(copy.hello, { name: input.customerName });
  const values = { vehicle: input.vehicleLabel, agency: input.agencyName, url: input.reviewUrl };
  return {
    subject: interpolate(c.subject, { reference: input.reference }),
    html: layout(
      c.title,
      `<p>${escapeHtml(hello)}</p><p>${escapeHtml(interpolate(c.intro, values))}</p>${button(input.reviewUrl, c.button)}<p style="color:#5b6472;font-size:13px">${escapeHtml(c.notice)}</p>`,
      locale
    ),
    text: `${hello}\n\n${interpolate(c.text, values)}`,
  };
}

/** Libellés de repli (véhicule, agence) dans la langue du client */
export function customerFallbacks(locale: Locale | null | undefined): { vehicle: string; agency: string } {
  const copy = copyFor(locale);
  return { vehicle: copy.fallbackVehicle, agency: copy.fallbackAgency };
}
