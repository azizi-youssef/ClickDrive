import { describe, expect, it } from 'vitest';
import { BANNER_SPEC, computeArtFit, computeLogoFit, LOGO_MAX_EXTENT, LOGO_TARGET_AREA } from './logo-fit';

type Rgba = [number, number, number, number];

/** Image w×h remplie de `bg`, avec un rectangle `fg` (x, y, largeur, hauteur) */
function image(w: number, h: number, bg: Rgba, rect?: { x: number; y: number; w: number; h: number; fg: Rgba }) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      data.set(inside ? rect.fg : bg, (y * w + x) * 4);
    }
  }
  return data;
}

/** Taille et centre du dessin dans le cadre (en part du cadre), d'après le résultat */
function drawing(fit: NonNullable<ReturnType<typeof computeLogoFit>>, box: { x: number; y: number; w: number; h: number }, w: number, h: number) {
  const width = (fit.width / 100) * (box.w / w);
  const height = (fit.height / 100) * (box.h / h);
  const centerX = fit.left / 100 + (fit.width / 100) * ((box.x + box.w / 2) / w);
  const centerY = fit.top / 100 + (fit.height / 100) * ((box.y + box.h / 2) / h);
  return { width, height, centerX, centerY };
}

describe('computeLogoFit — taille uniforme des logos', () => {
  it('fond noir avec marges (type Krinicar) : fond reporté au cadre, marges ignorées, dessin centré', () => {
    const box = { x: 25, y: 30, w: 50, h: 40 };
    const fit = computeLogoFit(image(100, 100, [0, 0, 0, 255], { ...box, fg: [212, 175, 55, 255] }), 100, 100)!;
    expect(fit.background).toBe('rgb(0 0 0)');
    const d = drawing(fit, box, 100, 100);
    // Aire visée, proportions conservées
    expect(d.width * d.height).toBeCloseTo(LOGO_TARGET_AREA, 2);
    expect(d.width / d.height).toBeCloseTo(50 / 40, 1);
    expect(d.centerX).toBeCloseTo(0.5, 2);
    expect(d.centerY).toBeCloseTo(0.5, 2);
  });

  it('mot-logo très large sur fond transparent (type OROKAY) : largeur plafonnée, cadre blanc', () => {
    const box = { x: 10, y: 40, w: 280, h: 20 };
    const fit = computeLogoFit(image(300, 100, [255, 255, 255, 0], { ...box, fg: [0, 51, 153, 255] }), 300, 100)!;
    expect(fit.background).toBeNull();
    const d = drawing(fit, box, 300, 100);
    expect(d.width).toBeCloseTo(LOGO_MAX_EXTENT, 2);
    expect(d.centerX).toBeCloseTo(0.5, 2);
    expect(d.centerY).toBeCloseTo(0.5, 2);
  });

  it('deux logos de formats différents (sous le plafond) occupent la même aire visuelle', () => {
    const square = { x: 20, y: 20, w: 60, h: 60 };
    const wide = { x: 15, y: 25, w: 120, h: 80 }; // 3:2 avec marges
    const a = drawing(computeLogoFit(image(100, 100, [21, 21, 21, 255], { ...square, fg: [255, 255, 255, 255] }), 100, 100)!, square, 100, 100);
    const b = drawing(computeLogoFit(image(150, 135, [21, 21, 21, 255], { ...wide, fg: [255, 255, 255, 255] }), 150, 135)!, wide, 150, 135);
    expect(a.width * a.height).toBeCloseTo(b.width * b.height, 2);
  });

  it('bannière 12:5 : mot-logo et blason entiers, même aire, centrés au-dessus du logo', () => {
    // Coordonnées du dessin en part du cadre (largeur, hauteur séparément)
    const inFrame = (fit: NonNullable<ReturnType<typeof computeArtFit>>, box: { x: number; y: number; w: number; h: number }, w: number, h: number) => ({
      width: (fit.width / 100) * (box.w / w),
      height: (fit.height / 100) * (box.h / h),
      centerX: fit.left / 100 + (fit.width / 100) * ((box.x + box.w / 2) / w),
      centerY: fit.top / 100 + (fit.height / 100) * ((box.y + box.h / 2) / h),
    });
    const wordmark = { x: 4, y: 8, w: 292, h: 82 }; // ≈ 3,5:1 (OROKAY)
    const crest = { x: 32, y: 54, w: 236, h: 205 }; // ≈ 1,15:1 (Krinicar)
    const a = computeArtFit(image(300, 100, [255, 255, 255, 255], { ...wordmark, fg: [0, 51, 153, 255] }), 300, 100, BANNER_SPEC)!;
    const b = computeArtFit(image(300, 300, [0, 0, 0, 255], { ...crest, fg: [212, 175, 55, 255] }), 300, 300, BANNER_SPEC)!;
    expect(a.background).toBe('rgb(255 255 255)');
    expect(b.background).toBe('rgb(0 0 0)');
    const wa = inFrame(a, wordmark, 300, 100);
    const wb = inFrame(b, crest, 300, 300);
    for (const d of [wa, wb]) {
      // Jamais coupé : dessin dans les limites du gabarit, centré horizontalement, au-dessus du milieu
      expect(d.width).toBeLessThanOrEqual(BANNER_SPEC.maxWidth + 0.001);
      expect(d.height).toBeLessThanOrEqual(BANNER_SPEC.maxHeight + 0.001);
      expect(d.centerX).toBeCloseTo(0.5, 2);
      expect(d.centerY).toBeCloseTo(BANNER_SPEC.centerY, 2);
    }
    // Aire égale (en px du cadre) tant que le plafond n'est pas atteint
    expect(wa.width * wa.height).toBeCloseTo(BANNER_SPEC.targetArea, 2);
  });

  it('fond non uniforme (coins de couleurs différentes) : pas de cadrage, logo affiché entier', () => {
    const data = image(50, 50, [255, 255, 255, 255]);
    data.set([200, 0, 0, 255], (49 * 50 + 49) * 4); // coin bas droit rouge
    expect(computeLogoFit(data, 50, 50)).toBeNull();
  });

  it('fichier uni ou trop petit : null', () => {
    expect(computeLogoFit(image(20, 20, [0, 0, 0, 255]), 20, 20)).toBeNull();
    expect(computeLogoFit(new Uint8ClampedArray(4), 1, 1)).toBeNull();
  });
});
