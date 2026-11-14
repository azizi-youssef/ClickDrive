import { describe, expect, it } from 'vitest';
import { applyPositionPatches, deriveSummary, matchesFilter, matchesSearch, mappable } from './fleet-state';
import type { FleetVehicle } from './types';
import type { PositionPatch } from './tracking-realtime';

const vehicle = (id: string, overrides: Partial<FleetVehicle> = {}): FleetVehicle => ({
  id,
  brand: 'Dacia',
  model: 'Logan',
  unit_number: `U-${id}`,
  license_plate: `${id}-A-50`,
  vehicle_type: 'CAR',
  state: 'STATIONARY',
  open_alerts: 0,
  booking_reference: null,
  tracker: { id: `t-${id}`, provider: 'klickdrive-gateway', label: null, status: 'ACTIVE', last_seen_at: '2026-11-14T10:00:00Z' },
  position: { latitude: 35.1, longitude: -2.9, speed_kmh: 0, heading_deg: null, ignition: null, accuracy_m: null, recorded_at: '2026-11-14T10:00:00Z' },
  ...overrides,
});

const patch = (id: string, recordedAt: string, moving = true): PositionPatch => ({
  vehicle_id: id,
  latitude: 35.2,
  longitude: -2.8,
  speed_kmh: moving ? 50 : 0,
  heading_deg: 90,
  ignition: true,
  accuracy_m: 5,
  recorded_at: recordedAt,
  movement_state: moving ? 'MOVING' : 'STATIONARY',
});

describe('application des événements temps réel', () => {
  it('met à jour la position, l’état et la dernière communication', () => {
    const [updated] = applyPositionPatches([vehicle('1')], [patch('1', '2026-11-14T10:00:30Z')]);
    expect(updated!.state).toBe('MOVING');
    expect(updated!.position).toMatchObject({ latitude: 35.2, speed_kmh: 50, recorded_at: '2026-11-14T10:00:30Z' });
    expect(updated!.tracker!.last_seen_at).toBe('2026-11-14T10:00:30Z');
  });

  it('une observation plus ancienne ou identique ne remplace jamais la position affichée (et ne provoque aucun rendu)', () => {
    const vehicles = [vehicle('1')];
    expect(applyPositionPatches(vehicles, [patch('1', '2026-11-14T09:59:00Z')])).toBe(vehicles);
    expect(applyPositionPatches(vehicles, [patch('1', '2026-11-14T10:00:00Z')])).toBe(vehicles);
  });

  it('un véhicule sans boîtier ou dont le boîtier est en pause n’est pas mis à jour', () => {
    const untracked = vehicle('1', { tracker: null, state: 'UNTRACKED', position: null });
    const paused = vehicle('2', { tracker: { id: 't', provider: 'p', label: null, status: 'DISABLED', last_seen_at: null }, state: 'DISABLED' });
    const vehicles = [untracked, paused];
    expect(applyPositionPatches(vehicles, [patch('1', '2026-11-14T10:00:30Z'), patch('2', '2026-11-14T10:00:30Z')])).toBe(vehicles);
  });

  it('un véhicule en attente de position ou hors ligne revient en ligne à la première position reçue', () => {
    const awaiting = vehicle('1', { state: 'AWAITING', position: null, tracker: { id: 't', provider: 'p', label: null, status: 'PENDING', last_seen_at: null } });
    const offline = vehicle('2', { state: 'OFFLINE' });
    const [a, o] = applyPositionPatches([awaiting, offline], [patch('1', '2026-11-14T10:01:00Z', false), patch('2', '2026-11-14T10:01:00Z')]);
    expect(a).toMatchObject({ state: 'STATIONARY', tracker: { status: 'ACTIVE' } });
    expect(o!.state).toBe('MOVING');
  });

  it('un événement pour un véhicule inconnu est ignoré ; seuls les véhicules concernés changent de référence', () => {
    const vehicles = [vehicle('1'), vehicle('2')];
    const next = applyPositionPatches(vehicles, [patch('1', '2026-11-14T10:05:00Z'), patch('inconnu', '2026-11-14T10:05:00Z')]);
    expect(next[0]).not.toBe(vehicles[0]);
    expect(next[1]).toBe(vehicles[1]);
  });
});

describe('compteurs, filtres et recherche', () => {
  const fleet = [
    vehicle('1', { state: 'MOVING' }),
    vehicle('2', { state: 'STATIONARY', open_alerts: 2 }),
    vehicle('3', { state: 'OFFLINE' }),
    vehicle('4', { state: 'UNTRACKED', tracker: null, position: null }),
    vehicle('5', { state: 'AWAITING', position: null, brand: 'Citroën', model: 'Berlingo' }),
  ];

  it('compteurs recalculés depuis la liste', () => {
    expect(deriveSummary(fleet, 2)).toEqual({
      total_vehicles: 5, tracked: 4, online: 2, moving: 1, stationary: 1, offline: 1, awaiting: 1, disabled: 0, untracked: 1, open_alerts: 2,
    });
  });

  it('filtres par état et par alertes', () => {
    expect(fleet.filter((v) => matchesFilter(v, 'MOVING')).map((v) => v.id)).toEqual(['1']);
    expect(fleet.filter((v) => matchesFilter(v, 'ALERTS')).map((v) => v.id)).toEqual(['2']);
    expect(fleet.filter((v) => matchesFilter(v, 'OTHER')).map((v) => v.id)).toEqual(['4', '5']);
    expect(fleet.filter((v) => matchesFilter(v, 'ALL'))).toHaveLength(5);
  });

  it('recherche insensible à la casse et aux accents, tous les mots doivent correspondre', () => {
    expect(fleet.filter((v) => matchesSearch(v, 'citroen')).map((v) => v.id)).toEqual(['5']);
    expect(fleet.filter((v) => matchesSearch(v, 'DACIA logan')).map((v) => v.id)).toEqual(['1', '2', '3', '4']);
    expect(fleet.filter((v) => matchesSearch(v, '3-a-50')).map((v) => v.id)).toEqual(['3']);
    expect(fleet.filter((v) => matchesSearch(v, 'dacia berlingo'))).toHaveLength(0);
    expect(fleet.filter((v) => matchesSearch(v, '   '))).toHaveLength(5);
  });

  it('seuls les véhicules positionnés sont placés sur la carte', () => {
    expect(mappable(fleet).map((v) => v.id)).toEqual(['1', '2', '3']);
  });
});
