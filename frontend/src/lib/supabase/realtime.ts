'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from './client';

export type RealtimeTable =
  | 'vehicles'
  | 'bookings'
  | 'agencies'
  | 'vehicle_unavailability'
  | 'reviews'
  | 'profiles';

const BROADCAST_CHANNEL_NAME = 'clickdrive:realtime_broadcast';
const DOM_EVENT_NAME = 'clickdrive:realtime_event';

/**
 * Notifie immédiatement tous les composants locaux et autres onglets ouverts
 * qu'une table a été modifiée (ex: après création d'une réservation, validation, etc.).
 */
export function notifyRealtimeChange(tables: RealtimeTable | RealtimeTable[]) {
  if (typeof window === 'undefined') return;

  const tableList = Array.isArray(tables) ? tables : [tables];

  // 1. Événement DOM local
  window.dispatchEvent(
    new CustomEvent(DOM_EVENT_NAME, {
      detail: { tables: tableList, timestamp: Date.now() },
    })
  );

  // 2. BroadcastChannel inter-onglets
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ tables: tableList, timestamp: Date.now() });
      channel.close();
    } catch {
      // Ignorer silencieusement si non supporté
    }
  }
}

export interface UseRealtimeRefreshOptions {
  /**
   * Tables Supabase à écouter en temps réel
   * (ex: ['vehicles', 'bookings'])
   */
  tables: RealtimeTable[];
  /**
   * Fonction de rafraîchissement à déclencher lors d'un changement
   */
  onRefresh: () => void | Promise<void>;
  /**
   * Intervalle de secours en millisecondes pour un rafraîchissement périodique passif.
   * Par défaut: 20 000 ms (20s). Passer 0 ou null pour désactiver.
   */
  pollingIntervalMs?: number | null;
  /**
   * Déclencher un rafraîchissement dès que l'utilisateur revient sur l'onglet (window focus).
   * Par défaut: true.
   */
  enableFocusRefresh?: boolean;
  /**
   * Déclencher un rafraîchissement lorsque le document redevient visible.
   * Par défaut: true.
   */
  enableVisibilityRefresh?: boolean;
  /**
   * Délai d'attente (anti-rebond) en millisecondes pour éviter les rafales d'appels.
   * Par défaut: 350 ms.
   */
  debounceMs?: number;
  /**
   * Activer ou désactiver l'écoute (utile pour conditionner à un état).
   * Par défaut: true.
   */
  enabled?: boolean;
}

/**
 * Hook universel de rafraîchissement automatique des pages ClickDrive.
 * Combine :
 * - Les WebSockets Supabase Realtime (changements de la base de données en direct)
 * - La synchronisation multi-onglets (BroadcastChannel)
 * - Le retour de focus / onglet actif
 * - Un intervalle régulier de sécurité en arrière-plan
 */
export function useRealtimeRefresh({
  tables,
  onRefresh,
  pollingIntervalMs = 20_000,
  enableFocusRefresh = true,
  enableVisibilityRefresh = true,
  debounceMs = 350,
  enabled = true,
}: UseRealtimeRefreshOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const refreshRef = useRef(onRefresh);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tablesRef = useRef(tables);

  useEffect(() => {
    refreshRef.current = onRefresh;
    tablesRef.current = tables;
  }, [onRefresh, tables]);

  // Déclenchement protégé par debounce
  const triggerRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      try {
        void refreshRef.current();
        setLastRefreshAt(new Date());
      } catch (err) {
        console.warn('[useRealtimeRefresh] Refresh error:', err);
      }
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // 1. Écouteur de broadcast / événement local
    const handleLocalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ tables?: RealtimeTable[] }>;
      const changedTables = customEvent.detail?.tables ?? [];
      const hasMatch = changedTables.some((t) => tablesRef.current.includes(t));
      if (hasMatch || changedTables.length === 0) {
        triggerRefresh();
      }
    };

    window.addEventListener(DOM_EVENT_NAME, handleLocalEvent);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (event) => {
          const changedTables: RealtimeTable[] = event.data?.tables ?? [];
          const hasMatch = changedTables.some((t) => tablesRef.current.includes(t));
          if (hasMatch || changedTables.length === 0) {
            triggerRefresh();
          }
        };
      } catch {
        // Fallback sans BroadcastChannel
      }
    }

    // 2. Événements fenêtre (Focus & Visibility)
    const handleFocus = () => {
      if (enableFocusRefresh && document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    const handleVisibilityChange = () => {
      if (enableVisibilityRefresh && document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    if (enableFocusRefresh) {
      window.addEventListener('focus', handleFocus);
    }
    if (enableVisibilityRefresh) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // 3. Polling de secours en arrière-plan
    let pollInterval: NodeJS.Timeout | null = null;
    if (pollingIntervalMs && pollingIntervalMs > 0) {
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          triggerRefresh();
        }
      }, pollingIntervalMs);
    }

    // 4. Supabase Realtime WebSocket
    const supabase = createClient();
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    if (supabase) {
      const channelName = `realtime_${tables.slice().sort().join('_')}_${Math.random().toString(36).slice(2, 7)}`;
      channel = supabase.channel(channelName);

      tables.forEach((tableName) => {
        channel!.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          () => {
            triggerRefresh();
          }
        );
      });

      channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });
    }

    // Nettoyage complet
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      window.removeEventListener(DOM_EVENT_NAME, handleLocalEvent);
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
      if (enableFocusRefresh) {
        window.removeEventListener('focus', handleFocus);
      }
      if (enableVisibilityRefresh) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [
    enabled,
    tables,
    pollingIntervalMs,
    enableFocusRefresh,
    enableVisibilityRefresh,
    triggerRefresh,
  ]);

  return {
    isConnected,
    lastRefreshAt,
    refreshNow: triggerRefresh,
  };
}
