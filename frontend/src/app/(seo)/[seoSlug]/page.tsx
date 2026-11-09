import React from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { ALL_SEO_SLUGS, getLandingPage } from '@/lib/seo/landingPages';
import { getPublicCatalog } from '@/lib/services/public-catalog.service';
import { vehicleTypeOf } from '@/lib/vehicles/kind';
import { breadcrumbJsonLd, jsonLdScript } from '@/lib/seo/structured-data';
import { VehicleCard } from '@/components/cars/VehicleCard';
import { AgencyCard } from '@/components/agencies/AgencyCard';
import { I18nScope } from '@/components/i18n/I18nScope';
import { getTranslations, localizedAlternates } from '@/lib/i18n/server';
import { localizeHref } from '@/lib/i18n/routing';
import { formatMoney, interpolate, plural } from '@/lib/i18n/format';
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  Clock,
} from 'lucide-react';

/**
 * Une adresse par langue : le proxy réécrit /nl/auto-huren-nador vers /location-voiture-nador et
 * transmet la langue ; le paramètre reçu ici est donc toujours le slug français.
 */
interface PageProps {
  params: Promise<{ seoSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seoSlug } = await params;
  const { locale, t } = await getTranslations();
  const page = getLandingPage(seoSlug, locale);
  if (!page) return {};

  return {
    // Titre complet (60 caractères au plus) : pas de suffixe de modèle, pas de « ClickDrive » répété
    title: { absolute: page.title },
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: await localizedAlternates(`/${page.slug}`),
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url: `https://clickdrive.ma${localizeHref(`/${page.slug}`, locale)}`,
      siteName: 'ClickDrive Nador',
      locale: t.meta.ogLocale,
      type: 'website',
    },
  };
}

export default async function SeoLandingPage({ params }: PageProps) {
  const { seoSlug } = await params;
  const { locale, t } = await getTranslations();
  const copy = t.seo;
  const pageData = getLandingPage(seoSlug, locale);

  if (!pageData) {
    notFound();
  }
  const pageHref = localizeHref(`/${pageData.slug}`, locale);

  // Le contenu éditorial reste servi même si le catalogue est momentanément
  // inaccessible (build CI sans Supabase, panne).
  // Catalogue public mis en cache 60 s (projection publique : ni plaque, ni documents, ni e-mail d'agence)
  const catalog = await getPublicCatalog();
  const allVehicles = catalog?.vehicles ?? [];
  const agencies = catalog?.agencies ?? [];
  let vehicles = allVehicles.filter((v) => vehicleTypeOf(v) === (pageData.vehicleType ?? 'CAR'));

  if (pageData.filterCategory) {
    vehicles = vehicles.filter(
      (v) => v.category.toLowerCase() === pageData.filterCategory!.toLowerCase()
    );
  }

  if (pageData.filterTransmission) {
    vehicles = vehicles.filter((v) => v.transmission === pageData.filterTransmission);
  }

  // Tarifs semaine / mois mis en avant : les véhicules qui en proposent d'abord
  if (pageData.highlightLongStay) {
    const longStay = (v: (typeof vehicles)[number]) => Number(v.weekly_price) > 0 || Number(v.monthly_price) > 0;
    vehicles = [...vehicles].sort((a, b) => Number(longStay(b)) - Number(longStay(a)));
  }

  // Faits calculés sur le catalogue réel (aucun chiffre écrit à la main)
  const agencyIds = new Set(vehicles.map((v) => v.agency_id));
  const zoneAgencies = agencies.filter((agency) => agencyIds.has(agency.id)).slice(0, 6);
  const minPrice = vehicles.length > 0 ? Math.min(...vehicles.map((v) => Number(v.daily_price))) : null;
  const longStayCount = vehicles.filter((v) => Number(v.weekly_price) > 0 || Number(v.monthly_price) > 0).length;
  const catalogFacts =
    vehicles.length > 0 && minPrice !== null
      ? interpolate(copy.facts, {
          vehicles: plural(locale, vehicles.length, pageData.vehicleType === 'MOTORCYCLE' ? copy.twoWheelers : copy.vehicles),
          agencies: plural(locale, agencyIds.size, copy.atAgencies),
          from: interpolate(copy.fromPrice, { price: formatMoney(minPrice, locale) }),
        })
      : null;

  // Données structurées : fil d'Ariane et FAQ (l'organisation est décrite une seule fois, dans le layout)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd([
        { name: copy.home, path: localizeHref('/', locale) },
        { name: pageData.zoneType === 'guide' ? copy.guides : copy.carRental, path: localizeHref('/search', locale) },
        { name: pageData.zoneName, path: pageHref },
      ]),
      {
        '@type': 'FAQPage',
        '@id': `https://clickdrive.ma${pageHref}#faq`,
        inLanguage: locale,
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
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <div className="bg-[#F8FAFC] min-h-screen">
        {/* Breadcrumb Navigation */}
        <div className="bg-white border-b border-slate-200 py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label={copy.breadcrumbAria} className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Link href="/" className="hover:text-slate-900">{copy.home}</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rtl:rotate-180" />
              <Link href="/search" className="hover:text-slate-900">{copy.carRental}</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rtl:rotate-180" />
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
                <span>{catalogFacts ?? copy.factsFallback}</span>
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
                  <span>{copy.badgeFree}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>{copy.badgeVerified}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>{copy.badgePayment}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Guides : contenu éditorial */}
        {pageData.sections && pageData.sections.length > 0 && (
          <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
            <h2 className="text-2xl font-bold text-slate-900">{pageData.introTitle}</h2>
            <div className="mt-6 space-y-8">
              {pageData.sections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-lg font-bold text-slate-900">{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className="mt-2 text-[15px] leading-7 text-slate-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Vehicles Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-bold text-accent-text tracking-wider uppercase">
                {copy.catalogEyebrow}
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                {pageData.zoneType === 'guide' ? copy.vehiclesTitleGuide : interpolate(copy.vehiclesTitle, { zone: pageData.zoneName })}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {catalogFacts ? `${catalogFacts}.` : copy.noVehicles}
                {pageData.highlightLongStay && longStayCount > 0 ? ` ${plural(locale, longStayCount, copy.longStay)}` : ''}
                {' '}{copy.datesHint}
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent-text hover:underline self-start sm:self-auto"
            >
              {copy.seeAll}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
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
                {copy.agenciesTitle}
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                {copy.agenciesText}
              </p>
            </div>

            <I18nScope namespaces={['agencies']}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {zoneAgencies.map((agency) => (
                  <AgencyCard key={agency.id} agency={agency} />
                ))}
              </div>
            </I18nScope>
          </div>
        </section>

        {/* SEO FAQ Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 text-accent-text mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              {interpolate(copy.faqTitle, { zone: pageData.zoneName })}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {copy.faqSubtitle}
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
              {copy.otherPages}
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {ALL_SEO_SLUGS.filter((s) => s !== pageData.slug).map((slug) => {
                const item = getLandingPage(slug, locale);
                if (!item) return null;
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
