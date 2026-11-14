import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, writesTo, type FakeCall, type FakeResolver } from '@/tests/support/fake-supabase';

const state = vi.hoisted(() => ({
  client: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => state.client,
  createClient: async () => state.client,
  createPublicClient: () => state.client,
}));

import { detectInboundIntent, extractBookingReference, whatsappService } from './whatsapp.service';

const CUSTOMER_PHONE = '0612345678';
const CUSTOMER_WA = '212612345678';

function booking(status: string, phone = CUSTOMER_PHONE) {
  return {
    id: 'b0000000-0000-4000-8000-000000000001',
    reference: 'CD-2026-123456',
    booking_ref: 'CD-2026-123456',
    customer_name: 'Youssef',
    customer_phone: phone,
    status,
    start_date: '2027-03-01',
    end_date: '2027-03-05',
    pickup_time: '10:00:00',
    pickup_location: 'Aéroport Nador',
    agency_id: 'a0000000-0000-4000-8000-00000000000a',
    vehicle: { brand: 'Dacia', model: 'Logan' },
    agency: { name: 'Agence A', phone: '0536000000', whatsapp: '0661000000' },
  };
}

let calls: FakeCall[] = [];

function installDatabase(resolver: FakeResolver) {
  const fake = createFakeSupabase(resolver);
  state.client = fake.client;
  calls = fake.calls;
}

/** Réservation trouvée pour toute lecture de `bookings` */
function withBooking(row: ReturnType<typeof booking> | null) {
  installDatabase((call) => (call.table === 'bookings' && call.op === 'select' ? { data: row } : undefined));
}

function inbound(body: string) {
  return whatsappService.handleInboundMessage({
    from: CUSTOMER_WA,
    messageId: `wamid.${Math.random()}`,
    timestamp: '1729141200',
    type: 'text',
    body,
  });
}

beforeEach(() => {
  // Jamais d'appel réseau vers Meta dans les tests : envoi simulé
  vi.stubEnv('WHATSAPP_API_TOKEN', '');
  vi.stubEnv('META_WHATSAPP_TOKEN', '');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '');
  withBooking(null);
});

describe('Intention d’un message WhatsApp entrant', () => {
  it.each([
    ['Oui', 'DEFAULT'],
    ['OK', 'DEFAULT'],
    ['ok merci', 'DEFAULT'],
    ['Non merci', 'DEFAULT'],
    ['non', 'DEFAULT'],
    ['Stop', 'DEFAULT'],
    ['Je veux annuler', 'DEFAULT'],
    ['je confirme', 'DEFAULT'],
    ['AIDE', 'HELP'],
    ['  aide ! ', 'HELP'],
    ['STATUT CD-2026-123456', 'STATUS'],
    ['Annuler', 'CANCEL_REQUEST'],
    ['annulation', 'CANCEL_REQUEST'],
  ] as const)('« %s » → %s', (text, expected) => {
    expect(detectInboundIntent(text)).toBe(expected);
  });

  it('extrait uniquement une référence au format strict', () => {
    expect(extractBookingReference('statut cd-2026-123456 svp')).toBe('CD-2026-123456');
    expect(extractBookingReference('CD-2026-TEST42),status.eq.APPROVED')).toBeNull();
  });
});

describe('Aucun message client ne modifie une réservation', () => {
  it.each([
    ['Oui', 'PENDING'],
    ['OK', 'PENDING'],
    ['oui CD-2026-123456', 'PENDING'],
    ['Non merci', 'PENDING'],
    ['Stop', 'CONFIRMED'],
    ['non', 'APPROVED'],
    ['ANNULER', 'CONFIRMED'],
    ['je veux annuler demain peut-être', 'PENDING'],
  ])('« %s » sur un dossier %s : aucune écriture sur bookings, aucune annonce de succès', async (text, status) => {
    withBooking(booking(status));
    const result = await inbound(text);

    expect(writesTo(calls, 'bookings')).toHaveLength(0);
    expect(writesTo(calls, 'vehicles')).toHaveLength(0);
    expect(result.replySent ?? '').not.toMatch(/confirmée avec succès|annulation prise en compte|passé au statut/i);
    expect(result.actionTaken).toMatch(/aucune modification/);
  });

  it('« ANNULER » oriente vers l’espace client et l’agence', async () => {
    withBooking(booking('CONFIRMED'));
    const result = await inbound('ANNULER');
    expect(result.intent).toBe('CANCEL_REQUEST');
    expect(result.replySent).toContain("n'a pas été modifiée");
    expect(result.replySent).toContain('/account/bookings/CD-2026-123456');
    expect(result.replySent).toContain('Agence A');
  });

  it('les seules écritures sont la journalisation (audit, historique des notifications)', async () => {
    withBooking(booking('PENDING'));
    await inbound('Oui');
    const tables = new Set(calls.filter((call) => call.op !== 'select' && call.op !== 'rpc').map((call) => call.table));
    expect([...tables].every((table) => table === 'audit_logs' || table === 'booking_events')).toBe(true);
    for (const event of writesTo(calls, 'booking_events')) {
      expect((event.payload as { event_type: string }).event_type).toMatch(/^WHATSAPP_NOTIFICATION_/);
    }
  });
});

describe('Dossier associé au seul titulaire du numéro', () => {
  it('une référence citée depuis un autre numéro ne révèle rien du dossier', async () => {
    withBooking(booking('APPROVED', '0699999999'));
    const result = await inbound('STATUT CD-2026-123456');
    expect(result.bookingRef).toBeUndefined();
    expect(result.replySent).not.toContain('CD-2026-123456');
    expect(result.replySent).toContain('Aucune réservation');
  });

  it('le titulaire obtient le statut de sa demande, sans modification', async () => {
    withBooking(booking('PENDING'));
    const result = await inbound('STATUT');
    expect(result.bookingRef).toBe('CD-2026-123456');
    expect(result.replySent).toContain('CD-2026-123456');
    expect(writesTo(calls, 'bookings')).toHaveLength(0);
  });

  it('erreur de base : réponse générique, aucune information ni annonce de succès', async () => {
    installDatabase((call) =>
      call.table === 'bookings' ? { error: { message: 'connection reset' } } : undefined
    );
    const result = await inbound('STATUT CD-2026-123456');
    expect(result.bookingRef).toBeUndefined();
    expect(result.replySent).toContain('Aucune réservation');
    expect(result.replySent).not.toContain('connection reset');
  });

  it('le numéro d’assistance est celui de la plateforme', async () => {
    const result = await inbound('AIDE');
    expect(result.replySent).toContain('+212767137136');
    expect(result.replySent).not.toContain('661-987654');
  });
});
