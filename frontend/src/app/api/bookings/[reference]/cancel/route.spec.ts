import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { signedBookingLink } from '@/lib/auth/booking-access-link';

const state = vi.hoisted(() => ({
  cancel: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    void task();
  },
}));
vi.mock('@/lib/services/bookings.service', () => ({ bookingsService: { cancelByCustomer: state.cancel } }));
vi.mock('@/lib/bookings/notifications', () => ({ notifyCustomerCancelled: state.notify }));

import { POST } from './route';

const REF = 'CD-2026-123456';

function signature(reference = REF) {
  const path = signedBookingLink('track', reference) ?? '';
  const params = new URL(`http://localhost${path}`).searchParams;
  return { exp: params.get('exp'), sig: params.get('sig') };
}

function call(body: unknown, reference = REF) {
  return POST(
    new NextRequest(`http://localhost/api/bookings/${reference}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ reference }) }
  );
}

beforeEach(() => {
  vi.stubEnv('BOOKING_LINK_SECRET', 'secret-de-test-des-liens-signes');
  state.cancel.mockReset();
  state.notify.mockReset();
  state.notify.mockResolvedValue(undefined);
});

describe('POST /api/bookings/[reference]/cancel — annulation par le client', () => {
  it('lien signé valide : demande annulée, agence prévenue avec le motif', async () => {
    state.cancel.mockResolvedValue({ success: true });
    const response = await call({ ...signature(), reason: 'found_elsewhere' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, status: 'CANCELLED' });
    expect(state.cancel).toHaveBeenCalledWith(REF, 'found_elsewhere');
    expect(state.notify).toHaveBeenCalledWith(REF, 'http://localhost', 'found_elsewhere');
  });

  it('référence en minuscules dans l’adresse : même dossier', async () => {
    state.cancel.mockResolvedValue({ success: true });
    const response = await call({ ...signature() }, REF.toLowerCase());
    expect(response.status).toBe(200);
    expect(state.cancel).toHaveBeenCalledWith(REF, null);
  });

  it.each([
    ['sans signature', {}],
    ['signature d’une autre demande', signature('CD-2026-654321')],
    ['signature altérée', { ...signature(), sig: 'x' }],
    ['lien expiré', { exp: '1000', sig: signature().sig }],
  ])('%s : refus 403, rien n’est annulé', async (_label, body) => {
    const response = await call(body);
    expect(response.status).toBe(403);
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('motif hors liste : 400', async () => {
    const response = await call({ ...signature(), reason: 'texte libre' });
    expect(response.status).toBe(400);
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it('l’agence a déjà répondu : 409 avec le statut, aucune notification', async () => {
    state.cancel.mockResolvedValue({ success: false, notCancellable: true, status: 'APPROVED', error: 'déjà répondu' });
    const response = await call(signature());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, status: 'APPROVED' });
    expect(state.notify).not.toHaveBeenCalled();
  });

  it('dossier introuvable : 404 ; base indisponible : 503', async () => {
    state.cancel.mockResolvedValueOnce({ success: false, notFound: true, error: 'introuvable' });
    expect((await call(signature())).status).toBe(404);
    state.cancel.mockResolvedValueOnce({ success: false, serviceUnavailable: true, error: 'indisponible' });
    expect((await call(signature())).status).toBe(503);
  });
});
