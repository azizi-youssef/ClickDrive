'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Barre latérale des espaces agence (tableau de bord, Suivi GPS) : une seule préférence pour les deux */
export const AGENCY_SIDEBAR_COLLAPSED_KEY = 'clickdrive:agency-sidebar-collapsed';
export const ADMIN_SIDEBAR_COLLAPSED_KEY = 'clickdrive:admin-sidebar-collapsed';

/** Valeur gardée en mémoire quand le stockage du navigateur est bloqué (navigation privée, cookies refusés) */
const memory = new Map<string, boolean>();

const changeEvent = (key: string) => `${key}:change`;

function read(key: string): boolean {
  try {
    const value = window.localStorage.getItem(key) === '1';
    memory.set(key, value);
    return value;
  } catch {
    // Stockage bloqué : seule la valeur de cette page compte
    return memory.get(key) ?? false;
  }
}

/**
 * Préférence « réduit / déplié » mémorisée dans le navigateur (par appareil), partagée par tous les
 * composants qui utilisent la même clé et par les autres onglets. Rendu serveur : déplié (aucun écart
 * à l'hydratation), puis la préférence s'applique. Sans stockage disponible, le bouton marche quand même.
 */
export function useCollapsedPreference(key: string): readonly [boolean, () => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) callback();
      };
      window.addEventListener(changeEvent(key), callback);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(changeEvent(key), callback);
        window.removeEventListener('storage', onStorage);
      };
    },
    [key]
  );
  const collapsed = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false
  );
  const toggle = useCallback(() => {
    const next = !read(key);
    memory.set(key, next);
    try {
      window.localStorage.setItem(key, next ? '1' : '0');
    } catch {
      /* stockage indisponible : la préférence vaut pour cette page seulement */
    }
    window.dispatchEvent(new Event(changeEvent(key)));
  }, [key]);
  return [collapsed, toggle] as const;
}
