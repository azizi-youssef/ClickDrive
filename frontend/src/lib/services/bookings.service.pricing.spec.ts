import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeCall } from '@/tests/support/fake-supabase';

const state = vi.hoisted(() => ({
  service: null as unknown,
  vehicle: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => state.service,
  createAdminClient: async () => state.service,
  createPublicClient: () => null,
}));
vi.mock('@/lib/auth/server', () => ({
  hasAccessPermission: async () => false,
  getServerAuth: async () => null,
}));
vi.mock('./vehicles.service', () => ({
  vehiclesService: { getVehicleById: async () => state.vehicle },
}));
vi.mock('./commission.service', () => ({
  commissionService: { getCommissionRate: async () => 0 },
}));

import { bookingsService } from './bookings.service';

const VEHICLE_ID = '11111111-1111-4111-8111-111111111111';
const AGENCY_ID = '22222222-2222-4222-8222-222222222222';
const KEY = '33333333-3333-4333-8333-333333333333';

const inDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Demande de 7 jours (la remise « dès 7 jours » s'applique) */
const input = () => ({
  vehicleId: VEHICLE_ID,
  agencyId: AGENCY_ID,
  firstName: 'Youssef',
  lastName: 'Azizi',
  cin: 'S123456',
  phone: '+212661234567',
  country: 'Maroc',
  birthDate: '1995-04-12',
  licenseNumber: '04/987654',
  licenseExpiry: '2035-05-20',
  startDate: inDays(30),
  endDate: inDays(37),
  pickupTime: '10:00',
  dropoffTime: '10:00',
  deliveryType: 'AIRPORT' as const,
  pickupLocation: 'Aéroport Nador',
  dropoffLocation: 'Aéroport Nador',
  childSeat: false,
  additionalDriver: false,
});

const agency = {
  id: AGENCY_ID,
  // Voitures : −10 % dès 7 jours ; motos : −25 % dès 7 jours (listes distinctes)
  duration_discounts: [{ min_days: 7, percent: 10 }],
  motorcycle_duration_discounts: [{ min_days: 7, percent: 25 }],
};

let calls: FakeCall[] = [];

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key');
  const fake = createFakeSupabase((call) => {
    if (call.table === 'bookings' && call.op === 'insert') {
      return { data: { id: 'b1', ...(call.payload as object), vehicle: state.vehicle, agency } };
    }
    return undefined;
  });
  state.service = fake.client;
  calls = fake.calls;
  vi.spyOn(bookingsService as unknown as { getAvailabilityStatus: () => Promise<string> }, 'getAvailabilityStatus').mockResolvedValue('AVAILABLE');
});

const insertedBooking = () => calls.find((call) => call.table === 'bookings' && call.op === 'insert')?.payload as Record<string, unknown>;

describe('Prix certifié côté serveur — remises des voitures et des motos', () => {
  it('une voiture : le serveur applique les paliers des voitures (−10 % : 7 × 300 → 1 890 DH)', async () => {
    state.vehicle = { id: VEHICLE_ID, agency_id: AGENCY_ID, published: true, brand: 'Dacia', model: 'Logan', daily_price: 300, vehicle_type: 'CAR', category: 'Économique', agency };
    const result = await bookingsService.createBookingRequest(input(), undefined, KEY);
    expect(result.success).toBe(true);
    expect(insertedBooking()).toMatchObject({ total_days: 7, daily_price: 270, total_price: 1890 });
  });

  it('une moto de la même agence : paliers des motos (−25 % : 7 × 300 → 1 575 DH)', async () => {
    state.vehicle = { id: VEHICLE_ID, agency_id: AGENCY_ID, published: true, brand: 'Honda', model: 'PCX', daily_price: 300, vehicle_type: 'MOTORCYCLE', category: 'Scooter', agency };
    const result = await bookingsService.createBookingRequest(input(), undefined, KEY);
    expect(result.success).toBe(true);
    expect(insertedBooking()).toMatchObject({ total_days: 7, daily_price: 225, total_price: 1575 });
  });

  it('motos sans remise alors que les voitures en ont : la moto est facturée au prix plein', async () => {
    state.vehicle = {
      id: VEHICLE_ID, agency_id: AGENCY_ID, published: true, brand: 'Honda', model: 'PCX', daily_price: 300, vehicle_type: 'MOTORCYCLE', category: 'Scooter',
      agency: { ...agency, motorcycle_duration_discounts: [] },
    };
    await bookingsService.createBookingRequest(input(), undefined, KEY);
    expect(insertedBooking()).toMatchObject({ daily_price: 300, total_price: 2100 });
  });

  it('le client ne peut imposer aucune remise : le prix vient du véhicule et de l’agence relus en base', async () => {
    state.vehicle = { id: VEHICLE_ID, agency_id: AGENCY_ID, published: true, brand: 'Dacia', model: 'Logan', daily_price: 300, vehicle_type: 'CAR', category: 'Économique', agency };
    await bookingsService.createBookingRequest({ ...input(), total_price: 1, daily_price: 1, motorcycle_duration_discounts: [{ min_days: 1, percent: 50 }] } as never, undefined, KEY);
    expect(insertedBooking()).toMatchObject({ total_price: 1890 });
  });
});
