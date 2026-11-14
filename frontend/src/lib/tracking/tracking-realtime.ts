'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LivePosition } from './types';

/**
 * Temps réel du suivi GPS (Supabase Realtime « postgres_changes »).
 *
 * Sécurité : la souscription filtre sur l'agence, mais l'autorisation réelle est la RLS des tables
 * `vehicle_tracking_latest` et `tracking_alerts` (policies tracking.read) : un client ne reçoit jamais un
 * événement d'une autre agence, même s'il modifie le filtre. Seules la dernière position et les alertes
 * sont diffusées — jamais l'historique.
 *
 * Fiabilité : la page charge d'abord l'état via l'API, puis applique les événements. Connexion perdue →
 * interrogation de secours (15 s) ; reconnexion → rechargement complet (les événements manqués sont rattrapés) ;
 * onglet masqué → pas d'interrogation. Les événements sont regroupés (un rendu par lot, pas un par position).
 */

export type RealtimeStatus = 'disabled' | 'connecting' | 'live' | 'reconnecting';

export interface PositionPatch extends LivePosition {
  vehicle_id: string;
  movement_state: 'MOVING' | 'STATIONARY';
}

export interface RealtimeChannelLike {
  on: (type: 'postgres_changes', filter: Record<string, unknown>, callback: (payload: { eventType?: string; new?: unknown }) => void) => RealtimeChannelLike;
  subscribe: (callback: (status: string) => void) => unknown;
}

export interface RealtimeClientLike {
  channel: (name: string) => RealtimeChannelLike;
  removeChannel: (channel: RealtimeChannelLike) => unknown;
}

export interface TrackingRealtimeOptions {
  agencyId: string;
  onPositions: (patches: PositionPatch[]) => void;
  /** Une alerte a été créée ou modifiée : l'interface recharge son compteur / sa liste */
  onAlertChange?: () => void;
  /** Rechargement complet (reconnexion, interrogation de secours) */
  onResync: () => void;
  onStatus: (status: RealtimeStatus) => void;
  /** Regroupement des positions (ms) */
  batchMs?: number;
  /** Interrogation de secours quand le temps réel est indisponible (ms) */
  fallbackPollMs?: number;
  /** Rafraîchissement lent quand le temps réel fonctionne (états « hors ligne » qui changent sans événement) */
  heartbeatMs?: number;
}

function toPatch(row: unknown): PositionPatch | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.vehicle_id !== 'string' || typeof r.recorded_at !== 'string') return null;
  if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return null;
  return {
    vehicle_id: r.vehicle_id,
    latitude: r.latitude,
    longitude: r.longitude,
    speed_kmh: typeof r.speed_kmh === 'number' ? r.speed_kmh : null,
    heading_deg: typeof r.heading_deg === 'number' ? r.heading_deg : null,
    ignition: typeof r.ignition === 'boolean' ? r.ignition : null,
    accuracy_m: typeof r.accuracy_m === 'number' ? r.accuracy_m : null,
    recorded_at: r.recorded_at,
    movement_state: r.movement_state === 'MOVING' ? 'MOVING' : 'STATIONARY',
  };
}

export interface TrackingRealtimeController {
  start: () => void;
  stop: () => void;
}

/**
 * Cœur indépendant de React (testable) : abonnement, regroupement, états de connexion, interrogation de secours.
 * `client` est le client Supabase navigateur (ou un double de test).
 */
