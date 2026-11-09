import type { Metadata } from 'next';
import React from 'react';
import { getPublicVehicleBySlug } from '@/lib/vehicles/public-queries';
import { formatEngineCc, isMotorcycle } from '@/lib/vehicles/kind';
import { SITE_URL } from '@/lib/seo/structured-data';
import { getTranslations, localizedAlternates } from '@/lib/i18n/server';
import { interpolate, plural } from '@/lib/i18n/format';
import { transmissionLabel } from '@/lib/i18n/labels';
import { localizeHref } from '@/lib/i18n/routing';

type Props = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

/** Métadonnées issues des vraies données du véhicule (même lecture mise en cache que la page) */
export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { slug } = await params;
  const { locale, t } = await getTranslations();
  const copy = t.meta.pages.vehicle;
  const vehicle = await getPublicVehicleBySlug(slug).catch(() => null);
  if (!vehicle) {
    return { title: copy.notFound, robots: { index: false, follow: true } };
  }

  const moto = isMotorcycle(vehicle);
  const name = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const agency = vehicle.agency?.name;
  const specs = [moto ? formatEngineCc(vehicle.engine_cc) : plural(locale, vehicle.seats, t.vehicle.seats), transmissionLabel(t, vehicle.transmission)]
    .filter(Boolean)
    .join(', ');
  const description = interpolate(moto ? copy.descMoto : copy.descCar, {
    name,
    agency: agency ? interpolate(copy.atAgency, { agency }) : '',
    price: vehicle.daily_price,
    specs,
  });
  const image = vehicle.images?.[0];
  const path = `/cars/${vehicle.slug}`;

  return {
    title: interpolate(copy.title, { name }),
    description,
    alternates: await localizedAlternates(path),
    openGraph: {
      title: interpolate(copy.ogTitle, { name }),
      description,
      url: `${SITE_URL}${localizeHref(path, locale)}`,
      locale: t.meta.ogLocale,
      ...(image ? { images: [{ url: image, alt: name }] } : {}),
    },
  };
}

export default function CarSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
