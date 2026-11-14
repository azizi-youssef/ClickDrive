import type { StyleSpecification } from 'maplibre-gl';

/**
 * Configuration du fond de carte (MapLibre GL JS) — aucun fournisseur payant ni clé n'est codé en dur.
 *
 *   NEXT_PUBLIC_MAP_STYLE_URL      URL d'un style MapLibre/Mapbox GL JSON (fournisseur de votre choix, ou auto-hébergé)
 *   NEXT_PUBLIC_MAP_TILES_URL      OU gabarit de tuiles raster .../{z}/{x}/{y}.png
 *   NEXT_PUBLIC_MAP_ATTRIBUTION    attribution obligatoire de votre source de tuiles (avec NEXT_PUBLIC_MAP_TILES_URL)
 *   NEXT_PUBLIC_MAP_EXTRA_ORIGINS  origines supplémentaires du style (tuiles, glyphes, sprites), séparées par des virgules,
 *                                  ajoutées à la politique CSP (voir next.config.ts)
 *
 * Sans configuration : le développement utilise les tuiles OpenStreetMap (usage léger, attribution affichée) ;
 * la PRODUCTION n'affiche aucun fond de carte (les véhicules restent placés sur une grille neutre) tant qu'un
 * fournisseur n'est pas configuré : la politique d'usage des tuiles OpenStreetMap interdit un usage applicatif intensif.
 */

export interface MapConfig {
  /** Style à charger : URL ou objet de style */
  style: string | StyleSpecification;
  /** true : aucun fond de carte configuré (production) ou repli de développement */
  isFallback: boolean;
  /** true : aucun fond de carte (grille neutre) */
  blank: boolean;
  attribution: string | null;
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '© contributeurs OpenStreetMap';

export function rasterStyle(tiles: string, attribution: string | null): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: { type: 'raster', tiles: [tiles], tileSize: 256, maxzoom: 19, ...(attribution ? { attribution } : {}) },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#EEF1F5' } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
    ],
  };
}

export function blankStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#EEF1F5' } }],
  };
}

function isHttps(value: string): boolean {
  return /^https:\/\//i.test(value);
}

/** Lit la configuration (valeurs NEXT_PUBLIC_* inlinées au build ; `env` injectable pour les tests) */
export function resolveMapConfig(
  env: { style?: string; tiles?: string; attribution?: string; production?: boolean } = {
    style: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
    tiles: process.env.NEXT_PUBLIC_MAP_TILES_URL,
    attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
    production: process.env.NODE_ENV === 'production',
  }
): MapConfig {
  const style = env.style?.trim();
  const tiles = env.tiles?.trim();
  const attribution = env.attribution?.trim() || null;

  if (style && isHttps(style)) return { style, isFallback: false, blank: false, attribution: null };
  if (tiles && isHttps(tiles) && attribution) {
    return { style: rasterStyle(tiles, attribution), isFallback: false, blank: false, attribution };
  }
  if (!env.production) {
    return { style: rasterStyle(OSM_TILES, OSM_ATTRIBUTION), isFallback: true, blank: false, attribution: OSM_ATTRIBUTION };
  }
  return { style: blankStyle(), isFallback: true, blank: true, attribution: null };
}

/**
 * Worker MapLibre servi depuis la même origine (copié par scripts/copy-maplibre-worker.mjs avant dev/build) :
 * le bundler réécrit l'URL interne du worker et la carte échouerait avec « Worker failed to load ».
 */
export const MAP_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

/** Centre par défaut : Nador */
export const DEFAULT_CENTER: [number, number] = [-2.9335, 35.1688];
export const DEFAULT_ZOOM = 11;
