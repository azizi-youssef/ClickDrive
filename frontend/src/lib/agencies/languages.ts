/** Langues que les agences peuvent indiquer (codes stockés dans agencies.languages) */
export const AGENCY_LANGUAGES = [
  { code: 'ar', label: 'Arabe' },
  { code: 'rif', label: 'Tarifit (rifain)' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Espagnol' },
  { code: 'en', label: 'Anglais' },
  { code: 'nl', label: 'Néerlandais' },
  { code: 'de', label: 'Allemand' },
] as const;

export type AgencyLanguageCode = (typeof AGENCY_LANGUAGES)[number]['code'];

export const AGENCY_LANGUAGE_CODES = AGENCY_LANGUAGES.map((language) => language.code) as AgencyLanguageCode[];

export function agencyLanguageLabels(codes: readonly string[] | null | undefined): string[] {
  return (codes ?? [])
    .map((code) => AGENCY_LANGUAGES.find((language) => language.code === code)?.label)
    .filter((label): label is (typeof AGENCY_LANGUAGES)[number]['label'] => Boolean(label));
}
