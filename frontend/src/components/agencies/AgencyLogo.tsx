'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { AGENCY_LOGO_ASSETS } from '@/lib/constants/agency-logo-assets';
import { isOptimizableImage } from '@/lib/utils/images';
import { isCorsReadable } from '@/components/agencies/logo-fit';

export function AgencyLogo({
  slug,
  name,
  logoUrl,
  className,
  size = 96,
  style,
  onLoad,
}: {
  slug: string;
  name: string;
  logoUrl?: string | null;
  className: string;
  /** Style en ligne de l'image (pas du logo de secours) — cadrage calculé par l'appelant */
  style?: CSSProperties;
  /**
   * Image chargée. Fournie, elle rend l'image lisible par un canevas (CORS) quand son origine
   * l'autorise : même site, ou stockage public Supabase (Access-Control-Allow-Origin: *).
   */
  onLoad?: (img: HTMLImageElement) => void;
  /**
   * Côté affiché en pixels CSS. Le logo d'origine (souvent plusieurs centaines de pixels) est servi
   * redimensionné et en AVIF/WebP par l'optimiseur Next, au lieu d'être téléchargé tel quel.
   */
  size?: number;
}) {
  const storedLogo = logoUrl?.trim() || '';
  const bundledLogo = AGENCY_LOGO_ASSETS[slug]?.publicPath;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Optimiseur indisponible (délai dépassé au premier redimensionnement d'un gros fichier…) :
  // on retente l'image d'origine avant de passer au logo de secours
  const [rawSource, setRawSource] = useState<string | null>(null);
  const src =
    storedLogo && failedSource !== storedLogo
      ? storedLogo
      : bundledLogo && failedSource !== bundledLogo
        ? bundledLogo
        : null;
  const optimized = src !== null && rawSource !== src && isOptimizableImage(src);

  if (!src) {
    return (
      <span
        aria-label={`Logo indisponible pour ${name}`}
        className={`flex h-full w-full items-center justify-center bg-ink text-lg font-bold text-white ${className}`}
      >
        {name.trim().charAt(0).toLocaleUpperCase('fr-FR') || '?'}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={`Logo ${name}`}
      width={size}
      height={size}
      // Logos souvent larges (3:1) recadrés en carré (object-cover) : la hauteur fixe l'échelle,
      // d'où une marge ×3 sur la largeur demandée pour rester net (toujours quelques Ko au lieu du fichier d'origine)
      sizes={`${size * 3}px`}
      className={className}
      style={style}
      // Uniquement pour les origines qui répondent en CORS : ailleurs, « anonymous » ferait échouer le chargement
      crossOrigin={onLoad && isCorsReadable(src) ? 'anonymous' : undefined}
      onLoad={onLoad ? (event) => onLoad(event.currentTarget) : undefined}
      // Hôtes non déclarés dans next.config (remotePatterns) : servis tels quels
      unoptimized={!optimized}
      onError={() => (optimized ? setRawSource(src) : setFailedSource(src))}
    />
  );
}
