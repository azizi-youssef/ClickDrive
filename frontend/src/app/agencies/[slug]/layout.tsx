import type { Metadata } from 'next';
import React, { cache } from 'react';
import { notFound } from 'next/navigation';
import { agenciesService } from '@/lib/services/agencies.service';
import type { Agency } from '@/types';
import { breadcrumbJsonLd, jsonLdScript, SITE_URL } from '@/lib/seo/structured-data';

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode };

/**
 * Agence publique : active et non archivée (les autres ne sont ni indexées ni décrites).
 * Une erreur d'accès à la base est propagée (page d'erreur), jamais présentée comme « introuvable ».
 * Mise en cache pour la requête : métadonnées et layout ne lisent la base qu'une fois.
 */
const loadPublicAgency = cache(async (slug: string): Promise<Agency | null> => {
  const agency = await agenciesService.getAgencyBySlug(decodeURIComponent(slug));
  if (!agency || agency.status !== 'ACTIVE' || ('archived_at' in agency && agency.archived_at)) return null;
  return agency;
});

function summary(agency: Agency): string {
  const text = (agency.description ?? '').replace(/\s+/g, ' ').trim();
  if (text.length >= 60) return text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text;
  return `Louez une voiture ou une moto auprès de ${agency.name}, agence partenaire à ${agency.city || 'Nador'}. Comparez les véhicules et envoyez votre demande sans paiement en ligne.`;
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { slug } = await params;
  const agency = await loadPublicAgency(slug).catch(() => null);
  if (!agency) {
    return { title: 'Agence introuvable', robots: { index: false, follow: true } };
  }
  const description = summary(agency);
  const image = agency.banner_url || agency.logo_url || undefined;
  return {
    title: `${agency.name} — location de véhicules à ${agency.city || 'Nador'}`,
    description,
    alternates: { canonical: `/agencies/${agency.slug}` },
    openGraph: {
      type: 'website',
      title: `${agency.name} — agence partenaire ClickDrive`,
      description,
      url: `${SITE_URL}/agencies/${agency.slug}`,
      ...(image ? { images: [{ url: image, alt: agency.name }] } : {}),
    },
  };
}

export default async function AgencyDetailLayout({ params, children }: Props) {
  const { slug } = await params;
  const agency = await loadPublicAgency(slug);
  // Agence inexistante, suspendue ou archivée : vraie réponse 404 (pas de « soft 404 » côté navigateur)
  if (!agency) notFound();

  // Données structurées : uniquement des faits enregistrés ; note seulement si de vrais avis existent
  const structured = agency
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'AutoRental',
          '@id': `${SITE_URL}/agencies/${agency.slug}#agency`,
          name: agency.name,
          url: `${SITE_URL}/agencies/${agency.slug}`,
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
          { name: 'Accueil', path: '/' },
          { name: 'Agences', path: '/agencies' },
          { name: agency.name, path: `/agencies/${agency.slug}` },
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
