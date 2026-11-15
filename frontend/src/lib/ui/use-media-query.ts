'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Petit écran (sous le point de rupture `sm` de Tailwind, 640 px) */
export const SMALL_SCREEN_QUERY = '(max-width: 639px)';

/**
 * Vrai quand la requête média correspond. Rendu serveur et hydratation : `false` (mise en page large),
 * puis la valeur réelle ; suit les changements (rotation, redimensionnement).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', callback);
      return () => list.removeEventListener('change', callback);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false
  );
}
