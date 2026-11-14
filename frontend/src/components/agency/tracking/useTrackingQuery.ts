'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, isAbortError, trackingApi, type TrackingRequest } from '@/lib/tracking/client';
import { useApiAgency } from './TrackingAccess';

export interface QueryState<T> {
  data: T | null;
  meta: Record<string, unknown>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Lecture d'une route du suivi GPS avec annulation (la dernière requête gagne), état de chargement,
 * erreur lisible et rechargement manuel. `enabled=false` suspend la requête (ex. aucune sélection).
 */
export function useTrackingQuery<T>(path: string | null, query: TrackingRequest['query'], enabled = true): QueryState<T> {
  const apiAgency = useApiAgency();
  const [state, setState] = useState<{ data: T | null; meta: Record<string, unknown>; loading: boolean; error: string | null }>({
    data: null,
    meta: {},
    loading: Boolean(path) && enabled,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const queryKey = JSON.stringify(query ?? {});

  useEffect(() => {
    if (!path || !enabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- état de chargement d'une requête déclenchée par ses paramètres
    setState((current) => ({ ...current, loading: true, error: null }));
    trackingApi<T>(path, { query: JSON.parse(queryKey) as TrackingRequest['query'], agencyId: apiAgency, signal: controller.signal })
      .then(({ data, meta }) => {
        if (abortRef.current === controller) setState({ data, meta, loading: false, error: null });
      })
      .catch((error) => {
        if (isAbortError(error) || abortRef.current !== controller) return;
        setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
      });
    return () => controller.abort();
  }, [path, queryKey, enabled, apiAgency, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
