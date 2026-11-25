'use client';

import { useState, type CSSProperties } from 'react';
import { AgencyLogo } from '@/components/agencies/AgencyLogo';
import { LOGO_SPEC, cachedArtFit, fitImageStyle, measureArt, type ArtFit, type FitSpec } from '@/components/agencies/logo-fit';
import { cn } from '@/lib/utils';

/**
 * Cadrage uniforme d'un visuel (voir logo-fit.ts) : le cadre prend la couleur de fond du fichier, les
 * marges propres au fichier sont ignorées et chaque dessin occupe la même aire visuelle, sans être coupé.
 * Tant que la mesure n'est pas faite, l'image reste invisible (pas de saut de taille) ; si elle échoue
 * (photo, fond non uniforme), l'appelant garde un affichage de repli.
 */
export function useArtFit(key: string, spec: FitSpec) {
  // undefined = mesure en attente ; null = mesure impossible
  const [measured, setMeasured] = useState<{ key: string; fit: ArtFit | null } | null>(null);
  const fit = measured?.key === key ? measured.fit : cachedArtFit(key, spec);
  const onLoad = (img: HTMLImageElement) => setMeasured({ key, fit: measureArt(img, key, spec) });
  const frameStyle: CSSProperties | undefined = fit?.background ? { backgroundColor: fit.background } : undefined;
  return { fit, onLoad, frameStyle };
}

/** Image en plein cadre : équivalent de `fill` + object-cover */
export const COVER_STYLE: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

/**
 * Logo d'agence à taille uniforme, remplissant son conteneur carré (cartes, tableaux de bord).
 * Le conteneur fixe la taille, l'arrondi et la bordure ; ce composant prolonge le fond du fichier et
 * centre le dessin à aire égale.
 * - fallback « contain » : logo non cadrable affiché entier (logos) ;
 * - fallback « cover » : image non cadrable en plein cadre (avatar photo d'un compte, par exemple).
 */
export function AgencyLogoMark({
  slug,
  name,
  logoUrl,
  size,
  fallback = 'contain',
  className,
}: {
  slug: string;
  name: string;
  logoUrl?: string | null;
  /** Côté affiché en px (choix de la résolution servie) */
  size: number;
  fallback?: 'contain' | 'cover';
  className?: string;
}) {
  const art = useArtFit(logoUrl?.trim() || `slug:${slug}`, LOGO_SPEC);
  const fallbackClass = fallback === 'cover' ? 'h-full w-full object-cover' : 'h-full w-full object-contain';
  return (
    <div className={cn('relative h-full w-full overflow-hidden transition-[background-color] duration-fast', className)} style={art.frameStyle}>
      <AgencyLogo
        slug={slug}
        name={name}
        logoUrl={logoUrl}
        className={art.fit ? 'block' : `${fallbackClass} transition-opacity duration-fast`}
        style={art.fit ? fitImageStyle(art.fit) : art.fit === undefined ? { opacity: 0 } : undefined}
        onLoad={art.onLoad}
        size={size}
      />
    </div>
  );
}
