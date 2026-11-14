import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  circlePolygon,
  compassLabel,
  formatAge,
  formatDistanceKm,
  formatDuration,
  formatSpeed,
  haversineKm,
  impliedSpeedKmh,
  isInsideCircle,
  isValidCoordinate,
  tripDistanceKm,
  type TimedPoint,
} from './geo.utils';

const NADOR = { latitude: 35.1688, longitude: -2.9335 };
const KM_PER_DEG = 111.195;

describe('coordonnées', () => {
  it('valides : dans les bornes, finies, et différentes de (0, 0)', () => {
    expect(isValidCoordinate(35.1, -2.9)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    for (const [lat, lon] of [[91, 0], [0, 181], [-91, 10], [0, 0], [NaN, 1], [1, Infinity], ['35', '2'], [null, 1], [undefined, undefined]] as const) {
      expect(isValidCoordinate(lat, lon), `${lat},${lon}`).toBe(false);
    }
  });

  it('distance de Haversine : 1° de latitude ≈ 111,2 km, distance nulle, symétrie', () => {
    expect(haversineKm(NADOR, NADOR)).toBe(0);
    expect(haversineKm(NADOR, { latitude: NADOR.latitude + 1, longitude: NADOR.longitude })).toBeCloseTo(KM_PER_DEG, 1);
    const casablanca = { latitude: 33.5731, longitude: -7.5898 };
    expect(haversineKm(NADOR, casablanca)).toBeCloseTo(haversineKm(casablanca, NADOR), 9);
    // Nador → Casablanca ≈ 463 km à vol d'oiseau
    expect(haversineKm(NADOR, casablanca)).toBeGreaterThan(455);
    expect(haversineKm(NADOR, casablanca)).toBeLessThan(470);
  });

  it('vitesse déduite : null si l’intervalle n’est pas positif', () => {
    const a: TimedPoint = { ...NADOR, t: 0 };
    const b: TimedPoint = { latitude: NADOR.latitude + 0.01, longitude: NADOR.longitude, t: 60_000 };
    expect(impliedSpeedKmh(a, b)).toBeCloseTo(66.7, 0);
    expect(impliedSpeedKmh(b, a)).toBeNull();
    expect(impliedSpeedKmh(a, { ...b, t: 0 })).toBeNull();
  });
});

describe('distance de trajet : jamais de distance trompeuse', () => {
  const line = (count: number, stepDeg: number, stepSeconds = 10, start = 0): TimedPoint[] =>
    Array.from({ length: count }, (_, i) => ({ latitude: NADOR.latitude + i * stepDeg, longitude: NADOR.longitude, t: start + i * stepSeconds * 1000 }));

  it('somme des segments valides', () => {
    // 10 pas de 0,001° (≈ 111 m) en 10 s : ≈ 40 km/h
    expect(tripDistanceKm(line(11, 0.001))).toBeCloseTo(10 * 0.001 * KM_PER_DEG, 2);
  });

  it('ignore un saut impossible (> 250 km/h) sans casser le reste du trajet', () => {
    const points = line(6, 0.001);
    const jump: TimedPoint = { latitude: NADOR.latitude + 0.5, longitude: NADOR.longitude, t: 55_000 };
    const after = line(4, 0.001, 10, 60).map((p, i) => ({ ...p, latitude: NADOR.latitude + (6 + i) * 0.001 }));
    const withJump = tripDistanceKm([...points, jump, ...after]);
    const without = tripDistanceKm([...points, ...after]);
    expect(withJump).toBeCloseTo(without, 6);
    expect(withJump).toBeLessThan(1.5);
  });

  it('ignore les coordonnées invalides, les points désordonnés et les doublons de date', () => {
    const points: TimedPoint[] = [
      { ...NADOR, t: 0 },
      { latitude: 0, longitude: 0, t: 10_000 },
      { latitude: 95, longitude: 0, t: 20_000 },
      { latitude: NaN, longitude: 1, t: 30_000 },
      { latitude: NADOR.latitude + 0.001, longitude: NADOR.longitude, t: 40_000 },
      { latitude: NADOR.latitude + 0.5, longitude: NADOR.longitude, t: 40_000 }, // même date : ignoré
      { latitude: NADOR.latitude + 0.5, longitude: NADOR.longitude, t: 10_000 }, // date antérieure : ignoré
    ];
    expect(tripDistanceKm(points)).toBeCloseTo(0.001 * KM_PER_DEG, 3);
  });

  it('ne cumule pas la dérive d’un véhicule à l’arrêt (segments sous 5 m)', () => {
    const noisy: TimedPoint[] = Array.from({ length: 200 }, (_, i) => ({
      latitude: NADOR.latitude + (i % 2) * 0.00002, // ≈ 2 m
      longitude: NADOR.longitude,
      t: i * 5000,
    }));
    expect(tripDistanceKm(noisy)).toBe(0);
  });

  it('suite vide ou à un seul point : 0', () => {
    expect(tripDistanceKm([])).toBe(0);
    expect(tripDistanceKm([{ ...NADOR, t: 0 }])).toBe(0);
  });
});

describe('zones circulaires, emprises, formats', () => {
  it('appartenance à un cercle', () => {
    expect(isInsideCircle(NADOR, NADOR, 100)).toBe(true);
    expect(isInsideCircle({ latitude: NADOR.latitude + 0.0008, longitude: NADOR.longitude }, NADOR, 100)).toBe(true);
    expect(isInsideCircle({ latitude: NADOR.latitude + 0.0011, longitude: NADOR.longitude }, NADOR, 100)).toBe(false);
  });

  it('polygone d’un cercle : fermé, 65 points, tous à la distance du rayon', () => {
    const ring = circlePolygon(NADOR, 500, 64);
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring[64]);
    for (const [lon, lat] of ring.slice(0, 64)) {
      expect(haversineKm(NADOR, { latitude: lat, longitude: lon }) * 1000).toBeCloseTo(500, 0);
    }
  });

  it('emprise : ignore les points invalides ; null sans point valide', () => {
    expect(boundsOf([{ latitude: 35, longitude: -3 }, { latitude: 36, longitude: -2 }, { latitude: 0, longitude: 0 }, { latitude: 99, longitude: 1 }])).toEqual([[-3, 35], [-2, 36]]);
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ latitude: 0, longitude: 0 }])).toBeNull();
  });

  it('cap en direction cardinale française', () => {
    expect(compassLabel(0)).toBe('N');
    expect(compassLabel(90)).toBe('E');
    expect(compassLabel(180)).toBe('S');
    expect(compassLabel(270)).toBe('O');
    expect(compassLabel(359)).toBe('N');
    expect(compassLabel(-90)).toBe('O');
    expect(compassLabel(null)).toBeNull();
    expect(compassLabel(NaN)).toBeNull();
  });

  it('formats d’affichage', () => {
    expect(formatDistanceKm(0.45)).toBe('450 m');
    expect(formatDistanceKm(12.34)).toMatch(/^12[,.]3 km$/);
    expect(formatDistanceKm(-1)).toBe('—');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatDuration(3720)).toBe('1 h 02');
    expect(formatDuration(7200)).toBe('2 h');
    expect(formatDuration(NaN)).toBe('—');
    expect(formatSpeed(41.6)).toBe('42 km/h');
    expect(formatSpeed(null)).toBe('—');
    const now = Date.parse('2026-11-14T10:00:00Z');
    expect(formatAge('2026-11-14T09:59:58Z', now)).toBe('à l’instant');
    expect(formatAge('2026-11-14T09:59:00Z', now)).toBe('il y a 1 min');
    expect(formatAge('2026-11-14T07:00:00Z', now)).toBe('il y a 3 h');
    expect(formatAge('2026-11-12T10:00:00Z', now)).toBe('il y a 2 j');
    expect(formatAge(null, now)).toBe('jamais');
  });
});
