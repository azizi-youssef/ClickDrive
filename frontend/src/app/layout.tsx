import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { getServerLocale, getTranslations } from '@/lib/i18n/server';
import { CORE_NAMESPACES, pickMessages } from '@/lib/i18n/messages';

import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { Analytics } from '@/components/analytics/Analytics';

const SITE_URL = 'https://clickdrive.ma';
const SITE_NAME = 'ClickDrive';
const SITE_TITLE = 'ClickDrive — Location de voitures à Nador';
const SITE_DESCRIPTION =
  "Comparez les voitures et motos des agences de location de Nador : aéroport Nador-Al Aroui, port de Beni Ansar et centre-ville. Demande gratuite en ligne.";

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
  themeColor: '#0B1220',
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

  manifest: '/manifest.webmanifest',

  openGraph: {
    type: 'website',
    locale: 'fr_MA',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description:
      "Comparez les voitures disponibles à Nador et réservez auprès d'agences locales.",
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
      '@type': ['Organization', 'LocalBusiness'],
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icon_12.png`,
        width: 512,
        height: 512,
      },
      image: `${SITE_URL}/opengraph-image`,
      description: SITE_DESCRIPTION,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Nador',
        addressRegion: 'Oriental',
        addressCountry: 'MA',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 35.1681,
        longitude: -2.9283,
      },
      areaServed: [
        { '@type': 'City', name: 'Nador', containedInPlace: { '@type': 'Country', name: 'Maroc' } },
        { '@type': 'Place', name: 'Aéroport Nador-Al Aroui' },
        { '@type': 'Place', name: 'Port Beni Ansar' },
        { '@type': 'Place', name: 'Marchica' },
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'contact@clickdrive.ma',
        availableLanguage: ['French', 'Arabic'],
      },
      priceRange: '$$',
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '18:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Saturday'],
          opens: '09:00',
          closes: '13:00',
        },
      ],
      sameAs: [`${SITE_URL}`],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'fr-MA',
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
  return (
    <html
      lang={locale}
      dir={dir}
      data-scroll-behavior="smooth"
      className={`h-full scroll-smooth ${plusJakartaSans.variable}${dir === 'rtl' ? ' is-rtl' : ''}`}
      suppressHydrationWarning
    >
      {/* Nettoyage des attributs d'extensions navigateur avant l'hydratation : voir src/instrumentation-client.ts */}
      <body
        className="flex min-h-full flex-col bg-canvas font-sans text-ink antialiased selection:bg-action selection:text-white"
        suppressHydrationWarning
      >
        <AppShell locale={locale} messages={pickMessages(locale, CORE_NAMESPACES)}>
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