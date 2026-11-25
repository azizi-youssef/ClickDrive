'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { isCorsReadable } from '@/components/agencies/logo-fit';

export function AgencyBanner({
  name,
  bannerUrl,
  className = 'object-cover',
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  style,
  onLoad,
}: {
  name: string;
  bannerUrl?: string | null;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /**
   * Style en ligne de l'image (pas de la bannière de secours). Fourni, l'appelant gère tout le placement
   * (position, taille) : l'image n'est plus en mode `fill`, que next/image interdit de combiner avec
   * un style de position ou de taille.
   */
  style?: CSSProperties;
  /** Image chargée ; fournie, elle rend l'image lisible par un canevas quand son origine l'autorise (CORS) */
  onLoad?: (img: HTMLImageElement) => void;
}) {
  const storedBanner = bannerUrl?.trim() || '';
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = storedBanner && failedSource !== storedBanner ? storedBanner : null;

  if (!src) {
    return (
      <div
        aria-label={`Bannière indisponible pour ${name}`}
        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink via-ink to-ink"
      >
        <span className="select-none text-3xl font-extrabold tracking-tight text-white/90">
          {name.trim().charAt(0).toLocaleUpperCase('fr-FR') || '?'}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={`Bannière ${name}`}
      // Dimensions intrinsèques indicatives (12:5) : la taille réelle vient du style de l'appelant
      {...(style ? { width: 1200, height: 500 } : { fill: true })}
      priority={priority}
      sizes={sizes}
      className={className}
      style={style}
      crossOrigin={onLoad && isCorsReadable(src) ? 'anonymous' : undefined}
      onLoad={onLoad ? (event) => onLoad(event.currentTarget) : undefined}
      onError={() => setFailedSource(src)}
    />
  );
}
