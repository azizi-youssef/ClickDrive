import { intlTag, type Locale } from './config';

/** « {count} véhicules » + { count: 3 } → « 3 véhicules ». Une variable absente reste visible. */
export function interpolate(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  );
}

/**
 * Formes du pluriel par langue (règles Intl) : « other » est obligatoire, les autres formes
 * (zero, one, two, few, many) servent quand la langue les distingue, l'arabe surtout.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function plural(locale: Locale, count: number, forms: PluralForms, values: Record<string, string | number> = {}): string {
  const rule = new Intl.PluralRules(intlTag(locale)).select(count);
  const template = forms[rule] ?? forms.other;
  return interpolate(template, { count: formatNumber(count, locale), ...values });
}

/** Chiffres latins partout, arabe compris : les prix et dates restent lisibles d'une langue à l'autre */
function numberingTag(locale: Locale): string {
  return `${intlTag(locale)}-u-nu-latn`;
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(numberingTag(locale), { maximumFractionDigits: 0 }).format(value);
}

/** Montant en dirhams : « 1 200 DH », « 1,200 DH » (en), « 1.200 DH » (de, nl, es) */
export function formatMoney(value: number, locale: Locale, currency = 'DH'): string {
  return `${formatNumber(value, locale)} ${currency}`;
}

/**
 * Une date sans heure (AAAA-MM-JJ) est lue et affichée en UTC : le même jour partout, quel que soit
 * le fuseau du visiteur ou du serveur. Un horodatage est affiché à l'heure du Maroc.
 */
function toDate(value: Date | string): { date: Date; timeZone: string } | null {
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = typeof value === 'string' ? new Date(dateOnly ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return { date, timeZone: dateOnly ? 'UTC' : 'Africa/Casablanca' };
}

const DATE_STYLES = {
  /** 12/07/2026 */
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  /** 12 juil. 2026 */
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  /** samedi 12 juillet 2026 */
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  /** 12 juil. */
  dayMonth: { day: 'numeric', month: 'short' },
  /** 12 juil. 2026, 14:30 */
  dateTime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof DATE_STYLES;

export function formatDate(value: Date | string, locale: Locale, style: DateStyle = 'medium'): string {
  const parsed = toDate(value);
  if (!parsed) return '';
  return new Intl.DateTimeFormat(numberingTag(locale), { ...DATE_STYLES[style], timeZone: parsed.timeZone }).format(parsed.date);
}

/** Nombre à décimales fixes : « 4,8 » (fr), « 4.8 » (en) */
export function formatDecimal(value: number, locale: Locale, digits = 1): string {
  return new Intl.NumberFormat(numberingTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
