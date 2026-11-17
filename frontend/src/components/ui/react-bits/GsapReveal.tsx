import React from 'react';
import { cn } from '@/lib/utils';

interface GsapRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Délai avant la première apparition, en secondes */
  delay?: number;
  /** Durée, en secondes (défaut : jeton duration-slowest, 650 ms) */
  duration?: number;
  /** Distance de glissement, en pixels (défaut : jeton --motion-distance-lg, 24 px) */
  yOffset?: number;
  /** Apparition des enfants en cascade : `true` = jeton --motion-stagger (60 ms), ou un pas en secondes */
  stagger?: boolean | number;
}

/**
 * Révélation d'entrée (fondu + léger glissement), en CSS pur.
 * Remplace l'ancienne version GSAP : aucun JavaScript, pas d'hydratation nécessaire,
 * et désactivée si l'utilisateur demande à réduire les animations (voir .cd-reveal dans globals.css).
 * Sans réglage explicite, les valeurs viennent des jetons de mouvement de globals.css.
 * Le nom est conservé pour ne pas changer l'API des pages qui l'utilisent.
 */
export function GsapReveal({ children, className = '', delay, duration, yOffset, stagger = false }: GsapRevealProps) {
  const style: Record<string, string> = {};
  if (delay !== undefined) style['--cd-reveal-delay'] = `${delay}s`;
  if (duration !== undefined) style['--cd-reveal-duration'] = `${duration}s`;
  if (yOffset !== undefined) style['--cd-reveal-y'] = `${yOffset}px`;
  if (typeof stagger === 'number' && stagger > 0) style['--cd-reveal-stagger'] = `${stagger}s`;

  return (
    <div
      className={cn(stagger ? 'cd-reveal-stagger' : 'cd-reveal', className)}
      style={Object.keys(style).length > 0 ? (style as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

export { GsapReveal as Reveal };
