'use client';

import { createLocalStore } from '@/lib/ui/local-store';

/**
 * Demandes envoyées sans compte depuis cet appareil : le client qui n'a pas donné d'e-mail (facultatif)
 * et qui a fermé l'écran de confirmation retrouve son lien de suivi signé. Rien d'autre n'est gardé
 * que le libellé du véhicule et les dates (ni nom, ni téléphone).
 */
export type RecentRequest = {
  reference: string;
  /** Chemin signé « /suivi/<réf>?exp=…&sig=… » renvoyé par l'API */
  trackingPath: string;
  vehicle: string;
  startDate: string;
  endDate: string;
  savedAt: number;
};

export const RECENT_REQUESTS_KEY = 'clickdrive:recent-requests';
const MAX_ITEMS = 5;
/** Même durée que la validité du lien de suivi (120 jours) */
const TTL_MS = 120 * 24 * 60 * 60 * 1000;

const isTrackingPath = (value: unknown): value is string =>
  typeof value === 'string' && /^\/suivi\/[^/?#]+\?exp=\d+&sig=[\w-]+$/.test(value);

function parse(raw: unknown): RecentRequest[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): RecentRequest[] => {
    if (typeof item !== 'object' || item === null) return [];
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.reference !== 'string' ||
      !isTrackingPath(entry.trackingPath) ||
      typeof entry.vehicle !== 'string' ||
      typeof entry.startDate !== 'string' ||
      typeof entry.endDate !== 'string' ||
      typeof entry.savedAt !== 'number'
    ) {
      return [];
    }
    return [{
      reference: entry.reference,
      trackingPath: entry.trackingPath,
      vehicle: entry.vehicle,
      startDate: entry.startDate,
      endDate: entry.endDate,
      savedAt: entry.savedAt,
    }];
  });
}

const EMPTY: RecentRequest[] = [];
export const recentRequestsStore = createLocalStore<RecentRequest[]>(RECENT_REQUESTS_KEY, parse, EMPTY);

/** Demandes encore valides, la plus récente d'abord */
export function liveRecentRequests(items: readonly RecentRequest[], now = Date.now()): RecentRequest[] {
  return items.filter((item) => now - item.savedAt < TTL_MS).sort((a, b) => b.savedAt - a.savedAt);
}

/** Mémorise une demande envoyée (sans doublon de référence, 5 au plus) ; ignorée sans lien signé */
export function rememberRecentRequest(entry: Omit<RecentRequest, 'savedAt'>, now = Date.now()): void {
  if (!isTrackingPath(entry.trackingPath)) return;
  const others = liveRecentRequests(recentRequestsStore.read(), now).filter((item) => item.reference !== entry.reference);
  recentRequestsStore.write([{ ...entry, savedAt: now }, ...others].slice(0, MAX_ITEMS));
}

export function forgetRecentRequests(): void {
  recentRequestsStore.write([]);
}
