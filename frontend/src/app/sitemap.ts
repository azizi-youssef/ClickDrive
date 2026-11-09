import { MetadataRoute } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { agenciesService } from '@/lib/services/agencies.service';
import { ALL_SEO_SLUGS } from '@/lib/seo/landingPages';
import { ALL_LOCALES } from '@/lib/i18n/config';
import { alternateHrefs } from '@/lib/i18n/routing';

const BASE_URL = 'https://clickdrive.ma';

type Entry = MetadataRoute.Sitemap[number];
type EntryOptions = Omit<Entry, 'url' | 'alternates'>;

function absolute(path: string): string {
  return path === '/' ? BASE_URL : `${BASE_URL}${path}`;
}

/**
 * Une page traduite : une entrée par langue (français à la racine, /ar, /en, /de, /es, /nl, slugs
 * traduits pour les pages SEO), chacune avec toutes ses versions (hreflang) et x-default = français.
 */
function localized(frPath: string, options: EntryOptions): Entry[] {
  const hrefs = alternateHrefs(frPath);
  const languages = {
    ...Object.fromEntries(ALL_LOCALES.map((locale) => [locale, absolute(hrefs[locale])])),
    'x-default': absolute(hrefs.fr),
  };
  return ALL_LOCALES.map((locale) => ({ ...options, url: absolute(hrefs[locale]), alternates: { languages } }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Les pages fixes restent listées même si le catalogue est inaccessible (build CI sans Supabase).
  const [vehicles, agencies] = await Promise.all([
    vehiclesService.getVehicles(),
    agenciesService.getAgencies(true),
  ]).catch((error: unknown) => {
    unstable_rethrow(error); // laisse Next passer le sitemap en rendu dynamique (cookies)
    console.error('[Sitemap] Catalogue indisponible:', error instanceof Error ? error.message : error);
    return [[], []] as [Awaited<ReturnType<typeof vehiclesService.getVehicles>>, Awaited<ReturnType<typeof agenciesService.getAgencies>>];
  });

  const now = new Date();

  return [
    // ── Pages principales ────────────────────────────────────────────────
    ...localized('/', { lastModified: now, changeFrequency: 'daily', priority: 1 }),
    ...localized('/search', { lastModified: now, changeFrequency: 'daily', priority: 0.9 }),
    ...localized('/motos', { lastModified: now, changeFrequency: 'daily', priority: 0.8 }),
    ...localized('/agencies', { lastModified: now, changeFrequency: 'weekly', priority: 0.8 }),
    ...localized('/about', { lastModified: now, changeFrequency: 'monthly', priority: 0.6 }),
    // ── Aide et informations ─────────────────────────────────────────────
    ...localized('/faq', { lastModified: now, changeFrequency: 'monthly', priority: 0.6 }),
    ...localized('/contact', { lastModified: now, changeFrequency: 'monthly', priority: 0.5 }),
    // ── Textes juridiques : en français seulement (les adresses traduites ne sont pas indexées) ──
    ...['/cgv', '/confidentialite', '/mentions-legales'].map((path) => ({
      url: absolute(path),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
    // ── Pages d'atterrissage SEO (slugs traduits) ────────────────────────
    ...ALL_SEO_SLUGS.flatMap((slug) => localized(`/${slug}`, { lastModified: now, changeFrequency: 'daily', priority: 0.85 })),
    // ── Contenu du catalogue ─────────────────────────────────────────────
    ...vehicles.flatMap((vehicle) =>
      localized(`/cars/${vehicle.slug}`, { lastModified: new Date(vehicle.created_at), changeFrequency: 'daily', priority: 0.8 })
    ),
    ...agencies.flatMap((agency) =>
      localized(`/agencies/${agency.slug}`, { lastModified: now, changeFrequency: 'weekly', priority: 0.7 })
    ),
  ];
}
