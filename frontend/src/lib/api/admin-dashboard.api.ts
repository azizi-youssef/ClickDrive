import type { AdminStats } from '@/lib/api/stats.api';
import type { Agency, Booking } from '@/types';
import type { AdminOverview } from '@/lib/admin/overview';
import { getErrorMessage } from '@/lib/errors';

type ApiEnvelope<T> = {
  success: boolean;
  error?: string;
  data?: T;
  bookings?: Booking[];
};

async function parseJson<T>(res: Response, pick: (body: ApiEnvelope<T>) => T | undefined): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? `Erreur HTTP ${res.status}`);
  }
  const value = pick(body);
  if (value === undefined) {
    throw new Error('Réponse API incomplète');
  }
  return value;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch('/api/stats/admin', { cache: 'no-store' });
  return parseJson(res, (b) => b.data);
}

export type AdminAgency = Agency & {
  vehicle_count?: number | null;
  booking_count?: number;
  member_count?: number;
  archived_at?: string | null;
};

export type CreateAgencyInput = {
  name: string;
  manager_name?: string;
  phone: string;
  whatsapp?: string;
  email: string;
  password?: string;
  address: string;
  city: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  status: 'ACTIVE' | 'PENDING';
  description?: string;
  logo_url?: string;
};

export type AgencyCredentialsResponse = {
  email: string;
  temporaryPassword: string;
  slug: string;
};

export type CreatedAgencyResponse = {
  data: AdminAgency;
  credentials: {
    email: string;
    temporaryPassword: string;
    manager_name: string;
    loginUrl: string;
  };
};

/** Vue d'ensemble : décomptes, tendance et listes courtes calculés côté serveur */
export async function fetchAdminOverview(): Promise<AdminOverview> {
  const res = await fetch('/api/admin/overview', { cache: 'no-store' });
  return parseJson(res, (b) => b.data as AdminOverview | undefined);
}

export async function fetchAdminBookings(): Promise<Booking[]> {
  const res = await fetch('/api/bookings', { cache: 'no-store' });
  return parseJson(res, (b) => b.bookings);
}

export async function fetchAdminAgencies(): Promise<AdminAgency[]> {
  const res = await fetch('/api/admin/agencies?pageSize=100', { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    // Fallback to public endpoint if admin query fails
    const fallback = await fetch('/api/agencies?onlyActive=false', { cache: 'no-store' });
    return parseJson(fallback, (b) => b.data);
  }
  return body.data ?? [];
}

export async function fetchAdminAgenciesPaged(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  city?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}): Promise<{ agencies: AdminAgency[]; total: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.status) query.set('status', params.status);
  if (params?.city) query.set('city', params.city);
  if (params?.sort) query.set('sort', params.sort);
  if (params?.direction) query.set('direction', params.direction);

  const res = await fetch(`/api/admin/agencies?${query.toString()}`, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? `Erreur HTTP ${res.status}`);
  }
  return {
    agencies: body.data ?? [],
    total: body.meta?.total ?? body.data?.length ?? 0,
    totalPages: body.meta?.totalPages ?? 1,
  };
}

export async function generateAgencyCredentials(name: string): Promise<AgencyCredentialsResponse> {
  const res = await fetch(`/api/admin/agencies/credentials?name=${encodeURIComponent(name)}`, { cache: 'no-store' });
  return parseJson(res, (b) => b.data);
}

export async function createAdminAgency(payload: CreateAgencyInput): Promise<CreatedAgencyResponse> {
  const res = await fetch('/api/admin/agencies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? `Erreur de création (${res.status})`);
  }
  return body as CreatedAgencyResponse;
}

export async function updateAdminAgency(
  agencyId: string,
  payload: Partial<Agency>
): Promise<AdminAgency> {
  const res = await fetch(`/api/admin/agencies/${encodeURIComponent(agencyId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(res, (b) => b.data);
}

export async function resetAgencyPassword(
  agencyId: string,
  password?: string
): Promise<{ email: string; temporaryPassword: string; agencyName: string }> {
  const res = await fetch(`/api/admin/agencies/${encodeURIComponent(agencyId)}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(password ? { password } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? 'Échec de réinitialisation du mot de passe');
  }
  return body.credentials;
}

export async function deleteAdminAgency(
  agencyId: string,
  confirmationName: string
): Promise<{ mode: 'archived' | 'deleted'; message: string }> {
  const res = await fetch(`/api/admin/agencies/${encodeURIComponent(agencyId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmationName }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? 'Échec de suppression de l’agence');
  }
  return { mode: body.mode ?? 'archived', message: body.message };
}

export async function patchAgencyVerification(
  agencyId: string,
  payload: { status: string; verified: boolean }
): Promise<Agency> {
  const res = await fetch(`/api/admin/agencies/${encodeURIComponent(agencyId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  try {
    return await parseJson(res, (b) => b.data);
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Impossible de modifier le statut de l’agence.'));
  }
}

export async function fetchCommissionRatePct(): Promise<number | null> {
  const res = await fetch('/api/settings/commission', { cache: 'no-store' });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    settings?: { commission_rate?: number };
  };
  if (body.success && body.settings?.commission_rate != null) {
    return Number(body.settings.commission_rate);
  }
  return null;
}

export type HealthReport = {
  success: boolean;
  checks: Record<string, string>;
  timestamp: string;
};

/** Etat du systeme (jamais bloquant pour le dashboard). */
export async function fetchHealth(): Promise<HealthReport | null> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    const body = (await res.json()) as Partial<HealthReport>;
    if (!body.checks) return null;
    return body as HealthReport;
  } catch {
    return null;
  }
}
