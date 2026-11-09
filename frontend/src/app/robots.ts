import { MetadataRoute } from 'next';
import { PREFIXED_LOCALES } from '@/lib/i18n/config';

/** Espaces privés et liens signés, aussi sous les préfixes de langue (/nl/account, /ar/suivi/…) */
const LOCALIZED_PRIVATE = PREFIXED_LOCALES.flatMap((locale) => [
  `/${locale}/account`,
  `/${locale}/login`,
  `/${locale}/suivi/`,
  `/${locale}/avis/`,
]);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Main crawlers: allow all public pages, block private routes
        userAgent: '*',
        allow: [
          '/',
          '/search',
          '/motos',
          '/cars/',
          '/agencies/',
          '/about',
          '/faq',
          '/contact',
          '/cgv',
          '/confidentialite',
          '/mentions-legales',
        ],
        disallow: [
          '/admin',
          '/admin/',
          '/agency',
          '/agency/',
          '/account',
          '/account/',
          '/api/',
          '/_next/',
          '/login',
          // Liens personnels signés (suivi d'une demande, avis) : jamais indexés
          '/suivi/',
          '/avis/',
          ...LOCALIZED_PRIVATE,
        ],
      },
      {
        // Robots d'entraînement de modèles d'IA : bloqués. Les robots de recherche et de consultation
        // des assistants (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot…) suivent la règle
        // générale ci-dessus : ClickDrive peut être cité quand un voyageur cherche où louer à Nador.
        userAgent: ['GPTBot', 'CCBot', 'anthropic-ai', 'ClaudeBot', 'Google-Extended', 'Bytespider'],
        disallow: ['/'],
      },
    ],
    sitemap: 'https://clickdrive.ma/sitemap.xml',
    host: 'https://clickdrive.ma',
  };
}
