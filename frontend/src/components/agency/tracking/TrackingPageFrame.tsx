import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ShieldX } from 'lucide-react';
import { isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import type { TrackingPermission } from '@clickdrive/shared/roles';
import { getServerAuth } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';
import { TrackingShell } from './TrackingShell';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Denied({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 bg-[#F5F6F8] px-6 text-center">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <ShieldX className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-bold text-[#0B1220]">{title}</h1>
      <p className="text-sm text-[#64748B]">{text}</p>
      <Link href="/agency" className="mt-2 inline-flex min-h-10 items-center rounded-xl bg-[#0B1220] px-4 text-sm font-semibold text-white">
        Retour à l’espace agence
      </Link>
    </main>
  );
}

/**
 * Garde SERVEUR des pages de suivi GPS (la navigation est aussi filtrée par le middleware, et chaque appel d'API
 * revérifie l'accès) : session, agence résolue depuis les appartenances, permission tracking.read par la base.
 * Aucune donnée de position n'est rendue ici ; le client les charge ensuite par l'API autorisée.
 */
export async function TrackingPageFrame({ searchParams, children }: { searchParams: SearchParams; children: ReactNode }) {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?portal=agency&error=forbidden');

  const params = await searchParams;
  const requestedRaw = params.agency_id;
  const requested = typeof requestedRaw === 'string' ? requestedRaw : undefined;
  if (requested !== undefined && !UUID.test(requested)) {
    return <Denied title="Accès non autorisé" text="Identifiant d’agence invalide." />;
  }

  const isMember = (id: string) => auth.agencyIds.includes(id);
  const platform = isPlatformAdminRole(auth.role);
  const agencyId = requested ?? auth.agencyIds[0];
  if (!agencyId || (!isMember(agencyId) && !platform)) {
    return <Denied title="Accès non autorisé" text="Votre compte n’a pas accès au suivi GPS de cette agence." />;
  }

  let db: Awaited<ReturnType<typeof createClient>>;
  try {
    db = await createClient();
  } catch {
    db = null;
  }
  if (!db) return <Denied title="Service indisponible" text="Le suivi GPS est temporairement indisponible. Réessayez dans un instant." />;

  const check = async (permission: TrackingPermission) => {
    const { data, error } = await db.rpc('has_tracking_permission', { p_agency_id: agencyId, p_permission: permission });
    return !error && data === true;
  };
  const [read, manage, alerts, settings] = await Promise.all([
    check('tracking.read'),
    check('tracking.manage'),
    check('tracking.alerts.manage'),
    check('tracking.settings.manage'),
  ]);
  if (!read) {
    return (
      <Denied
        title="Accès non autorisé"
        text="Votre rôle ne donne pas accès au suivi GPS. Contactez l’administrateur de votre agence pour obtenir l’accès."
      />
    );
  }

  const { data: agency } = await db.from('agencies').select('name, logo_url').eq('id', agencyId).maybeSingle();
  const agencyName = agency?.name ?? auth.agencyName ?? 'Mon agence';

  return (
    <TrackingShell
      agency={{ name: agencyName, logoUrl: agency?.logo_url ?? auth.agencyLogoUrl, verified: true }}
      profile={{ displayName: auth.displayName, avatarUrl: auth.avatarUrl }}
      access={{
        agencyId,
        agencyName,
        permissions: { read, manage, alerts, settings },
        supportMode: !isMember(agencyId),
      }}
    >
      {children}
    </TrackingShell>
  );
}
