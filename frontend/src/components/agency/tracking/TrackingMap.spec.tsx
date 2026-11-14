// @vitest-environment jsdom
import '@/tests/setup/dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveMapConfig } from '@/lib/tracking/map-config';

type Handler = (event?: unknown) => void;

const maplibre = vi.hoisted(() => {
  class FakeMap {
    static instances: FakeMap[] = [];
    static failConstruction = false;
    handlers: Record<string, Handler[]> = {};
    layerHandlers: Record<string, Handler[]> = {};
    sources: Record<string, { data: unknown; setData: (data: unknown) => void }> = {};
    layers: { id: string }[] = [];
    filters: Record<string, unknown> = {};
    canvas = { style: { cursor: '' } as Record<string, string> };
    options: Record<string, unknown>;
    removed = false;
    easeTo = vi.fn();
    fitBounds = vi.fn();
    constructor(options: Record<string, unknown>) {
      if (FakeMap.failConstruction) throw new Error('WebGL non disponible');
      this.options = options;
      FakeMap.instances.push(this);
    }
    on(event: string, a: string | Handler, b?: Handler) {
      if (typeof a === 'string' && b) (this.layerHandlers[`${event}:${a}`] ??= []).push(b);
      else (this.handlers[event] ??= []).push(a as Handler);
    }
    fire(event: string, payload?: unknown) {
      (this.handlers[event] ?? []).forEach((h) => h(payload));
    }
    fireLayer(event: string, layer: string, payload?: unknown) {
      (this.layerHandlers[`${event}:${layer}`] ?? []).forEach((h) => h(payload));
    }
    addControl() {}
    addImage() {}
    addSource(id: string, spec: { data: unknown }) {
      const source = { data: spec.data, setData: vi.fn((data: unknown) => (source.data = data)) };
      this.sources[id] = source;
    }
    getSource(id: string) {
      return this.sources[id];
    }
    addLayer(layer: { id: string }) {
      this.layers.push(layer);
    }
    setFilter(id: string, filter: unknown) {
      this.filters[id] = filter;
    }
    getCanvas() {
      return this.canvas;
    }
    getZoom() {
      return 10;
    }
    remove() {
      this.removed = true;
    }
  }
  return { FakeMap };
});

const workerUrl = vi.hoisted(() => ({ current: '', set: vi.fn() }));

vi.mock('maplibre-gl', () => ({
  getWorkerUrl: () => workerUrl.current,
  setWorkerUrl: (value: string) => {
    workerUrl.current = value;
    workerUrl.set(value);
  },
  Map: maplibre.FakeMap,
  NavigationControl: class {},
  ScaleControl: class {},
}));

import { TrackingMap, type MapVehicle } from './TrackingMap';

const { FakeMap } = maplibre;
const last = () => FakeMap.instances[FakeMap.instances.length - 1]!;
const vehicles = (n = 2): MapVehicle[] =>
  Array.from({ length: n }, (_, i) => ({ id: `v${i + 1}`, label: `Véhicule ${i + 1}`, state: 'MOVING' as const, latitude: 35.1 + i * 0.01, longitude: -2.9, heading: 90, moving: true }));

async function mountAndLoad(ui: React.ReactElement) {
  const view = render(ui);
  await waitFor(() => expect(FakeMap.instances.length).toBeGreaterThan(0));
  await act(async () => last().fire('style.load'));
  return view;
}

