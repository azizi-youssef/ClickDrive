import { AGENCY_MEMBER_ROLES, USER_ROLES, type AgencyMemberRole, type UserRole } from '@clickdrive/shared/roles';
import type { SupabaseClient } from '@supabase/supabase-js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type ClientAuthProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  roleLabel: string;
  agencyIds: string[];
  agencyMemberships?: { agencyId: string; role: AgencyMemberRole }[];
  agencyName: string | null;
  agencyLogoUrl: string | null;
  canAccessAdmin: boolean;
  canAccessAgency: boolean;
};

// Requête en cours partagée : plusieurs composants montés en même temps ne déclenchent qu'un appel
let inflightProfile: Promise<ClientAuthProfile | null> | null = null;

export function fetchClientAuthProfile(): Promise<ClientAuthProfile | null> {
  inflightProfile ??= loadClientAuthProfile().finally(() => {
    inflightProfile = null;
  });
  return inflightProfile;
}

async function loadClientAuthProfile(): Promise<ClientAuthProfile | null> {
  const res = await fetch('/api/auth/me', { cache: 'no-store' });
  if (res.status === 401) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = isRecord(body) && typeof body.error === 'string'
      ? body.error
      : `Impossible de vérifier la session (HTTP ${res.status}).`;
    throw new Error(message);
  }
  if (!isRecord(body) || body.success !== true || !isRecord(body.user)) {
    throw new Error('Réponse de session invalide.');
  }

  const user = body.user;
  const role = USER_ROLES.find((candidate) => candidate === user.role);
  if (
    typeof user.id !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.displayName !== 'string' ||
    !role ||
    !Array.isArray(user.agencyIds) ||
    !user.agencyIds.every((id) => typeof id === 'string') ||
    typeof user.canAccessAdmin !== 'boolean' ||
    typeof user.canAccessAgency !== 'boolean'
  ) {
    throw new Error('Les informations du compte sont incomplètes.');
  }

  const agencyMemberships = Array.isArray(user.agencyMemberships)
    ? user.agencyMemberships.flatMap((membership) => {
        if (
          !isRecord(membership) ||
          typeof membership.agencyId !== 'string' ||
          !AGENCY_MEMBER_ROLES.includes(membership.role as AgencyMemberRole)
        ) return [];
        return [{ agencyId: membership.agencyId, role: membership.role as AgencyMemberRole }];
      })
    : [];

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : null,
    role,
    roleLabel: typeof user.roleLabel === 'string' ? user.roleLabel : 'Compte',
    agencyIds: user.agencyIds,
    agencyMemberships,
    agencyName: typeof user.agencyName === 'string' ? user.agencyName : null,
    agencyLogoUrl: typeof user.agencyLogoUrl === 'string' ? user.agencyLogoUrl : null,
    canAccessAdmin: user.canAccessAdmin,
    canAccessAgency: user.canAccessAgency,
  };
}

export async function signOutEverywhere(supabase: SupabaseClient | null) {
  if (!supabase) {
    throw new Error('La déconnexion est momentanément indisponible.');
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  const response = await fetch('/api/auth/logout', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`La fermeture de session serveur a échoué (HTTP ${response.status}).`);
  }
}
