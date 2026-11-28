import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { getServerLocale, getTranslations } from '@/lib/i18n/server';
import { CORE_NAMESPACES, pickMessages } from '@/lib/i18n/messages';

import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { siteConfig } from '@/config/site';
import { openingHoursJsonLd } from '@/lib/constants/contact';
import { PICKUP_LOCATIONS } from '@/data/locations';
import { getFooterCategories } from '@/lib/catalog/footer-categories';
import { Analytics } from '@/components/analytics/Analytics';

// Nom, slogan, domaine et coordonnées : source unique src/config/site.ts
const SITE_URL = siteConfig.url;
const SITE_NAME = siteConfig.name;
const SITE_TITLE = siteConfig.title;
const SITE_DESCRIPTION = siteConfig.description;

// Police hébergée dans le projet (variable 200–800, sous-ensemble latin, licence OFL — voir fonts/).
// next/font/google la téléchargeait au build et faisait échouer Turbopack en CI.
const plusJakartaSans = localFont({
  src: './fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-sans',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

/* -------------------------------------------------------------------------- */
/* VIEWPORT                                                                   */
/* -------------------------------------------------------------------------- */

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: siteConfig.colors.primary,
  colorScheme: 'light',
};

/* -------------------------------------------------------------------------- */
/* METADATA                                                                   */
/* -------------------------------------------------------------------------- */

const BASE_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME} Nador`,
  },

  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'travel',

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  // Manifeste : app/manifest.ts (lien ajouté automatiquement par Next.js)

  openGraph: {
    type: 'website',
    locale: 'fr_MA',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description:
      "Comparez les voitures disponibles à Nador et envoyez votre demande aux agences locales.",
  },

  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description:
      "Trouvez et comparez votre voiture de location à Nador auprès d'agences locales.",
  },

  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

/** Titre, description et Open Graph dans la langue de la requête */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return {
    ...BASE_METADATA,
    title: { default: t.meta.siteTitle, template: `%s | ${SITE_NAME} Nador` },
    description: t.meta.siteDescription,
    openGraph: {
      ...BASE_METADATA.openGraph,
      locale: t.meta.ogLocale,
      title: t.meta.siteTitle,
      description: t.meta.shareDescription,
    },
    twitter: { ...BASE_METADATA.twitter, title: t.meta.siteTitle, description: t.meta.shareDescription },
  };
}

/* -------------------------------------------------------------------------- */
/* DONNÉES STRUCTURÉES (SEO)                                                  */
/* -------------------------------------------------------------------------- */

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      // AutoRental (sous-type de LocalBusiness) : plateforme de location de véhicules à Nador
      '@type': ['Organization', 'AutoRental'],
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      slogan: siteConfig.tagline,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}${siteConfig.assets.icon}`,
        width: siteConfig.assets.iconSize.width,
        height: siteConfig.assets.iconSize.height,
      },
      image: `${SITE_URL}/opengraph-image`,
      description: SITE_DESCRIPTION,
      address: {
        '@type': 'PostalAddress',
        addressLocality: siteConfig.area.city,
        addressRegion: siteConfig.area.region,
        addressCountry: siteConfig.area.country,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: siteConfig.area.geo.latitude,
        longitude: siteConfig.area.geo.longitude,
      },
      // Zone desservie : Nador et ses lieux de prise en charge (src/data/locations.ts)
      areaServed: [
        {
          '@type': 'City',
          name: siteConfig.area.city,
          containedInPlace: { '@type': 'Country', name: siteConfig.area.countryName },
        },
        ...PICKUP_LOCATIONS.map((location) => ({
          '@type': location.kind === 'AIRPORT' ? 'Airport' : 'Place',
          name: location.label,
          ...(location.kind === 'AIRPORT' && location.code ? { iataCode: location.code } : {}),
        })),
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: siteConfig.contact.email,
        telephone: `+${siteConfig.contact.whatsapp}`,
        availableLanguage: ['French', 'Arabic', 'English', 'Spanish', 'German', 'Dutch'],
        hoursAvailable: openingHoursJsonLd(),
      },
      priceRange: '$$',
      currenciesAccepted: 'MAD',
      openingHoursSpecification: openingHoursJsonLd(),
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: siteConfig.locale,
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* ROOT LAYOUT                                                                */
/* -------------------------------------------------------------------------- */

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Langue et sens d'écriture connus côté serveur : pas de bascule LTR → RTL après hydratation
  const { locale, dir } = await getServerLocale();
  // Catégories du pied de page : seulement celles qui ont des véhicules (catalogue public en cache)
  const footerCategories = await getFooterCategories();
  return (
    <html
      lang={locale}
      dir={dir}
      data-scroll-behavior="smooth"
      className={`h-full scroll-smooth ${plusJakartaSans.variable}`}
      suppressHydrationWarning
    >
      {/* Nettoyage des attributs d'extensions navigateur avant l'hydratation : voir src/instrumentation-client.ts */}
      <body
        className="flex min-h-full flex-col bg-canvas font-sans text-ink antialiased selection:bg-action selection:text-white"
        suppressHydrationWarning
      >
        <AppShell locale={locale} messages={pickMessages(locale, CORE_NAMESPACES)} footerCategories={footerCategories}>
          {children}
        </AppShell>
        <Analytics />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}