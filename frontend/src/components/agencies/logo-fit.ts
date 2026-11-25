import type { CSSProperties } from 'react';

/** Image lisible par un canevas : même site, ou stockage public Supabase (en-tête CORS « * ») */
export function isCorsReadable(src: string): boolean {
  if (src.startsWith('/')) return true;
  try {
    const url = new URL(src);
    return url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/public/');
  } catch {
    return false;
  }
}

/**
 * Taille uniforme des visuels d'agence (logo carré, bannière 12:5).
 *
 * Les fichiers fournis par les agences n'ont ni le même format (carré, 3:2, 3:1…) ni les mêmes marges
 * (Krinicar : 25 % de fond noir autour du dessin ; OROKAY : mot-logo sans marge). Ajustés tels quels,
 * certains remplissent le cadre, d'autres n'en occupent qu'une bande (object-contain) ou sont coupés
 * (object-cover : « OROKA » sans son Y, blason de Krinicar décapité dans la bannière).
 *
 * On mesure donc le fichier une fois chargé :
 *  - couleur de fond (4 coins identiques, ou transparents) → appliquée au cadre : plus de bandes ;
 *  - boîte englobante du dessin (pixels qui diffèrent du fond) → marges propres au fichier ignorées ;
 *  - dessin dimensionné à aire visuelle égale (règle des murs de logos), plafonné au cadre, jamais coupé.
 * Fond non uniforme (photo, dégradé) ou fichier illisible : null → affichage d'origine du composant.
 */

export interface ArtFit {
  /** Couleur de fond du fichier, appliquée au cadre ; null = fond transparent */
  background: string | null;
  /** Position et taille de l'image, en % de la largeur (left, width) et de la hauteur (top, height) du cadre */
  left: number;
  top: number;
  width: number;
  height: number;
}
export type LogoFit = ArtFit;

export interface FitSpec {
  /** Nom du gabarit (clé du cache) */
  name: string;
  /** Proportions du cadre (largeur / hauteur) */
  frameRatio: number;
  /** Aire visée pour le dessin, en part de l'aire du cadre */
  targetArea: number;
  /** Largeur et hauteur maximales du dessin, en part du cadre */
  maxWidth: number;
  maxHeight: number;
  /** Centre vertical du dessin dans le cadre (0,5 = milieu) */
  centerY: number;
}

/** Logo : cadre carré, dessin d'aire égale à un carré de 68 %, au plus 92 % du cadre */
export const LOGO_SPEC: FitSpec = { name: 'logo', frameRatio: 1, targetArea: 0.68 ** 2, maxWidth: 0.92, maxHeight: 0.92, centerY: 0.5 };
/**
 * Bannière 12:5 : dessin d'aire égale, au plus 80 % × 70 % du cadre, centré un peu au-dessus du milieu
 * pour rester dégagé du logo qui chevauche le bas de la bannière.
 */
export const BANNER_SPEC: FitSpec = { name: 'banner', frameRatio: 12 / 5, targetArea: 0.3, maxWidth: 0.8, maxHeight: 0.7, centerY: 0.45 };

/** Compatibilité : valeurs du gabarit logo */
export const LOGO_TARGET_AREA = LOGO_SPEC.targetArea;
export const LOGO_MAX_EXTENT = LOGO_SPEC.maxWidth;

/** Pixel transparent (alpha) */
const ALPHA_EMPTY = 16;
/** Écart de couleur (somme R+V+B) toléré pour le fond — absorbe le bruit de compression JPEG */
const COLOR_TOLERANCE = 48;

