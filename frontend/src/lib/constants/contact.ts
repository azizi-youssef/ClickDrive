import { siteConfig, type IsoWeekday, type OpeningSlot } from '@/config/site';
import { intlTag, type Locale } from '@/lib/i18n/config';

/**
 * Coordonnées et horaires du support ClickDrive. Les valeurs viennent de `siteConfig.contact`
 * (src/config/site.ts) : ce module ne fait que les mettre en forme.
 */

/** Numéro WhatsApp de la plateforme (format international, sans « + » ni espaces) */
export const PLATFORM_WHATSAPP_NUMBER: string = siteConfig.contact.whatsapp;

/** Adresse e-mail publique de contact */
export const CONTACT_EMAIL: string = siteConfig.contact.email;

/** Adresse dédiée aux données personnelles (CNDP / RGPD) */
export const PRIVACY_EMAIL: string = siteConfig.contact.privacyEmail;

/**
 * Numéro au format international sans « + », exigé par wa.me : « 0612345678 » → « 212612345678 »,
 * « 00212 6… » → « 2126… ». Les numéros déjà internationaux sont conservés.
 */
export function toInternationalDigits(number: string): string {
  let digits = number.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Numéro marocain national (10 chiffres commençant par 0) : indicatif 212 à la place du 0
  if (digits.length === 10 && digits.startsWith('0')) digits = `212${digits.slice(1)}`;
  return digits;
}

/** Lien WhatsApp « https://wa.me/212…?text=… » ; le message pré-rempli est facultatif */
export function whatsappUrl(message?: string, number: string = PLATFORM_WHATSAPP_NUMBER): string {
  const digits = toInternationalDigits(number);
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Lien WhatsApp vers le support de la plateforme */
export function platformWhatsAppUrl(message?: string): string {
  return whatsappUrl(message);
}

/** Numéro lisible « +212 7 67 13 71 36 » */
export function formatPhoneDisplay(number: string = PLATFORM_WHATSAPP_NUMBER): string {
  const digits = number.replace(/\D/g, '');
  if (digits.startsWith('212') && digits.length === 12) {
    const local = digits.slice(3);
    return `+212 ${local.charAt(0)} ${local.slice(1).replace(/(\d{2})(?=\d)/g, '$1 ')}`;
  }
  return `+${digits}`;
}

/* ── Horaires ─────────────────────────────────────────────────────────── */

// 5 janvier 2026 = lundi : date de référence pour nommer les jours dans chaque langue
const MONDAY_REFERENCE_UTC = Date.UTC(2026, 0, 5);

function weekdayName(day: IsoWeekday, locale: Locale, style: 'short' | 'long'): string {
  const date = new Date(MONDAY_REFERENCE_UTC + (day - 1) * 86_400_000);
  return new Intl.DateTimeFormat(`${intlTag(locale)}-u-nu-latn`, { weekday: style, timeZone: 'UTC' }).format(date);
}

/**
 * Heure affichée selon l'usage de chaque langue, sans Intl : rendu identique sur le serveur et dans
 * le navigateur. « 9h » / « 9h30 » (fr), « 9am » / « 6pm » (en), « 9:00 » (es, nl, ar), « 9 » (de, suivi de « Uhr »).
 */
function formatTime(value: string, locale: Locale): string {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  const mm = String(minutes).padStart(2, '0');
  switch (locale) {
    case 'fr':
      return minutes ? `${hours}h${mm}` : `${hours}h`;
    case 'en': {
      const suffix = hours < 12 ? 'am' : 'pm';
      const h12 = hours % 12 === 0 ? 12 : hours % 12;
      return minutes ? `${h12}:${mm}${suffix}` : `${h12}${suffix}`;
    }
    case 'de':
      return minutes ? `${hours}:${mm}` : `${hours}`;
    default:
      return `${hours}:${mm}`;
  }
}

/** « 9h–18h » (fr), « 9am–6pm » (en), « 9–18 Uhr » (de), « 9:00–18:00 » (es, nl, ar) */
function formatTimeRange(slot: OpeningSlot, locale: Locale): string {
  const range = `${formatTime(slot.opens, locale)}–${formatTime(slot.closes, locale)}`;
  return locale === 'de' ? `${range} Uhr` : range;
}

function formatDays(days: readonly IsoWeekday[], locale: Locale, style: 'short' | 'long'): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) return '';
  const firstName = weekdayName(first, locale, style);
  if (first === last) return firstName;
  const separator = style === 'long' ? ' – ' : '–';
  return `${firstName}${separator}${weekdayName(last, locale, style)}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

export interface SupportHoursRow {
  day: string;
  hours: string;
}

/** Lignes du tableau des horaires (page Contact), dans la langue de la page */
export function supportHoursRows(locale: Locale): SupportHoursRow[] {
  return siteConfig.contact.hours.map((slot) => ({
    day: capitalize(formatDays(slot.days, locale, 'long')),
    hours: formatTimeRange(slot, locale),
  }));
}

/** Un créneau par entrée, en forme courte : [« lun.–ven. 9h–18h », « sam. 9h–13h »] */
export function supportHoursLines(locale: Locale): string[] {
  return siteConfig.contact.hours.map((slot) => `${formatDays(slot.days, locale, 'short')} ${formatTimeRange(slot, locale)}`);
}

/** Résumé sur une ligne : « lun.–ven. 9h–18h · sam. 9h–13h » */
export function supportHoursSummary(locale: Locale): string {
  return supportHoursLines(locale).join(' · ');
}

/** Spécification schema.org OpeningHoursSpecification (données structurées) */
const SCHEMA_DAYS: Record<IsoWeekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export function openingHoursJsonLd() {
  return siteConfig.contact.hours.map((slot) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: slot.days.map((day) => SCHEMA_DAYS[day]),
    opens: slot.opens,
    closes: slot.closes,
  }));
}
