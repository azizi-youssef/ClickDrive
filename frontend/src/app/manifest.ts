import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/**
 * Manifeste de l'application (servi à /manifest.webmanifest). Nom, description et couleurs viennent
 * de config/site.ts : plus de valeur recopiée à la main dans un fichier statique.
 * Icônes inchangées (public/icon_12.png).
 */
const ICON_SIZES = ['72x72', '96x96', '128x128', '144x144', '152x152', '192x192', '384x384', '512x512'] as const;
const MASKABLE_SIZES = new Set<string>(['192x192', '512x512']);

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.title,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: siteConfig.colors.primary,
    theme_color: siteConfig.colors.primary,
    lang: siteConfig.locale,
    dir: 'ltr',
    categories: ['travel', 'shopping', 'lifestyle'],
    screenshots: [{ src: '/UI.png', sizes: '900x600', type: 'image/png', label: `Accueil ${siteConfig.name}` }],
    shortcuts: [
      {
        name: 'Rechercher une voiture',
        short_name: 'Recherche',
        description: 'Recherchez une voiture disponible à Nador',
        url: '/search',
        icons: [{ src: siteConfig.assets.icon, sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Mes demandes',
        short_name: 'Demandes',
        description: "Consulter l'historique de vos demandes de location",
        url: '/account?tab=bookings',
        icons: [{ src: siteConfig.assets.icon, sizes: '96x96', type: 'image/png' }],
      },
    ],
    // Même liste que l'ancien manifeste ; « any maskable » devient deux entrées (format attendu par Next)
    icons: ICON_SIZES.flatMap((sizes) => [
      { src: siteConfig.assets.icon, sizes, type: 'image/png', purpose: 'any' as const },
      ...(MASKABLE_SIZES.has(sizes)
        ? [{ src: siteConfig.assets.icon, sizes, type: 'image/png', purpose: 'maskable' as const }]
        : []),
    ]),
    related_applications: [],
    prefer_related_applications: false,
  };
}
