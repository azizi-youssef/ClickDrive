'use client';

import { useState } from 'react';
import Image from 'next/image';

export function AgencyBanner({
  name,
  bannerUrl,
  className = 'object-cover',
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: {
  name: string;
  bannerUrl?: string | null;
  className?: string;
  priority?: boolean;
  sizes?: string;
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
      fill
      priority={priority}
      sizes={sizes}
      className={className}
      onError={() => setFailedSource(src)}
    />
  );
}
