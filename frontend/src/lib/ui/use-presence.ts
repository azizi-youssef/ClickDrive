'use client';

import { useEffect, useState, type AnimationEvent } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Le navigateur peut-il jouer une animation de sortie ? (non : mouvement réduit, ou jsdom sans Web Animations) */
function canAnimateExit(): boolean {
  if (typeof window === 'undefined' || typeof Element === 'undefined') return false;
  if (typeof Element.prototype.getAnimations !== 'function') return false;
  return !window.matchMedia?.(REDUCED_MOTION).matches;
}

/**
 * Garde un élément monté le temps de son animation de sortie, sans bibliothèque.
 *
 *   const menu = usePresence(open);
 *   {menu.mounted && (
 *     <div inert={menu.closing} onAnimationEnd={menu.onAnimationEnd}
 *          className={menu.closing ? 'animate-cd-dropdown-out' : 'animate-cd-dropdown'} />
 *   )}
 *
 * - `closing` : la sortie est en cours. L'élément doit alors être `inert` (ni clic ni focus).
 * - `onAnimationEnd` : à placer sur l'élément dont la sortie est la plus longue ; il démonte à la fin.
 * - Sans animation possible (mouvement réduit, tests jsdom), le démontage est immédiat, comme avant.
 * - Filet de sécurité : démontage forcé après `fallbackMs` (élément masqué en CSS, animation absente).
 */
export function usePresence(open: boolean, { fallbackMs = 400 }: { fallbackMs?: number } = {}) {
  const [rendered, setRendered] = useState(open);

  // État dérivé de la prop, ajusté pendant le rendu (pas d'effet, pas de rendu intermédiaire)
  if (open && !rendered) setRendered(true);
  if (!open && rendered && !canAnimateExit()) setRendered(false);

  const closing = !open && rendered;

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setRendered(false), fallbackMs);
    return () => window.clearTimeout(timer);
  }, [closing, fallbackMs]);

  const onAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    // Les animations des descendants remontent aussi : seule celle de l'élément compte
    if (closing && event.target === event.currentTarget) setRendered(false);
  };

  return { mounted: open || rendered, closing, onAnimationEnd };
}
