/**
 * Client HTTP ClickDrive — par défaut le BFF Next.js (/app/api/*).
 * Express legacy : définir NEXT_PUBLIC_API_URL=http://localhost:4000
 */

const LEGACY_EXPRESS = process.env.NEXT_PUBLIC_API_URL?.trim();

/** Base URL : vide = same-origin BFF (architecture cible). */
export const API_BASE = LEGACY_EXPRESS && LEGACY_EXPRESS.length > 0 ? LEGACY_EXPRESS : '';

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: { field: string; message: string }[];
  meta?: { total: number; limit?: number; offset?: number };
  bookings?: T;
};

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
      });
    } catch (fetchErr) {
      // Si un API_BASE externe a échoué (ex: localhost:4000 éteint), basculer sur le BFF Next.js relatif
      if (API_BASE && url.startsWith(API_BASE)) {
        res = await fetch(path, {
          headers: { 'Content-Type': 'application/json', ...options?.headers },
          ...options,
        });
      } else {
        throw fetchErr;
      }
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: json.error ?? `Erreur ${res.status}`,
        details: json.details,
      };
    }

    return json as ApiResponse<T>;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur de connexion';
    console.warn(`[API Client] Échec ${url}:`, message);
    return {
      success: false,
      error: message,
    };
  }
}

export { apiFetch };
