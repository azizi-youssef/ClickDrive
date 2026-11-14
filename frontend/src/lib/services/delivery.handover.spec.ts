import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase, eqValue, writesTo, type FakeCall, type FakeResult } from '@/tests/support/fake-supabase';
import { AGENCY_A, AGENCY_B, actorHasPermission, serverAuthFor, type Actor } from '@/tests/fixtures/multi-agency';

const state = vi.hoisted(() => ({
  actor: 'adminA' as string,
  service: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => state.service,
  createClient: async () => null,
  createPublicClient: () => null,
}));
vi.mock('@/lib/auth/server', async () => {
  const fixtures = await import('@/tests/fixtures/multi-agency');
  return {
    hasAccessPermission: async (permission: string, agencyId?: string) =>
      fixtures.actorHasPermission(state.actor as Actor, permission, agencyId),
    getServerAuth: async () => fixtures.serverAuthFor(state.actor as Actor),
  };
});

import { deliveryService, type HandoverInspectionInput } from './delivery.service';
import { POST as handoverRoute } from '@/app/api/agencies/[id]/rentals/[bookingId]/handover/route';

const BOOKING_ID = 'a3000000-0000-4000-8000-0000000000a1';
const VEHICLE_ID = 'a2000000-0000-4000-8000-000000000002';

type Options = {
  status: string;
  agencyId?: string;
  startMileage?: number | null;
  deposit?: number;
  transition?: FakeResult;
  vehicleUpdate?: FakeResult;
};

let calls: FakeCall[] = [];

function setup(options: Options) {
  const fake = createFakeSupabase((call) => {
    if (call.table === 'bookings' && call.op === 'select') {
      if (eqValue(call, 'agency_id') !== (options.agencyId ?? AGENCY_A)) return { data: null };
      return {
        data: {
          id: BOOKING_ID,
          reference: 'CD-2026-100001',
          booking_ref: 'CD-2026-100001',
          vehicle_id: VEHICLE_ID,
          agency_id: options.agencyId ?? AGENCY_A,
          status: options.status,
          customer_name: 'Client',
          customer_phone: '0612345678',
          total_price: 1200,
          deposit_amount: options.deposit ?? 3000,
          start_date: '2027-03-01',
          end_date: '2027-03-05',
          vehicle: { id: VEHICLE_ID, brand: 'Dacia', model: 'Logan', year: 2025, status: 'AVAILABLE', mileage: options.startMileage ?? 42000 },
        },
      };
    }
    if (call.table === 'bookings' && call.op === 'update') return options.transition ?? { data: { id: BOOKING_ID } };
    if (call.table === 'vehicles' && call.op === 'update') return options.vehicleUpdate ?? { data: null };
    return undefined;
  });
  state.service = fake.client;
  calls = fake.calls;
}

function input(overrides: Partial<HandoverInspectionInput> = {}): HandoverInspectionInput {
  return {
    bookingId: BOOKING_ID,
    agencyId: AGENCY_A,
    type: 'PICKUP',
    mileage: 42000,
    fuelLevel: 'FULL',
    cleanliness: 'CLEAN',
    checklist: { spareTire: true, jack: true, registrationDoc: true, insuranceDoc: true, safetyKit: true },
    sendWhatsAppNotification: false,
    ...overrides,
  };
}

const bookingUpdates = () => writesTo(calls, 'bookings').filter((call) => call.op === 'update');
const anyBusinessWrite = () => writesTo(calls, 'bookings').length + writesTo(calls, 'vehicles').length;

beforeEach(() => {
  vi.stubEnv('WHATSAPP_API_TOKEN', '');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '');
});

