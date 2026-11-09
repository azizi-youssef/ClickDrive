import type { Metadata } from 'next';
import React from 'react';
import { notFound } from 'next/navigation';
import type { Agency } from '@/types';
import { breadcrumbJsonLd, jsonLdScript, SITE_URL } from '@/lib/seo/structured-data';
import { loadPublicAgency } from './data';
import { getTranslations, localizedAlternates } from '@/lib/i18n/server';
import { interpolate } from '@/lib/i18n/format';
import { localizeHref } from '@/lib/i18n/routing';

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode };

/** Présentation de l'agence (rédigée en français) en français ; dans une autre langue, résumé traduit */
function summary(agency: Agency, fallback: string, useOwnText: boolean): string {
  const text = (agency.description ?? '').replace(/\s+/g, ' ').trim();
  if (useOwnText && text.length >= 60) return text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text;
  return interpolate(fallback, { agency: agency.name, city: agency.city || 'Nador' });
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { slug } = await params;
  const { locale, t } = await getTranslations();
  const copy = t.meta.pages.agency;
  const agency = await loadPublicAgency(slug).catch(() => null);
  if (!agency) {
    return { title: copy.notFound, robots: { index: false, follow: true } };
  }
  const description = summary(agency, copy.description, locale === 'fr');
  const image = agency.banner_url || agency.logo_url || undefined;
  const values = { agency: agency.name, city: agency.city || 'Nador' };
  const path = `/agencies/${agency.slug}`;
  return {
    title: interpolate(copy.title, values),
    description,
    alternates: await localizedAlternates(path),
    openGraph: {
      type: 'website',
      title: interpolate(copy.ogTitle, values),
      description,
      locale: t.meta.ogLocale,
      url: `${SITE_URL}${localizeHref(path, locale)}`,
      ...(image ? { images: [{ url: image, alt: agency.name }] } : {}),
    },
  };
}

export default async function AgencyDetailLayout({ params, children }: Props) {
  const { slug } = await params;
  const agency = await loadPublicAgency(slug);
  // Agence inexistante, suspendue ou archivée : vraie réponse 404 (pas de « soft 404 » côté navigateur)
  if (!agency) notFound();
  const { locale, t } = await getTranslations();
  const href = (path: string) => localizeHref(path, locale);

  // Données structurées : uniquement des faits enregistrés ; note seulement si de vrais avis existent
  const structured = agency
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'AutoRental',
          '@id': `${SITE_URL}/agencies/${agency.slug}#agency`,
          name: agency.name,
          url: `${SITE_URL}${href(`/agencies/${agency.slug}`)}`,
          ...(agency.description ? { description: agency.description } : {}),
          ...(agency.logo_url ? { logo: agency.logo_url, image: agency.banner_url || agency.logo_url } : {}),
          ...(agency.phone ? { telephone: agency.phone } : {}),
          address: {
            '@type': 'PostalAddress',
            ...(agency.address ? { streetAddress: agency.address } : {}),
            addressLocality: agency.city || 'Nador',
            addressCountry: 'MA',
          },
          ...(typeof agency.latitude === 'number' && typeof agency.longitude === 'number'
            ? { geo: { '@type': 'GeoCoordinates', latitude: agency.latitude, longitude: agency.longitude } }
            : {}),
          ...(agency.review_count > 0 && agency.rating > 0
            ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: agency.rating, reviewCount: agency.review_count } }
            : {}),
        },
        breadcrumbJsonLd([
          { name: t.agencies.list.home, path: href('/') },
          { name: t.agencies.list.agencies, path: href('/agencies') },
          { name: agency.name, path: href(`/agencies/${agency.slug}`) },
        ]),
      ]
    : [];

  return (
    <>
      {children}
      {structured.map((data, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
      ))}
    </>
  );
}
