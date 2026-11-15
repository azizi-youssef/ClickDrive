'use client';

import { useCallback, useEffect, useState } from 'react';

export type AnalyticsRange = { from: string; to: string };

export type AnalyticsReportState<T> = {
  data: T | null;
  /** Premier chargement (aucun rapport à afficher) */
  loading: boolean;
  /** Rechargement : le rapport précédent reste affiché */
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  /** Relance la requête de la période affichée */
  reload: () => void;
};

type Outcome<T> = { key: string; data?: T; error?: string };

async function fetchReport<T>(url: string, parse: (value: unknown) => T, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal });
  const json: unknown = await response.json().catch(() => null);
  const body = typeof json === 'object' && json !== null ? (json as { success?: boolean; data?: unknown; error?: unknown }) : {};
  if (!response.ok || body.success !== true) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Impossible de charger les statistiques.');
  }
  return parse(body.data);
}

/**
 * Charge un rapport de statistiques pour une période. Chaque nouvelle période annule la requête
 * précédente ; pendant un rechargement, l'ancien rapport reste affiché (pas de squelette qui clignote).
 * L'état « en cours » se déduit de la clé de la dernière réponse : aucun setState synchrone dans l'effet.
 * `parse` doit être une fonction stable (définie au niveau du module).
 */
export function useAnalyticsReport<T>(
  endpoint: string,
  range: AnalyticsRange,
  parse: (value: unknown) => T
): AnalyticsReportState<T> {
  const [token, setToken] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [outcome, setOutcome] = useState<Outcome<T> | null>(null);

  const url = `${endpoint}?${new URLSearchParams({ from: range.from, to: range.to }).toString()}`;
  const key = `${url}#${token}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchReport(url, parse, controller.signal)
      .then((report) => {
        if (controller.signal.aborted) return;
        setData(report);
        setLastUpdated(new Date());
        setOutcome({ key, data: report });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setOutcome({ key, error: error instanceof Error ? error.message : 'Impossible de charger les statistiques.' });
      });
    return () => controller.abort();
  }, [url, key, parse]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  const pending = outcome?.key !== key;

  return {
    data,
    loading: pending && data === null,
    refreshing: pending && data !== null,
    error: !pending ? outcome?.error ?? null : null,
    lastUpdated,
    reload,
  };
}
