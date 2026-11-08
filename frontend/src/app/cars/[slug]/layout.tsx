import type { Metadata } from 'next';
import React from 'react';
import { getPublicVehicleBySlug } from '@/lib/vehicles/public-queries';
import { formatEngineCc, isMotorcycle } from '@/lib/vehicles/kind';
import { SITE_URL } from '@/lib/seo/structured-data';

type Props = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

/** Métadonnées issues des vraies données du véhicule (même lecture mise en cache que la page) */
export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getPublicVehicleBySlug(slug).catch(() => null);
  if (!vehicle) {
    return { title: 'Véhicule introuvable', robots: { index: false, follow: true } };
  }

  const moto = isMotorcycle(vehicle);
  const name = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const agency = vehicle.agency?.name;
  const specs = [
    moto ? formatEngineCc(vehicle.engine_cc) : `${vehicle.seats} places`,
    vehicle.transmission === 'AUTOMATIC' ? 'boîte automatique' : 'boîte manuelle',
  ]
    .filter(Boolean)
    .join(', ');
  const description = `Louez ${moto ? 'la moto' : 'la voiture'} ${name} à Nador${agency ? ` chez ${agency}` : ''} : ${vehicle.daily_price} DH par jour, ${specs}. Demande de réservation en ligne.`;
  const image = vehicle.images?.[0];

  return {
    title: `Louer ${name} à Nador`,
    description,
    alternates: { canonical: `/cars/${vehicle.slug}` },
    openGraph: {
      title: `${name} en location à Nador — ClickDrive`,
      description,
      url: `${SITE_URL}/cars/${vehicle.slug}`,
      ...(image ? { images: [{ url: image, alt: name }] } : {}),
    },
  };
}

export default function CarSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
