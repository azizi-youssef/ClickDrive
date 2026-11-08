import { MetadataRoute } from 'next';

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
        ],
      },
      {
        // Block AI training scrapers
        userAgent: ['GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 'Google-Extended'],
        disallow: ['/'],
      },
    ],
    sitemap: 'https://clickdrive.ma/sitemap.xml',
    host: 'https://clickdrive.ma',
  };
}
