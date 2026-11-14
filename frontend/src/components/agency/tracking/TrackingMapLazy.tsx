'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

/**
 * La carte (MapLibre GL, ≈ 800 Ko) n'est chargée que sur les écrans de suivi, jamais dans le bundle commun,
 * et uniquement côté navigateur (WebGL).
 */
export const TrackingMapLazy = dynamic(() => import('./TrackingMap').then((module) => module.TrackingMap), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className={cn('relative animate-pulse rounded-2xl border border-slate-200 bg-slate-100')}>
      <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Chargement de la carte…</span>
    </div>
  ),
});
