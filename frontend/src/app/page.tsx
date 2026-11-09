import type { Metadata } from 'next';
import { HomeClient } from './HomeClient';
import { getPublicCatalog } from '@/lib/services/public-catalog.service';
import { I18nScope } from '@/components/i18n/I18nScope';
import { localizedAlternates } from '@/lib/i18n/server';

// Rendu à la requête : jamais de données figées au build (ni données de démonstration sans Supabase)
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await localizedAlternates('/') };
}

/**
 * Accueil : véhicules et agences préchargés côté serveur (contenu visible dès le HTML,
 * sans attendre les appels /api côté navigateur). L'interactivité reste dans HomeClient.
 */
export default async function HomePage() {
  const catalog = await getPublicCatalog();
  return (
    <I18nScope namespaces={['hero', 'searchBar', 'brands', 'home']}>
      <HomeClient initialVehicles={catalog?.vehicles ?? null} initialAgencies={catalog?.agencies ?? null} />
    </I18nScope>
  );
}