export function createTrackingRealtime(client: RealtimeClientLike | null, options: TrackingRealtimeOptions): TrackingRealtimeController {
  const batchMs = options.batchMs ?? 400;
  const fallbackPollMs = options.fallbackPollMs ?? 15_000;
  const heartbeatMs = options.heartbeatMs ?? 60_000;

  let channel: RealtimeChannelLike | null = null;
  let status: RealtimeStatus = 'disabled';
  let everLive = false;
  let stopped = true;
  let buffer = new Map<string, PositionPatch>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const setStatus = (next: RealtimeStatus) => {
    if (status === next) return;
    status = next;
    options.onStatus(next);
    schedulePolling();
  };

  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

  function schedulePolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    if (stopped) return;
    const interval = status === 'live' ? heartbeatMs : fallbackPollMs;
    pollTimer = setInterval(() => {
      if (visible()) options.onResync();
    }, interval);
  }

  function flush() {
    flushTimer = null;
    if (buffer.size === 0) return;
    const patches = [...buffer.values()];
    buffer = new Map();
    options.onPositions(patches);
  }

  function onPosition(row: unknown) {
    const patch = toPatch(row);
    if (!patch) return;
    const queued = buffer.get(patch.vehicle_id);
    // Un événement plus ancien ne remplace jamais un plus récent dans le lot
    if (!queued || queued.recorded_at <= patch.recorded_at) buffer.set(patch.vehicle_id, patch);
    if (!flushTimer) flushTimer = setTimeout(flush, batchMs);
  }

  function onVisibility() {
    if (visible() && !stopped) options.onResync();
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
      if (!client) {
        // Pas de client temps réel (configuration absente) : interrogation seule, état explicite
        setStatus('reconnecting');
        schedulePolling();
        return;
      }
      status = 'connecting';
      options.onStatus('connecting');

      const filter = `agency_id=eq.${options.agencyId}`;
      channel = client
        .channel(`tracking-${options.agencyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_tracking_latest', filter }, (payload) => {
          if (payload.eventType === 'DELETE') {
            // Boîtier retiré : la ligne disparaît, on recharge plutôt que d'interpréter une clé primaire seule
            options.onResync();
            return;
          }
          onPosition(payload.new);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking_alerts', filter }, () => {
          options.onAlertChange?.();
        });

      channel.subscribe((next) => {
        if (stopped) return;
        if (next === 'SUBSCRIBED') {
          const reconnected = everLive;
          everLive = true;
          setStatus('live');
          // Les événements survenus pendant la coupure sont perdus : rechargement complet
          if (reconnected) options.onResync();
        } else if (next === 'CHANNEL_ERROR' || next === 'TIMED_OUT' || next === 'CLOSED') {
          setStatus('reconnecting');
        }
      });
      schedulePolling();
    },
    stop() {
      stopped = true;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      if (flushTimer) clearTimeout(flushTimer);
      if (pollTimer) clearInterval(pollTimer);
      flushTimer = null;
      pollTimer = null;
      buffer = new Map();
      if (channel && client) void client.removeChannel(channel);
      channel = null;
      status = 'disabled';
    },
  };
}

/** Hook React : abonnement lié à l'agence, nettoyé au démontage ; callbacks toujours à jour sans réabonnement */
export function useTrackingRealtime(options: {
  agencyId: string | null;
  onPositions: (patches: PositionPatch[]) => void;
  onAlertChange?: () => void;
  onResync: () => void;
}): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('disabled');
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });

  const forward = useCallback(
    () => ({
      onPositions: (patches: PositionPatch[]) => callbacks.current.onPositions(patches),
      onAlertChange: () => callbacks.current.onAlertChange?.(),
      onResync: () => callbacks.current.onResync(),
    }),
    []
  );

  const agencyId = options.agencyId;
  useEffect(() => {
    if (!agencyId) return;
    let controller: TrackingRealtimeController | null = null;
    let cancelled = false;
    // supabase-js est chargé à la demande (jamais dans le bundle initial)
    void import('@/lib/supabase/client').then(({ createClient }) => {
      if (cancelled) return;
      const client = createClient() as unknown as RealtimeClientLike | null;
      controller = createTrackingRealtime(client, { agencyId, onStatus: setStatus, ...forward() });
      controller.start();
    });
    return () => {
      cancelled = true;
      controller?.stop();
    };
  }, [agencyId, forward]);

  return agencyId ? status : 'disabled';
}
