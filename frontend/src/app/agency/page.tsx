import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AgencyWorkspace } from '@/components/agency/AgencyWorkspace';
import { canAccessAgencyArea, getServerAuth, hasAccessPermission } from '@/lib/auth/server';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AgencyPage() {
  // L'identité et l'appartenance viennent de la session serveur validée.
  // Aucun agencyId ou rôle n'est lu depuis le client.
  const auth = await getServerAuth();
  if (!auth || !canAccessAgencyArea(auth)) {
    redirect('/login?portal=agency&error=forbidden');
  }

  const agencyId = auth.agencyIds[0];
  if (!agencyId) {
    redirect('/login?portal=agency&error=no-agency');
  }

  // Suivi GPS : l'entrée de navigation n'apparaît que pour tracking.read (la base et l'API revérifient)
  const canViewTracking = await hasAccessPermission('tracking.read', agencyId);

  // L'espace lit la section et la réservation ouverte dans l'adresse (useSearchParams)
  return (
    <Suspense>
    <AgencyWorkspace
      canViewTracking={canViewTracking}
      agency={{
        id: agencyId,
        name: auth.agencyName ?? 'Mon agence',
        // Valeur réelle de l'agence : « Agence vérifiée » ne s'affiche que si ClickDrive l'a vérifiée
        verified: auth.agencyVerified,
        logoUrl: auth.agencyLogoUrl,
      }}
      profile={{
        role: auth.role,
        email: auth.email,
        displayName: auth.displayName,
        avatarUrl: auth.avatarUrl,
      }}
    />
    </Suspense>
  );
}