beforeEach(() => {
  FakeMap.instances = [];
  FakeMap.failConstruction = false;
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('TrackingMap', () => {
  it('crée la carte une seule fois, ajoute les sources et couches (véhicules, zones, tracé, sélection) puis retire la carte au démontage', async () => {
    const { rerender, unmount } = await mountAndLoad(<TrackingMap vehicles={vehicles()} />);
    expect(FakeMap.instances).toHaveLength(1);
    // Worker hébergé sur la même origine (le bundler casserait l'URL interne de MapLibre)
    expect(workerUrl.set).toHaveBeenCalledWith('/maplibre/maplibre-gl-worker.mjs');
    const map = last();
    expect(Object.keys(map.sources).sort()).toEqual(['geofences', 'pick', 'route', 'vehicles']);
    expect(map.layers.map((l) => l.id)).toEqual(expect.arrayContaining(['vehicles-circle', 'vehicles-selected', 'geofence-fill', 'route-line']));
    rerender(<TrackingMap vehicles={vehicles(3)} />);
    expect(FakeMap.instances).toHaveLength(1); // jamais recréée à chaque mise à jour
    unmount();
    expect(map.removed).toBe(true);
  });

  it('les couches sont créées dès le chargement du style (sans attendre les tuiles) et une seule fois, même si « load » suit', async () => {
    await mountAndLoad(<TrackingMap vehicles={vehicles()} />);
    const map = last();
    const layerCount = map.layers.length;
    expect(layerCount).toBeGreaterThan(5);
    await act(async () => map.fire('load'));
    expect(map.layers).toHaveLength(layerCount);
  });

  it('mise à jour des positions : la source de données est remplacée, sans recréer la carte', async () => {
    const { rerender } = await mountAndLoad(<TrackingMap vehicles={vehicles(2)} />);
    const source = last().sources.vehicles!;
    const count = () => ((source.data as GeoJSON.FeatureCollection).features.length);
    await waitFor(() => expect(count()).toBe(2));
    const moved = vehicles(2).map((v) => ({ ...v, latitude: v.latitude + 0.5 }));
    rerender(<TrackingMap vehicles={moved} />);
    await waitFor(() => expect((source.data as GeoJSON.FeatureCollection).features[0]!.geometry).toMatchObject({ coordinates: [-2.9, 35.6] }));
    rerender(<TrackingMap vehicles={vehicles(1)} />);
    await waitFor(() => expect(count()).toBe(1));
    expect(FakeMap.instances).toHaveLength(1);
  });

  it('propriétés des marqueurs : état, cap et indicateur de direction réservé aux véhicules en mouvement', async () => {
    const list: MapVehicle[] = [
      { id: 'a', label: 'A', state: 'MOVING', latitude: 35.1, longitude: -2.9, heading: 45, moving: true },
      { id: 'b', label: 'B', state: 'STATIONARY', latitude: 35.2, longitude: -2.9, heading: 45, moving: false },
      { id: 'c', label: 'C', state: 'OFFLINE', latitude: 35.3, longitude: -2.9, heading: null, moving: false },
    ];
    await mountAndLoad(<TrackingMap vehicles={list} />);
    const features = (last().sources.vehicles!.data as GeoJSON.FeatureCollection).features;
    expect(features.map((f) => [f.properties!.id, f.properties!.state, f.properties!.hasHeading])).toEqual([
      ['a', 'MOVING', true], ['b', 'STATIONARY', false], ['c', 'OFFLINE', false],
    ]);
  });

  it('sélection : anneau de sélection mis à jour et carte centrée sur le véhicule (zoom conservé si déjà proche)', async () => {
    const { rerender } = await mountAndLoad(<TrackingMap vehicles={vehicles()} selectedId={null} />);
    await waitFor(() => expect(last().filters['vehicles-selected']).toEqual(['==', ['get', 'id'], '']));
    rerender(<TrackingMap vehicles={vehicles()} selectedId="v2" />);
    await waitFor(() => expect(last().filters['vehicles-selected']).toEqual(['==', ['get', 'id'], 'v2']));
    expect(last().easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-2.9, 35.11], zoom: 14 }));
  });

  it('clic sur un marqueur : le véhicule est sélectionné', async () => {
    const onSelect = vi.fn();
    await mountAndLoad(<TrackingMap vehicles={vehicles()} onSelect={onSelect} />);
    act(() => last().fireLayer('click', 'vehicles-circle', { features: [{ properties: { id: 'v2' } }] }));
    expect(onSelect).toHaveBeenCalledWith('v2');
    act(() => last().fireLayer('click', 'vehicles-circle', { features: [{ properties: { id: 42 } }] }));
    expect(onSelect).toHaveBeenCalledTimes(1); // identifiant invalide ignoré
  });

  it('le cadrage suit la clé fournie, pas chaque position reçue', async () => {
    const { rerender } = await mountAndLoad(<TrackingMap vehicles={vehicles()} fitKey="a" />);
    await waitFor(() => expect(last().fitBounds).toHaveBeenCalledTimes(1));
    rerender(<TrackingMap vehicles={vehicles().map((v) => ({ ...v, latitude: v.latitude + 0.1 }))} fitKey="a" />);
    expect(last().fitBounds).toHaveBeenCalledTimes(1);
    rerender(<TrackingMap vehicles={vehicles()} fitKey="b" />);
    await waitFor(() => expect(last().fitBounds).toHaveBeenCalledTimes(2));
  });

  it('un seul véhicule : la carte se centre dessus (pas de cadrage sur un point)', async () => {
    await mountAndLoad(<TrackingMap vehicles={vehicles(1)} fitKey="solo" />);
    await waitFor(() => expect(last().easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 15 })));
    expect(last().fitBounds).not.toHaveBeenCalled();
  });

  it('zones et tracé : polygones de cercle et ligne alimentent leurs sources', async () => {
    await mountAndLoad(
      <TrackingMap
        geofences={[{ id: 'g1', name: 'Aéroport', center_latitude: 35.17, center_longitude: -2.93, radius_m: 500, enabled: true }]}
        route={[[-2.9, 35.1], [-2.91, 35.11], [-2.92, 35.12]]}
      />
    );
    await waitFor(() => expect((last().sources.geofences!.data as GeoJSON.FeatureCollection).features).toHaveLength(1));
    const polygon = (last().sources.geofences!.data as GeoJSON.FeatureCollection).features[0]!.geometry as GeoJSON.Polygon;
    expect(polygon.coordinates[0]).toHaveLength(65);
    const route = (last().sources.route!.data as GeoJSON.FeatureCollection).features.map((f) => f.geometry.type);
    expect(route).toEqual(['LineString', 'Point', 'Point']);
  });

  it('mode sélection d’un point : le clic sur la carte renvoie les coordonnées ; sans mode, le clic est ignoré', async () => {
    const onPick = vi.fn();
    const { rerender } = await mountAndLoad(<TrackingMap pick={{ center: null, radius_m: 300 }} onPick={onPick} />);
    act(() => last().fire('click', { lngLat: { lat: 35.2, lng: -2.8 } }));
    expect(onPick).toHaveBeenCalledWith({ latitude: 35.2, longitude: -2.8 });
    await waitFor(() => expect(last().canvas.style.cursor).toBe('crosshair'));
    rerender(<TrackingMap pick={null} onPick={onPick} />);
    act(() => last().fire('click', { lngLat: { lat: 1, lng: 1 } }));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('WebGL indisponible : message explicite, la liste reste utilisable (pas d’exception)', async () => {
    FakeMap.failConstruction = true;
    render(<TrackingMap vehicles={vehicles()} />);
    expect(await screen.findByText('La carte ne peut pas s’afficher')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('WebGL');
  });
});

describe('configuration du fond de carte', () => {
  it('style ou tuiles configurés : utilisés tels quels (HTTPS uniquement), aucune clé ni fournisseur codé en dur', () => {
    expect(resolveMapConfig({ style: 'https://tiles.exemple.ma/style.json', production: true })).toMatchObject({ style: 'https://tiles.exemple.ma/style.json', blank: false, isFallback: false });
    const raster = resolveMapConfig({ tiles: 'https://tuiles.exemple.ma/{z}/{x}/{y}.png', attribution: '© Exemple', production: true });
    expect(raster).toMatchObject({ blank: false, isFallback: false, attribution: '© Exemple' });
    expect(JSON.stringify(raster.style)).toContain('https://tuiles.exemple.ma/{z}/{x}/{y}.png');
  });

  it('tuiles sans attribution ou en HTTP : refusées (attribution obligatoire, pas de contenu mixte)', () => {
    expect(resolveMapConfig({ tiles: 'https://tuiles.exemple.ma/{z}/{x}/{y}.png', production: true }).blank).toBe(true);
    expect(resolveMapConfig({ style: 'http://tiles.exemple.ma/style.json', production: true }).blank).toBe(true);
  });

  it('sans configuration : OpenStreetMap en développement uniquement ; en production, grille neutre (pas de tuiles tierces non prévues)', () => {
    const dev = resolveMapConfig({ production: false });
    expect(dev).toMatchObject({ isFallback: true, blank: false });
    expect(JSON.stringify(dev.style)).toContain('tile.openstreetmap.org');
    const prod = resolveMapConfig({ production: true });
    expect(prod).toMatchObject({ isFallback: true, blank: true });
    expect(JSON.stringify(prod.style)).not.toContain('openstreetmap');
  });
});
