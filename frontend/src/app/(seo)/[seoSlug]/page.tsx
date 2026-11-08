import React from 'react';
import Link from 'next/link';
import { notFound, unstable_rethrow } from 'next/navigation';
import { Metadata } from 'next';
import { SEO_LANDING_PAGES, ALL_SEO_SLUGS } from '@/lib/seo/landingPages';
import { vehiclesService } from '@/lib/services/vehicles.service';
import { agenciesService } from '@/lib/services/agencies.service';
import { VehicleCard } from '@/components/cars/VehicleCard';
import { AgencyCard } from '@/components/agencies/AgencyCard';
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ seoSlug: string }>;
}

export async function generateStaticParams() {
  return ALL_SEO_SLUGS.map((seoSlug) => ({
    seoSlug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const page = SEO_LANDING_PAGES[resolved.seoSlug];
  if (!page) return {};

  return {
    title: page.title,
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: {
      canonical: `https://clickdrive.ma/${page.slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url: `https://clickdrive.ma/${page.slug}`,
      siteName: 'ClickDrive Nador',
      locale: 'fr_FR',
      type: 'website',
    },
  };
}

export default async function SeoLandingPage({ params }: PageProps) {
  const resolved = await params;
  const pageData = SEO_LANDING_PAGES[resolved.seoSlug];

  if (!pageData) {
    notFound();
  }

  // Le contenu éditorial reste servi même si le catalogue est momentanément
  // inaccessible (build CI sans Supabase, panne).
  const [allVehicles, agencies] = await Promise.all([
    vehiclesService.getVehicles(),
    agenciesService.getAgencies(true),
  ]).catch((error: unknown) => {
    unstable_rethrow(error); // laisse Next passer la page en rendu dynamique (cookies)
    console.error('[SeoLandingPage] Catalogue indisponible:', error instanceof Error ? error.message : error);
    return [[], []] as [Awaited<ReturnType<typeof vehiclesService.getVehicles>>, Awaited<ReturnType<typeof agenciesService.getAgencies>>];
  });
  let vehicles = allVehicles;

  if (pageData.filterCategory) {
    vehicles = vehicles.filter(
      (v) => v.category.toLowerCase() === pageData.filterCategory!.toLowerCase()
    );
  }

  if (pageData.filterTransmission) {
    vehicles = vehicles.filter((v) => v.transmission === pageData.filterTransmission);
  }

  // Generate JSON-LD Schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': `https://clickdrive.ma/${pageData.slug}#business`,
        name: 'ClickDrive Marketplace Nador',
        description: pageData.metaDescription,
        url: `https://clickdrive.ma/${pageData.slug}`,
        telephone: '+212 536 60 00 00',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Boulevard Mohammed V',
          addressLocality: 'Nador',
          postalCode: '62000',
          addressCountry: 'MA',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 35.1688,
          longitude: -2.9335,
        },
        priceRange: '250 DH - 1200 DH',
      },
      {
        '@type': 'FAQPage',
        '@id': `https://clickdrive.ma/${pageData.slug}#faq`,
        mainEntity: pageData.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      {/* Inject Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-[#F8FAFC] min-h-screen">
        {/* Breadcrumb Navigation */}
        <div className="bg-white border-b border-slate-200 py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Link href="/" className="hover:text-slate-900">Accueil</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <Link href="/search" className="hover:text-slate-900">Location de voitures</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-semibold">{pageData.zoneName}</span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="bg-gradient-to-b from-[#0B1220] via-slate-900 to-[#0B1220] text-white py-12 lg:py-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Comparateur n°1 à Nador • Zéro frais cachés</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                {pageData.h1}
              </h1>

              <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
                {pageData.introText}
              </p>

              {/* Badges USP */}
              <div className="mt-6 flex flex-wrap gap-4 text-xs sm:text-sm text-slate-200">
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Livraison sur place garantie</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Agences 100% vérifiées</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Confirmation rapide WhatsApp</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Vehicles Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-bold text-accent-text tracking-wider uppercase">
                Flotte disponible
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                Véhicules disponibles pour à {pageData.zoneName}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {vehicles.length} véhicules prêts à la réservation immédiatesss
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent-text hover:underline self-start sm:self-auto"
            >
              Voir tous les véhicules à Nador
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((car, idx) => (
              <VehicleCard key={car.id} vehicle={car} priority={idx === 0} />
            ))}
          </div>
        </section>

        {/* Partner Agencies in Zone */}
        <section className="bg-white py-12 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-2xl font-bold text-slate-900">
                Nos agences partenaires opérant sur cette zone
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Chaque agence est rigoureusement sélectionnée selon notre charte qualité ClickDrive.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {agencies.slice(0, 3).map((agency) => (
                <AgencyCard key={agency.id} agency={agency} />
              ))}
            </div>
          </div>
        </section>

        {/* SEO FAQ Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 text-accent-text mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Questions fréquentes — {pageData.zoneName}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Tout ce que vous devez savoir pour votre location
            </p>
          </div>

          <div className="space-y-4">
            {pageData.faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-blue-200 transition"
              >
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {faq.question}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Other Local Destinations Cross-links */}
        <section className="bg-slate-100 py-10 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Autres destinations et catégories de location à Nador :
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {ALL_SEO_SLUGS.filter((s) => s !== pageData.slug).map((slug) => {
                const item = SEO_LANDING_PAGES[slug];
                return (
                  <Link
                    key={slug}
                    href={`/${slug}`}
                    className="bg-white hover:bg-blue-50 text-slate-700 hover:text-accent-text px-3 py-2 rounded-lg border border-slate-200 font-medium transition"
                  >
                    {item.zoneName}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
