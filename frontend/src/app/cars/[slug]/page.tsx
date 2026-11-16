import { notFound } from 'next/navigation';
import { CarDetailsClient } from './CarDetailsClient';
import { getPublicAlternatives, getPublicVehicleBySlug } from '@/lib/vehicles/public-queries';
import { breadcrumbJsonLd, jsonLdScript, SITE_URL } from '@/lib/seo/structured-data';
import { isMotorcycle } from '@/lib/vehicles/kind';
import type { Vehicle } from '@/types';
import { I18nScope } from '@/components/i18n/I18nScope';
import { getTranslations } from '@/lib/i18n/server';
import { localizeHref } from '@/lib/i18n/routing';
import { parseRentalPeriod } from '@/lib/utils/date-only';
import { parseSearchLocation } from '@/lib/catalog/search-context';

// Rendu à la requête : prix et statut proviennent de la base au moment de la visite
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  /** Dates de la recherche (?startDate=…&endDate=…) reprises par la carte de réservation */
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const FUEL_SCHEMA: Record<string, string> = { DIESEL: 'Diesel', GASOLINE: 'Gasoline', HYBRID: 'Hybrid', ELECTRIC: 'Electric' };

/** Données structurées du véhicule : faits enregistrés uniquement (pas de note, pas de disponibilité affirmée) */
function vehicleJsonLd(vehicle: Vehicle, url: string, agencyUrl: string | null) {
  const moto = isMotorcycle(vehicle);
  return {
    '@context': 'https://schema.org',
    '@type': moto ? 'Motorcycle' : 'Car',
    '@id': `${url}#vehicle`,
    name: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
    url,
    brand: { '@type': 'Brand', name: vehicle.brand },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    ...(vehicle.images?.length ? { image: vehicle.images.slice(0, 5) } : {}),
    ...(FUEL_SCHEMA[vehicle.fuel] ? { fuelType: FUEL_SCHEMA[vehicle.fuel] } : {}),
    vehicleTransmission: vehicle.transmission === 'AUTOMATIC' ? 'Automatic' : 'Manual',
    ...(vehicle.seats > 0 ? { seatingCapacity: vehicle.seats } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'MAD',
      price: vehicle.daily_price,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: vehicle.daily_price,
        priceCurrency: 'MAD',
        unitCode: 'DAY',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'DAY' },
      },
      ...(vehicle.agency && agencyUrl ? { seller: { '@type': 'AutoRental', name: vehicle.agency.name, url: agencyUrl } } : {}),
    },
  };
}

/**
 * Fiche véhicule rendue côté serveur : contenu, métadonnées et données structurées présents dans le HTML.
 * L'interactivité (galerie, disponibilité par dates, demande de réservation) reste dans CarDetailsClient.
 */
export default async function CarDetailsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const vehicle = await getPublicVehicleBySlug(slug);
  if (!vehicle) notFound();
  // Période choisie dans la recherche : la fiche l'affiche au lieu de repartir d'« aujourd'hui + 3 jours ».
  // L'adresse canonique reste celle sans paramètres (layout).
  const query = await searchParams;
  const requestedPeriod = parseRentalPeriod(query.startDate, query.endDate);
  // Lieu de prise en charge choisi dans la recherche : repris par la demande
  const requestedLocation = parseSearchLocation(query.location);

  const alternativesPool = await getPublicAlternatives(vehicle);
  const moto = isMotorcycle(vehicle);
  const { locale, t } = await getTranslations();
  // Adresses dans la langue de la page (données structurées comprises)
  const href = (path: string) => localizeHref(path, locale);
  const structured = [
    vehicleJsonLd(
      vehicle,
      `${SITE_URL}${href(`/cars/${vehicle.slug}`)}`,
      vehicle.agency ? `${SITE_URL}${href(`/agencies/${vehicle.agency.slug}`)}` : null
    ),
    breadcrumbJsonLd([
      { name: t.car.home, path: href('/') },
      { name: moto ? t.car.motos : t.car.cars, path: href(moto ? '/motos' : '/search') },
      { name: `${vehicle.brand} ${vehicle.model}`, path: href(`/cars/${vehicle.slug}`) },
    ]),
  ];

  return (
    <>
      <I18nScope namespaces={['car', 'booking']}>
        <CarDetailsClient
          slug={vehicle.slug}
          initialVehicle={vehicle}
          alternativesPool={alternativesPool}
          requestedPeriod={requestedPeriod}
          requestedLocation={requestedLocation}
        />
      </I18nScope>
      {structured.map((data, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
      ))}
    </>
  );
}
