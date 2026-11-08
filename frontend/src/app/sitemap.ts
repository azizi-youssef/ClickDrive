import { MetadataRoute } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { agenciesService } from '@/lib/services/agencies.service';
import { ALL_SEO_SLUGS } from '@/lib/seo/landingPages';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://clickdrive.ma';

  // Les pages fixes restent listées même si le catalogue est inaccessible (build CI sans Supabase).
  const [vehicles, agencies] = await Promise.all([
    vehiclesService.getVehicles(),
    agenciesService.getAgencies(true),
  ]).catch((error: unknown) => {
    unstable_rethrow(error); // laisse Next passer le sitemap en rendu dynamique (cookies)
    console.error('[Sitemap] Catalogue indisponible:', error instanceof Error ? error.message : error);
    return [[], []] as [Awaited<ReturnType<typeof vehiclesService.getVehicles>>, Awaited<ReturnType<typeof agenciesService.getAgencies>>];
  });

  const vehicleUrls = vehicles.map((v) => ({
    url: `${baseUrl}/cars/${v.slug}`,
    lastModified: new Date(v.created_at),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const agencyUrls = agencies.map((a) => ({
    url: `${baseUrl}/agencies/${a.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const seoLandingUrls = ALL_SEO_SLUGS.map((slug) => ({
    url: `${baseUrl}/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  return [
    // ── Core pages ──────────────────────────────────────────────────────
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/motos`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/agencies`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // ── Support & informational pages ────────────────────────────────────
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    // ── Legal pages ──────────────────────────────────────────────────────
    {
      url: `${baseUrl}/cgv`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/confidentialite`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    // ── SEO landing pages ────────────────────────────────────────────────
    ...seoLandingUrls,
    // ── Dynamic content ──────────────────────────────────────────────────
    ...vehicleUrls,
    ...agencyUrls,
  ];
}


