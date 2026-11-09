import type { SupabaseClient } from '@supabase/supabase-js';
import { isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import { type UserRole } from '@clickdrive/shared/roles';
import { canAccessAgencyPortal } from '@/lib/auth/portals';

export async function verifyAdminPortalLogin(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    await supabase.auth.signOut();
    return 'Impossible de vérifier votre profil. Réessayez.';
  }

  const role = (profile?.role ?? 'CUSTOMER') as UserRole;
  if (!isPlatformAdminRole(role)) {
    await supabase.auth.signOut();
    return 'Ce compte n’a pas accès à l’administration ClickDrive. Utilisez un e-mail administrateur.';
  }

  return null;
}

export async function verifyAgencyPortalLogin(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    await supabase.auth.signOut();
    return 'Impossible de vérifier votre profil. Réessayez.';
  }

  const role = (profile?.role ?? 'CUSTOMER') as UserRole;

  const { data: memberships, error: membershipError } = await supabase
    .from('agency_members')
    .select('agency_id')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (membershipError) {
    await supabase.auth.signOut();
    return 'Impossible de vérifier les accès de votre agence. Réessayez.';
  }
  if (!memberships?.length) {
    await supabase.auth.signOut();
    return 'Aucune agence active n’est associée à ce compte.';
  }

  const agencyIds = memberships.flatMap((membership) =>
    typeof membership.agency_id === 'string' ? [membership.agency_id] : []
  );
  const { data: agencies, error: agenciesError } = await supabase
    .from('agencies')
    .select('id, status, archived_at')
    .in('id', agencyIds);
  if (agenciesError) {
    await supabase.auth.signOut();
    return 'Impossible de vérifier le statut de votre agence. Réessayez.';
  }

  const activeAgencyIds = new Set(
    (agencies ?? [])
      .filter((agency) => agency.status === 'ACTIVE' && !agency.archived_at)
      .map((agency) => agency.id)
  );
  const authorizedAgencyIds = agencyIds.filter((agencyId) => activeAgencyIds.has(agencyId));

  if (!canAccessAgencyPortal(role, authorizedAgencyIds)) {
    await supabase.auth.signOut();
    return 'Ce compte n’est pas autorisé sur le portail agence. Contactez votre responsable ou ClickDrive.';
  }

  if (!isPlatformAdminRole(role) && authorizedAgencyIds.length === 0) {
    await supabase.auth.signOut();
    const hasSuspendedAgency = agencies?.some((agency) => agency.status === 'SUSPENDED');
    return hasSuspendedAgency
      ? 'Ce compte agence est actuellement suspendu par l’administration ClickDrive. Veuillez contacter le support.'
      : 'Ce compte agence est en attente d’activation par l’administration ClickDrive.';
  }

  return null;
}
