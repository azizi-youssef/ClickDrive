import { notFound } from 'next/navigation';
import { AgencyProfile } from './AgencyProfile';
import { loadAgencyVehicles, loadPublicAgency, toAgencyProfile } from './data';
import { loadAgencyResponseTime } from '@/lib/bookings/response-time';
import { I18nScope } from '@/components/i18n/I18nScope';

// Rendu à la requête : la flotte et son statut du jour évoluent en continu
export const dynamic = 'force-dynamic';

interface AgencyDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Fiche agence rendue côté serveur : nom, informations et flotte présents dès le HTML
 * (plus d'écran de chargement ni de liste de toutes les agences téléchargée par le navigateur).
 * L'agence est lue une seule fois par requête (cache partagé avec le layout et les métadonnées).
 */
export default async function AgencyDetailPage({ params }: AgencyDetailPageProps) {
  const { slug } = await params;
  const agency = await loadPublicAgency(slug);
  if (!agency) notFound();

  const [vehicles, responseTime] = await Promise.all([loadAgencyVehicles(agency.id), loadAgencyResponseTime(agency.id)]);
  return (
    <I18nScope namespaces={['agencies']}>
      <AgencyProfile agency={toAgencyProfile(agency)} initialVehicles={vehicles} responseTime={responseTime} />
    </I18nScope>
  );
}
