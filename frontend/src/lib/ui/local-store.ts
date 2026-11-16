'use client';

import { useSyncExternalStore } from 'react';

/**
 * Petite valeur JSON mémorisée dans le navigateur (par appareil), partagée par tous les composants qui
 * lisent la même clé et par les autres onglets. Rendu serveur : valeur vide (aucun écart à l'hydratation).
 * Stockage bloqué (navigation privée, cookies refusés) : la valeur vit en mémoire le temps de la page.
 */
export type LocalStore<T> = {
  read: () => T;
  write: (next: T) => void;
  subscribe: (callback: () => void) => () => void;
  /** Valeur courante, mise à jour à chaque écriture (ici ou dans un autre onglet) */
  useValue: () => T;
};

export function createLocalStore<T>(key: string, parse: (raw: unknown) => T, empty: T): LocalStore<T> {
  const changeEvent = `${key}:change`;
  // Instantané stable tant que le texte stocké ne change pas (exigé par useSyncExternalStore)
  let cachedRaw: string | null | undefined;
  let cachedValue: T = empty;
  let memory: string | null = null;

  const rawValue = (): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory;
    }
  };

  const read = (): T => {
    if (typeof window === 'undefined') return empty;
    const raw = rawValue();
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    try {
      cachedValue = raw === null ? empty : parse(JSON.parse(raw));
    } catch {
      cachedValue = empty;
    }
    return cachedValue;
  };

  const write = (next: T) => {
    const raw = JSON.stringify(next);
    memory = raw;
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      /* stockage indisponible : la valeur vaut pour cette page seulement */
    }
    window.dispatchEvent(new Event(changeEvent));
  };

  const subscribe = (callback: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) callback();
    };
    window.addEventListener(changeEvent, callback);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(changeEvent, callback);
      window.removeEventListener('storage', onStorage);
    };
  };

  const getServerSnapshot = () => empty;
  const useValue = () => useSyncExternalStore(subscribe, read, getServerSnapshot);

  return { read, write, subscribe, useValue };
}