describe('validateHandover — machine à états', () => {
  it.each(['PENDING', 'REQUESTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'ACTIVE', 'ALTERNATIVE_PROPOSED'])(
    'remise depuis %s : refusée, aucune écriture',
    async (status) => {
      setup({ status });
      const result = await deliveryService.validateHandover(input({ type: 'PICKUP' }));
      expect(result).toMatchObject({ success: false, transitionConflict: true });
      expect(anyBusinessWrite()).toBe(0);
    }
  );

  it.each(['PENDING', 'APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP', 'REJECTED', 'COMPLETED'])(
    'restitution depuis %s : refusée, aucune écriture',
    async (status) => {
      setup({ status });
      const result = await deliveryService.validateHandover(input({ type: 'RETURN', mileage: 42500 }));
      expect(result).toMatchObject({ success: false, transitionConflict: true });
      expect(anyBusinessWrite()).toBe(0);
    }
  );

  it.each(['APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP'])('remise depuis %s : ACTIVE, écriture gardée par l’agence et le statut lu', async (status) => {
    setup({ status });
    const result = await deliveryService.validateHandover(input({ type: 'PICKUP' }));
    expect(result).toMatchObject({ success: true, bookingStatus: 'ACTIVE', vehicleStatus: 'RENTED', warnings: [] });
    const [update] = bookingUpdates();
    expect(update.payload).toMatchObject({ status: 'ACTIVE' });
    expect(eqValue(update, 'status')).toBe(status);
    expect(eqValue(update, 'agency_id')).toBe(AGENCY_A);
    const [vehicleUpdate] = writesTo(calls, 'vehicles');
    expect(eqValue(vehicleUpdate, 'agency_id')).toBe(AGENCY_A);
  });

  it('restitution d’une location en cours : COMPLETED, distance calculée', async () => {
    setup({ status: 'ACTIVE', startMileage: 42000 });
    const result = await deliveryService.validateHandover(input({ type: 'RETURN', mileage: 42650 }));
    expect(result).toMatchObject({ success: true, bookingStatus: 'COMPLETED', vehicleStatus: 'AVAILABLE', distanceDrivenKm: 650 });
  });
});

describe('validateHandover — intégrité et erreurs', () => {
  it('kilométrage de retour inférieur au départ : refusé', async () => {
    setup({ status: 'ACTIVE', startMileage: 42000 });
    const result = await deliveryService.validateHandover(input({ type: 'RETURN', mileage: 41000 }));
    expect(result).toMatchObject({ success: false, invalidInput: true });
    expect(anyBusinessWrite()).toBe(0);
  });

  it('retenue supérieure à la caution : refusée', async () => {
    setup({ status: 'ACTIVE', deposit: 3000 });
    const result = await deliveryService.validateHandover(input({ type: 'RETURN', mileage: 42100, depositDeduction: 5000 }));
    expect(result).toMatchObject({ success: false, invalidInput: true });
    expect(anyBusinessWrite()).toBe(0);
  });

  it('réservation d’une autre agence : introuvable', async () => {
    setup({ status: 'APPROVED', agencyId: AGENCY_B });
    const result = await deliveryService.validateHandover(input({ agencyId: AGENCY_A }));
    expect(result).toMatchObject({ success: false, notFound: true });
    expect(anyBusinessWrite()).toBe(0);
  });

  it('identifiant non UUID : introuvable sans requête', async () => {
    setup({ status: 'APPROVED' });
    const result = await deliveryService.validateHandover(input({ bookingId: 'bk-fake' }));
    expect(result).toMatchObject({ success: false, notFound: true });
    expect(calls).toHaveLength(0);
  });

  it('remise concurrente (aucune ligne modifiée) : conflit, pas de mise à jour du véhicule', async () => {
    setup({ status: 'APPROVED', transition: { data: null } });
    const result = await deliveryService.validateHandover(input());
    expect(result).toMatchObject({ success: false, transitionConflict: true });
    expect(writesTo(calls, 'vehicles')).toHaveLength(0);
  });

  it('erreur base à la transition : échec, message neutre', async () => {
    setup({ status: 'APPROVED', transition: { error: { message: 'deadlock detected on bookings_pkey', code: '40P01' } } });
    const result = await deliveryService.validateHandover(input());
    expect(result.success).toBe(false);
    expect(result.error).not.toMatch(/deadlock|bookings_pkey/);
  });

  it('véhicule non mis à jour après la transition : succès signalé avec avertissement, jamais masqué', async () => {
    setup({ status: 'APPROVED', vehicleUpdate: { error: { message: 'timeout' } } });
    const result = await deliveryService.validateHandover(input());
    expect(result.success).toBe(true);
    expect(result.warnings).toContain('vehicle_not_updated');
  });
});

describe('POST /api/agencies/[id]/rentals/[bookingId]/handover', () => {
  const call = (agencyId: string, body: unknown) =>
    handoverRoute(
      new NextRequest(`http://localhost/api/agencies/${agencyId}/rentals/${BOOKING_ID}/handover`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: agencyId, bookingId: BOOKING_ID }) }
    );

  it('fixtures : l’agent A a bookings.manage, B non', () => {
    expect(actorHasPermission('agentA', 'bookings.manage', AGENCY_A)).toBe(true);
    expect(serverAuthFor('adminB')?.agencyIds).toEqual([AGENCY_B]);
  });

  it('sans session : 401 ; agence B : 403', async () => {
    setup({ status: 'APPROVED' });
    state.actor = 'none';
    expect((await call(AGENCY_A, { type: 'PICKUP', mileage: 42000 })).status).toBe(401);
    state.actor = 'adminB';
    expect((await call(AGENCY_A, { type: 'PICKUP', mileage: 42000 })).status).toBe(403);
    expect(anyBusinessWrite()).toBe(0);
  });

  it('remise d’une demande non validée : 409', async () => {
    setup({ status: 'PENDING' });
    state.actor = 'agentA';
    expect((await call(AGENCY_A, { type: 'PICKUP', mileage: 42000 })).status).toBe(409);
  });

  it('kilométrage incohérent : 422 ; remise valide : 200', async () => {
    state.actor = 'agentA';
    setup({ status: 'ACTIVE', startMileage: 42000 });
    expect((await call(AGENCY_A, { type: 'RETURN', mileage: 100 })).status).toBe(422);
    setup({ status: 'APPROVED' });
    const response = await call(AGENCY_A, { type: 'PICKUP', mileage: 42000 });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('ACTIVE');
  });
});
