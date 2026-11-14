import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeCall } from '@/tests/support/fake-supabase';

const state = vi.hoisted(() => ({
  session: null as unknown,
  service: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => state.session,
  createAdminClient: async () => state.service,
  createPublicClient: () => null,
}));
vi.mock('@/lib/auth/server', () => ({
  hasAccessPermission: async () => false,
  getServerAuth: async () => null,
}));

import { bookingsService } from './bookings.service';

const REF = 'CD-2026-100001';

const bookingWithVehicle = {
  id: 'a3000000-0000-4000-8000-000000000001',
  reference: REF,
  status: 'APPROVED',
  vehicle: {
    id: 'a2000000-0000-4000-8000-000000000002',
    brand: 'Dacia',
    model: 'Logan',
    engine_cc: null,
    license_plate: '12345-A-50',
    unit_number: 'A#101',
    documents: [{ url: 'carte-grise.pdf' }],
  },
};

let sessionCalls: FakeCall[] = [];
let serviceCalls: FakeCall[] = [];

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key');
  const session = createFakeSupabase((call) =>
    call.table === 'bookings' ? { data: call.mode === 'many' ? [bookingWithVehicle] : bookingWithVehicle } : undefined
  );
  const service = createFakeSupabase((call) =>
    call.table === 'bookings' ? { data: call.mode === 'many' ? [bookingWithVehicle] : bookingWithVehicle } : undefined
  );
  state.session = session.client;
  state.service = service.client;
  sessionCalls = session.calls;
  serviceCalls = service.calls;
});

const vehicleEmbed = (columns = '') => /vehicle:vehicles\(([^)]*)\)/.exec(columns)?.[1] ?? '';

describe('Véhicule joint aux réservations : jamais de champ privé hors du serveur', () => {
  it('lecture avec la session : colonnes véhicule explicites, sans colonne privée ni *', async () => {
    await bookingsService.getBookingByReference(REF);
    await bookingsService.getBookings({ agencyId: 'a1000000-0000-4000-8000-00000000000a' });
    expect(sessionCalls).toHaveLength(2);
    for (const call of sessionCalls) {
      const embed = vehicleEmbed(call.columns);
      expect(embed).not.toBe('');
      expect(embed).not.toMatch(/\*|license_plate|unit_number|documents/);
    }
  });

  it('lecture service-role (données client, PDF) : plaque, n° interne et documents retirés du résultat', async () => {
    const one = await bookingsService.getBookingByReference(REF, true);
    const many = await bookingsService.getBookings({ customerId: 'c0000000-0000-4000-8000-000000000001' }, true);
    expect(serviceCalls.length).toBeGreaterThan(0);
    for (const booking of [one, ...many]) {
      const vehicle = booking?.vehicle as unknown as Record<string, unknown>;
      expect(vehicle.brand).toBe('Dacia');
      expect(vehicle).not.toHaveProperty('license_plate');
      expect(vehicle).not.toHaveProperty('unit_number');
      expect(vehicle).not.toHaveProperty('documents');
    }
  });
});
