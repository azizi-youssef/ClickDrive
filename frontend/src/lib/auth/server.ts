import { isAgencyRole, isPlatformAdminRole } from '@clickdrive/shared/booking-state-machine';
import { AGENCY_MEMBER_ROLES, USER_ROLES, type AgencyMemberRole, type AccessPermission, type UserRole } from '@clickdrive/shared/roles';
import { createClient } from '@/lib/supabase/server';

export type AgencyMembershipContext = {
  agencyId: string;
  role: AgencyMemberRole;
};

export type ServerAuthContext = {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  agencyIds: string[];
  memberships: AgencyMembershipContext[];
  agencyName: string | null;
  agencyLogoUrl: string | null;
};

export async function getServerAuth(): Promise<ServerAuthContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    if (userError.name !== 'AuthSessionMissingError') {
      console.debug('[Auth] Guest visitor or session expired:', userError.message ?? userError.code);
    }
    return null;
  }
  if (!userData.user) return null;
  const user = userData.user;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[Auth] Profile lookup failed:', profileError.message);
    return null;
  }
  if (!profile) {
    console.error('[Auth] Authenticated account has no profile row.');
    return null;
  }
  const role = USER_ROLES.find((candidate) => candidate === profile.role);
  if (!role) {
    console.error('[Auth] Profile contains an invalid role.');
    return null;
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('agency_members')
    .select('agency_id, role')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE');

  if (membershipsError) {
    console.error('[Auth] Agency membership lookup failed:', membershipsError.message);
    return null;
  }

  const membershipsByAgency = new Map<string, AgencyMembershipContext>();
  for (const membership of memberships ?? []) {
    if (
      typeof membership.agency_id !== 'string' ||
      !AGENCY_MEMBER_ROLES.includes(membership.role as AgencyMemberRole)
    ) {
      return null;
    }
    membershipsByAgency.set(membership.agency_id, {
      agencyId: membership.agency_id,
      role: membership.role as AgencyMemberRole,
    });
  }

  let activeAgencies: { id: string; name: string; logo_url: string | null }[] = [];
  if (membershipsByAgency.size > 0) {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name, logo_url')
      .in('id', [...membershipsByAgency.keys()])
      .eq('status', 'ACTIVE')
      .is('archived_at', null);
    if (error) {
      console.error('[Auth] Agency status lookup failed:', error.message);
      return null;
    }
    activeAgencies = data ?? [];
  }

  const activeAgencyIds = new Set(activeAgencies.map((agency) => agency.id));
  const activeMemberships = [...membershipsByAgency.values()].filter((membership) =>
    activeAgencyIds.has(membership.agencyId)
  );
  const agencyIds = activeMemberships.map((membership) => membership.agencyId);
  const email = profile.email ?? user.email ?? '';
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const displayName = (profile.full_name || metadataName || '').trim() || email.split('@')[0] || 'Compte';
  const profileAvatar = profile.avatar_url;
  const metadataAvatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const avatarCandidate = typeof profileAvatar === 'string' ? profileAvatar : metadataAvatar;
  let avatarUrl: string | null = null;
  if (typeof avatarCandidate === 'string') {
    try {
      const parsed = new URL(avatarCandidate);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') avatarUrl = parsed.href;
    } catch {
      avatarUrl = null;
    }
  }
  const agency = activeAgencies[0];

  return {
    userId: user.id,
    email,
    displayName,
    avatarUrl,
    role,
    agencyIds,
    memberships: activeMemberships,
    agencyName: agency?.name ?? null,
    agencyLogoUrl: agency?.logo_url ?? null,
  };
}

export function canAccessAdminArea(auth: ServerAuthContext): boolean {
  return isPlatformAdminRole(auth.role);
}

export function canAccessAgencyArea(auth: ServerAuthContext): boolean {
  return isPlatformAdminRole(auth.role) || auth.agencyIds.length > 0;
}

export function canManageAgencyBooking(auth: ServerAuthContext, agencyId: string): boolean {
  if (isPlatformAdminRole(auth.role)) return true;
  if (!isAgencyRole(auth.role) && auth.agencyIds.length === 0) return false;
  return auth.agencyIds.includes(agencyId);
}

export function canUpdatePlatformSettings(auth: ServerAuthContext): boolean {
  return isPlatformAdminRole(auth.role);
}

export async function hasAccessPermission(
  permission: AccessPermission,
  agencyId?: string
): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;

  const result = agencyId
    ? await supabase.rpc('has_agency_permission', {
        p_agency_id: agencyId,
        p_permission: permission,
      })
    : await supabase.rpc('has_platform_permission', {
        p_permission: permission,
      });

  if (result.error) {
    console.error('[AccessControl] Permission check failed:', result.error.message);
    return false;
  }
  return result.data === true;
}
