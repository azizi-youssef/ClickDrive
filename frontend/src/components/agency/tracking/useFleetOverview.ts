'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyPositionPatches, deriveSummary } from '@/lib/tracking/fleet-state';
import { errorMessage, isAbortError, trackingApi } from '@/lib/tracking/client';
import { useTrackingRealtime, type PositionPatch, type RealtimeStatus } from '@/lib/tracking/tracking-realtime';
import type { FleetOverview, FleetSummary, FleetVehicle } from '@/lib/tracking/types';
import { useApiAgency, useTrackingAccess } from './TrackingAccess';

export interface FleetState {
  vehicles: FleetVehicle[];
  summary: FleetSummary | null;
  total: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  realtime: RealtimeStatus;
  reload: () => void;
}

/**
 * Chargement initial de la flotte (API autorisée), puis mises à jour en temps réel appliquées sur l'état local.
 * Les compteurs sont recalculés localement à chaque position ; une relecture complète (secours, reconnexion,
 * alerte) resynchronise tout. Une seule requête pour toute la flotte : jamais une requête par véhicule.
 */
export function useFleetOverview(): FleetState {
  const { agencyId } = useTrackingAccess();
  const apiAgency = useApiAgency();
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (silent) setRefreshing(true);
      try {
        const { data } = await trackingApi<FleetOverview>('/vehicles', { query: { limit: 500 }, agencyId: apiAgency, signal: controller.signal });
        setVehicles(data.vehicles);
        setOpenAlerts(data.summary.open_alerts);
        setTotal(data.total);
        setError(null);
        setLastLoadedAt(Date.now());
      } catch (err) {
        if (isAbortError(err)) return;
        // Un échec de rafraîchissement silencieux ne masque pas les données déjà affichées
        setError(errorMessage(err));
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [apiAgency]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial de la flotte
    void load(false);
    return () => abortRef.current?.abort();
  }, [load]);

  const realtime = useTrackingRealtime({
    agencyId,
    onPositions: useCallback((patches: PositionPatch[]) => setVehicles((current) => applyPositionPatches(current, patches)), []),
    onAlertChange: useCallback(() => void load(true), [load]),
    onResync: useCallback(() => void load(true), [load]),
  });

  const summary = useMemo(() => (loading && vehicles.length === 0 ? null : deriveSummary(vehicles, openAlerts)), [loading, vehicles, openAlerts]);
  const reload = useCallback(() => void load(true), [load]);

  return { vehicles, summary, total, loading, refreshing, error, lastLoadedAt, realtime, reload };
}
