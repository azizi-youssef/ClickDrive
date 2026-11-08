/**
 * Données structurées schema.org (JSON-LD) : uniquement des faits présents en base.
 * Jamais d'avis, de note ou de disponibilité inventés.
 */

export const SITE_URL = 'https://clickdrive.ma';

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path === '/' ? '' : item.path}`,
    })),
  };
}

// Séquences d'échappement construites sans barre oblique inverse littérale dans la source
const ESCAPE_PREFIX = String.fromCharCode(92) + 'u';
const UNSAFE_CHARACTERS = new RegExp(`[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');

/**
 * Sérialisation sûre pour une balise <script type="application/ld+json"> :
 * <, >, & et les séparateurs de ligne Unicode sont échappés, pour qu'aucune valeur
 * (description d'agence, etc.) ne puisse fermer la balise ou injecter du HTML.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(
    UNSAFE_CHARACTERS,
    (char) => `${ESCAPE_PREFIX}${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}
