'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Contexte d'accès du suivi GPS, calculé CÔTÉ SERVEUR (permissions revérifiées par la base) puis transmis aux écrans.
 * Il sert uniquement à l'affichage (masquer un bouton) : toute action est de nouveau contrôlée par l'API et la base.
 */
export interface TrackingAccessValue {
  agencyId: string;
  agencyName: string;
  permissions: { read: boolean; manage: boolean; alerts: boolean; settings: boolean };
  /** Support plateforme : l'agence doit être précisée dans chaque appel d'API (lecture seule, accès journalisé) */
  supportMode: boolean;
}

const TrackingAccessContext = createContext<TrackingAccessValue | null>(null);

export function TrackingAccessProvider({ value, children }: { value: TrackingAccessValue; children: ReactNode }) {
  return <TrackingAccessContext.Provider value={value}>{children}</TrackingAccessContext.Provider>;
}

export function useTrackingAccess(): TrackingAccessValue {
  const value = useContext(TrackingAccessContext);
  if (!value) throw new Error('useTrackingAccess doit être utilisé dans <TrackingAccessProvider>.');
  return value;
}

/** Agence à transmettre à l'API : uniquement en mode support (les membres n'en ont pas besoin) */
export function useApiAgency(): string | null {
  const access = useTrackingAccess();
  return access.supportMode ? access.agencyId : null;
}
