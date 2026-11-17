/**
 * Jetons de mouvement pour Framer Motion (secondes, courbes en tableaux).
 * Miroir exact des jetons CSS de src/app/globals.css (§ 4. Mouvement) : modifier les deux ensemble.
 * Le CSS reste la règle pour tout ce qui peut s'animer sans JavaScript.
 */

/** Échelle de durées : 120, 180, 240, 350, 500 et 650 ms. */
export const DURATION = {
  instant: 0.12,
  fast: 0.18,
  base: 0.24,
  slow: 0.35,
  slower: 0.5,
  slowest: 0.65,
} as const;

/** Courbes : entrée (décélère), panneaux, sortie (accélère). */
export const EASE = {
  standard: [0.16, 1, 0.3, 1],
  sheet: [0.32, 0.72, 0, 1],
  exit: [0.4, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Distances d'entrée, en pixels. */
export const DISTANCE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
} as const;
