import { NextRequest } from 'next/server';

/**
 * Délégation d'une route historique vers la route canonique : même URL d'origine et mêmes en-têtes
 * (la session est lue par cookies() dans la route canonique), corps JSON reconstruit après filtrage.
 */
export function forwardJsonRequest(request: Request, body?: unknown): NextRequest {
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(request.url, {
    method: request.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Route historique conservée pour compatibilité : signale la route qui la remplace */
export function markDeprecated<T extends Response>(response: T, successor: string): T {
  response.headers.set('Deprecation', 'true');
  response.headers.set('Link', `<${successor}>; rel="successor-version"`);
  return response;
}
