/**
 * Client HTTP du module de suivi GPS (navigateur). Toutes les routes /api/agency/tracking/* répondent
 * { success, data, meta? } ou { success: false, code, error }.
 */

export class TrackingApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'TrackingApiError';
    this.status = status;
    this.code = code;
  }
}

export interface TrackingRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  /** Support plateforme uniquement : agence ciblée (les membres n'en ont pas besoin) */
  agencyId?: string | null;
}

export interface TrackingResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

const BASE = '/api/agency/tracking';

export async function trackingApi<T>(path: string, request: TrackingRequest = {}): Promise<TrackingResponse<T>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  if (request.agencyId) params.set('agency_id', request.agencyId);
  const url = `${BASE}${path}${params.size > 0 ? `?${params.toString()}` : ''}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: request.method ?? 'GET',
      headers: request.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      cache: 'no-store',
      signal: request.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TrackingApiError(0, 'NETWORK', 'Connexion impossible. Vérifiez votre réseau et réessayez.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // corps vide ou non JSON
  }
  const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};

  if (!response.ok || record.success === false) {
    const message = typeof record.error === 'string' ? record.error : `Erreur ${response.status}`;
    throw new TrackingApiError(response.status, typeof record.code === 'string' ? record.code : 'HTTP', message);
  }
  return { data: record.data as T, meta: (record.meta as Record<string, unknown> | undefined) ?? {} };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function errorMessage(error: unknown): string {
  if (error instanceof TrackingApiError) return error.message;
  if (error instanceof Error && !isAbortError(error)) return 'Une erreur est survenue. Réessayez dans un instant.';
  return 'Une erreur est survenue.';
}
