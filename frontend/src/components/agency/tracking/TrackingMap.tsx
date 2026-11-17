'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import { MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { boundsOf, circlePolygon } from '@/lib/tracking/geo.utils';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_WORKER_URL, resolveMapConfig, type MapConfig } from '@/lib/tracking/map-config';
import type { GeoPoint, TrackingState } from '@/lib/tracking/types';
import { STATE_STYLES } from './VehicleStatusBadge';

export interface MapVehicle {
  id: string;
  label: string;
  state: TrackingState;
  latitude: number;
  longitude: number;
  heading: number | null;
  moving: boolean;
}

export interface MapGeofence {
  id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_m: number;
  enabled: boolean;
}

export interface TrackingMapProps {
  vehicles?: readonly MapVehicle[];
  selectedId?: string | null;
  onSelect?: (vehicleId: string) => void;
  geofences?: readonly MapGeofence[];
  /** Tracé [longitude, latitude][] d'un trajet */
  route?: readonly [number, number][] | null;
  /** Mode sélection d'un point (éditeur de zone) : cercle d'aperçu + clic pour placer le centre */
  pick?: { center: GeoPoint | null; radius_m: number } | null;
  onPick?: (point: GeoPoint) => void;
  /** Le cadrage est recalculé uniquement quand cette clé change (jamais à chaque position reçue) */
  fitKey?: string | number;
  className?: string;
  ariaLabel?: string;
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const STATE_COLOR_EXPRESSION = [
  'match',
  ['get', 'state'],
  ...(Object.entries(STATE_STYLES) as [TrackingState, (typeof STATE_STYLES)[TrackingState]][]).flatMap(([state, style]) => [state, style.map]),
  '#94A3B8',
] as unknown as import('maplibre-gl').ExpressionSpecification;

function arrowImage(): ImageData | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(20, 1); // pointe (nord)
  ctx.lineTo(31, 22);
  ctx.lineTo(9, 22);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, 40, 40);
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function TrackingMap({ vehicles = [], selectedId = null, onSelect, geofences = [], route = null, pick = null, onPick, fitKey, className, ariaLabel = 'Carte de la flotte' }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacks = useRef({ onSelect, onPick, pick });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [config, setConfig] = useState<MapConfig | null>(null);

  useEffect(() => {
    callbacks.current = { onSelect, onPick, pick };
  });

  // ---- Données dérivées : recalculées seulement quand leurs entrées changent ----
  const vehiclesData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: vehicles.map((v) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
        properties: { id: v.id, label: v.label, state: v.state, heading: v.heading ?? 0, hasHeading: v.moving && v.heading !== null },
      })),
    }),
    [vehicles]
  );

  const geofenceData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: geofences.map((g) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circlePolygon({ latitude: g.center_latitude, longitude: g.center_longitude }, g.radius_m)] },
        properties: { id: g.id, name: g.name, enabled: g.enabled },
      })),
    }),
    [geofences]
  );

  const routeData = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!route || route.length < 2) return EMPTY;
    return {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: route.map((p) => [p[0], p[1]]) }, properties: {} },
        { type: 'Feature', geometry: { type: 'Point', coordinates: route[0]! }, properties: { kind: 'start' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: route[route.length - 1]! }, properties: { kind: 'end' } },
      ],
    };
  }, [route]);

  const pickCenter = pick?.center ?? null;
  const pickRadius = pick?.radius_m ?? 0;
  const pickData = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!pickCenter) return EMPTY;
    return {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [circlePolygon(pickCenter, pickRadius)] }, properties: { kind: 'zone' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [pickCenter.longitude, pickCenter.latitude] }, properties: { kind: 'center' } },
      ],
    };
  }, [pickCenter, pickRadius]);

  // ---- Création de la carte (une seule fois) ----
  useEffect(() => {
    let cancelled = false;
    const resolved = resolveMapConfig();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la configuration dépend de variables inlinées côté navigateur
    setConfig(resolved);

    void import('maplibre-gl')
      .then((maplibre) => {
        if (cancelled || !containerRef.current) return;
        // Le worker est hébergé sur la même origine (voir map-config.ts) ; idempotent entre deux cartes
        if (maplibre.getWorkerUrl() !== MAP_WORKER_URL) maplibre.setWorkerUrl(MAP_WORKER_URL);
        const map = new maplibre.Map({
          container: containerRef.current,
          style: resolved.style as string | StyleSpecification,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibre.ScaleControl({ unit: 'metric' }), 'bottom-left');

        // Les couches sont ajoutées dès que le STYLE est chargé (et non après les tuiles) : les véhicules s'affichent
        // même si le fond de carte est lent ou indisponible. `load` sert de repli ; l'initialisation n'a lieu qu'une fois.
        let initialized = false;
        const initialize = () => {
          if (initialized) return;
          initialized = true;
          const arrow = arrowImage();
          if (arrow) map.addImage('arrow', arrow, { sdf: true });

          map.addSource('geofences', { type: 'geojson', data: EMPTY });
          map.addLayer({ id: 'geofence-fill', type: 'fill', source: 'geofences', paint: { 'fill-color': ['case', ['get', 'enabled'], '#0284C7', '#94A3B8'], 'fill-opacity': 0.12 } });
          map.addLayer({ id: 'geofence-line', type: 'line', source: 'geofences', paint: { 'line-color': ['case', ['get', 'enabled'], '#0369A1', '#64748B'], 'line-width': 2, 'line-dasharray': [2, 2] } });

          map.addSource('pick', { type: 'geojson', data: EMPTY });
          map.addLayer({ id: 'pick-fill', type: 'fill', source: 'pick', filter: ['==', ['get', 'kind'], 'zone'], paint: { 'fill-color': '#E63946', 'fill-opacity': 0.15 } });
          map.addLayer({ id: 'pick-line', type: 'line', source: 'pick', filter: ['==', ['get', 'kind'], 'zone'], paint: { 'line-color': '#E63946', 'line-width': 2 } });
          map.addLayer({ id: 'pick-center', type: 'circle', source: 'pick', filter: ['==', ['get', 'kind'], 'center'], paint: { 'circle-radius': 6, 'circle-color': '#E63946', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });

          map.addSource('route', { type: 'geojson', data: EMPTY });
          map.addLayer({ id: 'route-casing', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 8 } });
          map.addLayer({ id: 'route-line', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0B1220', 'line-width': 4 } });
          map.addLayer({ id: 'route-ends', type: 'circle', source: 'route', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 7, 'circle-color': ['match', ['get', 'kind'], 'start', '#059669', '#E63946'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });

          map.addSource('vehicles', { type: 'geojson', data: EMPTY });
          if (arrow) {
            map.addLayer({ id: 'vehicles-heading', type: 'symbol', source: 'vehicles', filter: ['==', ['get', 'hasHeading'], true], layout: { 'icon-image': 'arrow', 'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-size': 0.8 }, paint: { 'icon-color': STATE_COLOR_EXPRESSION } });
          }
          map.addLayer({ id: 'vehicles-circle', type: 'circle', source: 'vehicles', paint: { 'circle-radius': 8, 'circle-color': STATE_COLOR_EXPRESSION, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 } });
          map.addLayer({ id: 'vehicles-selected', type: 'circle', source: 'vehicles', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': 15, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#E63946', 'circle-stroke-width': 3 } });

          map.on('click', 'vehicles-circle', (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') callbacks.current.onSelect?.(id);
          });
          map.on('mouseenter', 'vehicles-circle', () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', 'vehicles-circle', () => (map.getCanvas().style.cursor = callbacks.current.pick ? 'crosshair' : ''));
          map.on('click', (event) => {
            if (!callbacks.current.pick || !callbacks.current.onPick) return;
            callbacks.current.onPick({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
          });
          if (callbacks.current.pick) map.getCanvas().style.cursor = 'crosshair';
          setReady(true);
        };
        map.on('style.load', initialize);
        map.on('load', initialize);
        map.on('error', (event) => {
          // Tuile ou style indisponible : la carte reste utilisable (marqueurs) ; l'erreur n'est pas bloquante
          console.warn('[TrackingMap]', event.error?.message ?? 'erreur de carte');
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // ---- Synchronisation des sources ----
  const setSource = (id: string, data: GeoJSON.FeatureCollection) => {
    (mapRef.current?.getSource(id) as GeoJSONSource | undefined)?.setData(data);
  };
  useEffect(() => {
    if (ready) setSource('vehicles', vehiclesData);
  }, [ready, vehiclesData]);
  useEffect(() => {
    if (ready) setSource('geofences', geofenceData);
  }, [ready, geofenceData]);
  useEffect(() => {
    if (ready) setSource('route', routeData);
  }, [ready, routeData]);
  useEffect(() => {
    if (!ready) return;
    setSource('pick', pickData);
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = pick ? 'crosshair' : '';
  }, [ready, pickData, pick]);

  useEffect(() => {
    if (ready) mapRef.current?.setFilter('vehicles-selected', ['==', ['get', 'id'], selectedId ?? '']);
  }, [ready, selectedId]);

  // Sélection : la carte se centre sur le véhicule (zoom conservé s'il est déjà proche)
  useEffect(() => {
    if (!ready || !selectedId) return;
    const target = vehicles.find((v) => v.id === selectedId);
    const map = mapRef.current;
    if (!target || !map) return;
    map.easeTo({ center: [target.longitude, target.latitude], zoom: Math.max(map.getZoom(), 14), duration: reducedMotion() ? 0 : 500 });
    // Recentrage à la sélection uniquement, pas à chaque position reçue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId]);

  // Cadrage : au premier affichage et quand la clé change
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const points: GeoPoint[] = route && route.length > 1
      ? route.map((p) => ({ longitude: p[0], latitude: p[1] }))
      : vehicles.map((v) => ({ latitude: v.latitude, longitude: v.longitude }));
    const bounds = boundsOf(points);
    if (!bounds) return;
    const duration = reducedMotion() ? 0 : 600;
    if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
      map.easeTo({ center: bounds[0], zoom: 15, duration });
    } else {
      map.fitBounds(bounds, { padding: 64, maxZoom: 16, duration });
    }
    // Le cadrage ne suit pas les positions : seulement la clé fournie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey, route]);

  return (
    <div className={cn('relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-[#EEF1F5]', className)}>
      {/* Le CSS de MapLibre impose `position: relative` à son conteneur : il doit remplir un parent absolu, pas l'être lui-même */}
      <div className="absolute inset-0">
        <div ref={containerRef} role="region" aria-label={ariaLabel} className="h-full w-full" />
      </div>
      {failed && (
        <div role="status" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-50/95 p-6 text-center">
          <MapPinOff aria-hidden="true" className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-ink">La carte ne peut pas s’afficher</p>
          <p className="max-w-xs text-sm text-ink-secondary">Votre navigateur ne permet pas l’affichage de la carte (WebGL). La liste des véhicules reste disponible.</p>
        </div>
      )}
      {!failed && !ready && (
        <div aria-hidden="true" className="absolute inset-0 z-10 flex animate-pulse items-center justify-center bg-slate-100">
          <span className="text-sm text-slate-400">Chargement de la carte…</span>
        </div>
      )}
      {config?.blank && (
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[18rem] rounded-lg bg-white/90 px-2.5 py-1.5 text-xs text-slate-600 shadow">
          Aucun fond de carte configuré : les véhicules sont placés sur une grille neutre.
        </p>
      )}
      {config?.isFallback && !config.blank && (
        <p className="pointer-events-none absolute bottom-2 left-24 z-10 rounded-lg bg-amber-50/95 px-2.5 py-1 text-[11px] text-amber-900 shadow">
          Fond de développement
        </p>
      )}
    </div>
  );
}
