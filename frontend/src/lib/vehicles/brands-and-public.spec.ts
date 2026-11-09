import { describe, expect, it } from 'vitest';
import { normalizeBrand } from './brands';
import { toPublicVehicle } from './public';
import { toPublicAgency } from '@/lib/agencies/public';
import { testVehicle } from '@/tests/fixtures/vehicle';
import type { Agency } from '@/types';

describe('normalizeBrand', () => {
  it.each([
    ['SUZUKI', 'Suzuki'],
    ['  suzuki ', 'Suzuki'],
    ['mercedes', 'Mercedes-Benz'],
    ['Mercedes Benz', 'Mercedes-Benz'],
    ['vw', 'Volkswagen'],
    ['land rover', 'Land Rover'],
    ['Citroën', 'Citroen'],
    ['bmw', 'BMW'],
    ['sym', 'SYM'],
  ])('« %s » → « %s »', (input, expected) => {
    expect(normalizeBrand(input)).toBe(expected);
  });

  it('marque inconnue : conservée, majuscule initiale, capitales ramenées', () => {
    expect(normalizeBrand('lynk & co')).toBe('Lynk & co');
    expect(normalizeBrand('GREATWALL')).toBe('Greatwall');
  });
});

const agency: Agency = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Agence Test',
  slug: 'agence-test',
  description: '',
  phone: '0536000000',
  whatsapp: '212661000000',
  email: 'gerant@agence-test.invalid',
  address: 'Nador',
  city: 'Nador',
  latitude: 35.17,
  longitude: -2.93,
  logo_url: '',
  status: 'ACTIVE',
  verified: true,
  rating: 0,
  review_count: 0,
  created_at: '2026-10-01T10:00:00.000Z',
} as Agency;

describe('Projections publiques', () => {
  it('agence : l’e-mail ne sort jamais, le téléphone et WhatsApp restent (contact direct)', () => {
    const shown = toPublicAgency(agency);
    expect(shown.email).toBe('');
    expect(shown.phone).toBe('0536000000');
    expect(shown.whatsapp).toBe('212661000000');
    expect(agency.email).toBe('gerant@agence-test.invalid'); // l'objet d'origine n'est pas modifié
  });

  it('véhicule : ni plaque, ni n° interne, ni documents, ni e-mail de l’agence jointe', () => {
    const vehicle = { ...testVehicle({ license_plate: '12345-A-6', unit_number: 'U-7' }), agency, documents: ['carte-grise.pdf'] };
    const shown = toPublicVehicle(vehicle) as typeof vehicle;
    expect(shown.license_plate).toBe('');
    expect(shown.unit_number).toBe('');
    expect('documents' in shown).toBe(false);
    expect(shown.agency?.email).toBe('');
    expect(shown.agency?.name).toBe('Agence Test');
  });
});