export function computeArtFit(rgba: ArrayLike<number>, width: number, height: number, spec: FitSpec): ArtFit | null {
  if (width < 2 || height < 2 || rgba.length < width * height * 4) return null;

  const at = (x: number, y: number) => (y * width + x) * 4;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const transparent = corners.every((i) => rgba[i + 3] < ALPHA_EMPTY);

  let bg: [number, number, number] | null = null;
  if (!transparent) {
    // Coins semi-transparents ou de couleurs différentes : pas de fond uniforme à prolonger
    if (corners.some((i) => rgba[i + 3] < 250)) return null;
    const mean = [0, 1, 2].map((c) => Math.round(corners.reduce((sum, i) => sum + rgba[i + c], 0) / 4));
    const differs = (i: number) =>
      Math.abs(rgba[i] - mean[0]) + Math.abs(rgba[i + 1] - mean[1]) + Math.abs(rgba[i + 2] - mean[2]) > COLOR_TOLERANCE;
    if (corners.some(differs)) return null;
    bg = [mean[0], mean[1], mean[2]];
  }

  // Boîte englobante du dessin
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      const alpha = rgba[i + 3];
      const content = bg
        ? alpha >= ALPHA_EMPTY &&
          Math.abs(rgba[i] - bg[0]) + Math.abs(rgba[i + 1] - bg[1]) + Math.abs(rgba[i + 2] - bg[2]) > COLOR_TOLERANCE
        : alpha >= ALPHA_EMPTY;
      if (content) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null; // fichier uni : rien à cadrer

  // Boîte du dessin en part de l'image, et ses proportions réelles (pixels)
  const boxX = x0 / width;
  const boxY = y0 / height;
  const boxW = (x1 - x0 + 1) / width;
  const boxH = (y1 - y0 + 1) / height;
  const ratio = (x1 - x0 + 1) / (y1 - y0 + 1);

  // Dessin en part du cadre : drawW / drawH = ratio / frameRatio, aire drawW × drawH = targetArea
  const shape = ratio / spec.frameRatio;
  let drawW = Math.sqrt(spec.targetArea * shape);
  let drawH = drawW / shape;
  if (drawW > spec.maxWidth) {
    drawW = spec.maxWidth;
    drawH = drawW / shape;
  }
  if (drawH > spec.maxHeight) {
    drawH = spec.maxHeight;
    drawW = drawH * shape;
  }

  // Image entière mise à l'échelle pour que le dessin mesure drawW × drawH, centrée sur le dessin
  const imageW = drawW / boxW;
  const imageH = drawH / boxH;
  const round = (n: number) => Math.round(n * 1000) / 10; // % à 0,1 près
  return {
    background: bg ? `rgb(${bg[0]} ${bg[1]} ${bg[2]})` : null,
    left: round(0.5 - (boxX + boxW / 2) * imageW),
    top: round(spec.centerY - (boxY + boxH / 2) * imageH),
    width: round(imageW),
    height: round(imageH),
  };
}

export function computeLogoFit(rgba: ArrayLike<number>, width: number, height: number): LogoFit | null {
  return computeArtFit(rgba, width, height, LOGO_SPEC);
}

/** Résultats par gabarit et adresse d'image : un visuel déjà mesuré s'affiche cadré dès le premier rendu */
const fitCache = new Map<string, ArtFit | null>();

export function cachedArtFit(key: string, spec: FitSpec = LOGO_SPEC): ArtFit | null | undefined {
  return fitCache.get(`${spec.name}:${key}`);
}
export const cachedLogoFit = (key: string) => cachedArtFit(key, LOGO_SPEC);

/**
 * Mesure une image chargée (réduite à 128 px pour l'analyse). Image d'une autre origine sans CORS :
 * le canevas est « contaminé », la lecture échoue → null (affichage d'origine).
 */
export function measureArt(img: HTMLImageElement, key: string, spec: FitSpec = LOGO_SPEC): ArtFit | null {
  let fit: ArtFit | null = null;
  try {
    const scale = Math.min(1, 128 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(2, Math.round(img.naturalWidth * scale));
    const h = Math.max(2, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, w, h);
      fit = computeArtFit(ctx.getImageData(0, 0, w, h).data, w, h, spec);
    }
  } catch {
    fit = null;
  }
  fitCache.set(`${spec.name}:${key}`, fit);
  return fit;
}
export const measureLogo = (img: HTMLImageElement, key: string) => measureArt(img, key, LOGO_SPEC);

/**
 * Style d'image pour un cadrage calculé. right/bottom remis à auto : `fill` de next/image les fixe à 0,
 * et en arabe (rtl) un left + right + width surcontraint ferait ignorer left.
 */
export function fitImageStyle(fit: ArtFit): CSSProperties {
  return {
    position: 'absolute',
    left: `${fit.left}%`,
    top: `${fit.top}%`,
    right: 'auto',
    bottom: 'auto',
    width: `${fit.width}%`,
    height: `${fit.height}%`,
    maxWidth: 'none',
    objectFit: 'fill',
  };
}
