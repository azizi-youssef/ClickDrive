import { describe, expect, it, vi } from 'vitest';
import type { Vehicle } from '@/types';

vi.mock('@/lib/services/public-catalog.service', () => ({ getPublicCatalog: vi.fn() }));

import { summarizeFooterCatalog } from './footer-categories';

const vehicle = (category: string, extra: Partial<Vehicle> = {}) =>
  ({ id: `${category}-${Math.random()}`, category, transmission: 'MANUAL', vehicle_type: 'CAR', ...extra }) as unknown as Vehicle;

describe('Pied de page : catégories calculées depuis le catalogue réel', () => {
  it('n’affiche que les catégories qui contiennent des véhicules, avec leur page SEO', () => {
    const summary = summarizeFooterCatalog([
      vehicle('SUV', { transmission: 'AUTOMATIC' }),
      vehicle('Économique'),
      vehicle('Économique'),
      vehicle('Scooter', { vehicle_type: 'MOTORCYCLE' }),
    ]);
    expect(summary.categories.map((category) => category.value)).toEqual(['Économique', 'SUV']);
    expect(summary.categories.find((category) => category.value === 'SUV')?.href).toBe('/location-voiture-nador-suv');
    expect(summary.categories.some((category) => category.value === 'Berline')).toBe(false);
    expect(summary.automaticCars).toBe(1);
    expect(summary.motorcycles).toBe(1);
  });
});
