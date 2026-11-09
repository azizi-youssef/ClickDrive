import { analyticsConfig, type AnalyticsEvent } from './config';

/**
 * Événement envoyé par le serveur (ex. « Demande acceptée », qui se produit dans l'espace agence
 * et non chez le client). API d'événements Plausible ; aucune donnée personnelle transmise.
 */
export async function trackServerEvent(
  event: AnalyticsEvent,
  url: string,
  props?: Record<string, string>,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const config = analyticsConfig();
  if (!config) return false;
  try {
    const response = await fetchImpl(`${config.origin}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ClickDrive-Server/1.0' },
      body: JSON.stringify({ name: event, url, domain: config.domain, ...(props ? { props } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.warn(`[Analytics] Événement « ${event} » non transmis :`, error instanceof Error ? error.message : error);
    return false;
  }
}
