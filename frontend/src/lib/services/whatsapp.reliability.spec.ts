import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeCall } from '@/tests/support/fake-supabase';

const state = vi.hoisted(() => ({
  client: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => state.client,
  createClient: async () => state.client,
  createPublicClient: () => state.client,
}));

import { whatsappService } from './whatsapp.service';
import type { Booking } from '@/types';

let calls: FakeCall[] = [];
let seenInbound: Set<string>;
let inboundWithinWindow = false;

function installDatabase() {
  seenInbound = new Set();
  const fake = createFakeSupabase((call) => {
    if (call.table === 'whatsapp_messages' && call.op === 'upsert') {
      const wamid = String((call.payload as { wamid: string }).wamid);
      if (seenInbound.has(wamid)) return { data: [] }; // ON CONFLICT DO NOTHING : aucune ligne
      seenInbound.add(wamid);
      return { data: [{ id: `row-${wamid}` }] };
    }
    if (call.table === 'whatsapp_messages' && call.op === 'select') {
      return { data: inboundWithinWindow ? [{ id: 'inbound-1' }] : [] };
    }
    if (call.op === 'rpc' && call.table === 'record_whatsapp_status') {
      return { data: (call.payload as { p_status: string }).p_status };
    }
    if (call.table === 'bookings') return { data: null };
    return undefined;
  });
  state.client = fake.client;
  calls = fake.calls;
}

const rpcCalls = (name: string) => calls.filter((call) => call.op === 'rpc' && call.table === name);

function inboundPayload(messageId: string, body: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              contacts: [{ profile: { name: 'Client' }, wa_id: '212612345678' }],
              messages: [{ from: '212612345678', id: messageId, timestamp: '1729141200', text: { body }, type: 'text' }],
            },
          },
        ],
      },
    ],
  };
}

const booking = {
  id: 'b0000000-0000-4000-8000-000000000001',
  reference: 'CD-2026-123456',
  agency_id: 'a0000000-0000-4000-8000-00000000000a',
  customer_name: 'Client',
  customer_phone: '0612345678',
} as unknown as Booking;

beforeEach(() => {
  installDatabase();
  inboundWithinWindow = false;
  vi.stubEnv('WHATSAPP_API_TOKEN', '');
  vi.stubEnv('META_WHATSAPP_TOKEN', '');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '');
  vi.stubEnv('WHATSAPP_TEMPLATE_HANDOVER_SUMMARY', '');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Webhook : renvois de Meta dédoublonnés', () => {
  it('le même message reçu deux fois ne reçoit qu’une seule réponse', async () => {
    const first = await whatsappService.processWebhookPayload(inboundPayload('wamid.in-1', 'AIDE'));
    const second = await whatsappService.processWebhookPayload(inboundPayload('wamid.in-1', 'AIDE'));

    expect(first).toMatchObject({ processedMessages: 1, duplicateMessages: 0 });
    expect(second).toMatchObject({ processedMessages: 0, duplicateMessages: 1, results: [] });
    // Une seule réponse automatique journalisée
    expect(rpcCalls('record_whatsapp_outbound')).toHaveLength(1);
  });

  it('deux messages différents sont traités tous les deux', async () => {
    await whatsappService.processWebhookPayload(inboundPayload('wamid.in-a', 'AIDE'));
    const summary = await whatsappService.processWebhookPayload(inboundPayload('wamid.in-b', 'STATUT'));
    expect(summary.processedMessages).toBe(1);
    expect(rpcCalls('record_whatsapp_outbound')).toHaveLength(2);
  });
});

describe('Accusés de réception', () => {
  it('statut enregistré par record_whatsapp_status (READ distinct de DELIVERED), audit_logs jamais réécrit', async () => {
    await whatsappService.handleStatusUpdate({ messageId: 'wamid.out-1', status: 'read', recipientId: '212612345678', timestamp: '1729141500' });
    expect(rpcCalls('record_whatsapp_status')[0].payload).toMatchObject({ p_wamid: 'wamid.out-1', p_status: 'READ' });
    expect(calls.filter((call) => call.table === 'audit_logs' && call.op === 'update')).toHaveLength(0);
  });

  it('statut inconnu ignoré', async () => {
    expect(await whatsappService.handleStatusUpdate({ messageId: 'wamid.out-1', status: 'deleted' as never, recipientId: '', timestamp: '' })).toBeNull();
    expect(rpcCalls('record_whatsapp_status')).toHaveLength(0);
  });
});

describe('Envois hors de la fenêtre de 24 h', () => {
  function configureMeta() {
    vi.stubEnv('WHATSAPP_API_TOKEN', 'test-token-0123456789');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '1234567890');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: 'wamid.real-1' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }
  const handover = () =>
    whatsappService.sendHandoverSummary(booking, { type: 'RETURN', mileage: 42650, fuelLevel: 'FULL', depositStatus: 'Restituée intégralement' });

  it('fenêtre fermée et aucun modèle : rien n’est envoyé (SKIPPED, jamais présenté comme envoyé)', async () => {
    const fetchMock = configureMeta();
    const result = await handover();
    expect(result).toMatchObject({ success: false, status: 'SKIPPED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fenêtre fermée avec modèle configuré : envoi du modèle', async () => {
    const fetchMock = configureMeta();
    vi.stubEnv('WHATSAPP_TEMPLATE_HANDOVER_SUMMARY', 'clickdrive_etat_des_lieux');
    const result = await handover();
    expect(result).toMatchObject({ success: true, status: 'SENT', templateName: 'clickdrive_etat_des_lieux' });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.type).toBe('template');
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      'Client',
      'CD-2026-123456',
      'restitution',
      `${(42650).toLocaleString('fr-FR')} km`,
      'FULL',
      'Restituée intégralement',
    ]);
  });

  it('fenêtre ouverte (client a écrit récemment) : texte libre', async () => {
    const fetchMock = configureMeta();
    inboundWithinWindow = true;
    const result = await handover();
    expect(result).toMatchObject({ success: true, status: 'SENT' });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.type).toBe('text');
  });

  it('chaque envoi est journalisé et attendu (aucune écriture perdue en fin de requête)', async () => {
    configureMeta();
    vi.stubEnv('WHATSAPP_TEMPLATE_HANDOVER_SUMMARY', 'clickdrive_etat_des_lieux');
    await handover();
    expect(rpcCalls('record_whatsapp_outbound')[0].payload).toMatchObject({
      p_wamid: 'wamid.real-1',
      p_status: 'SENT',
      p_message_type: 'TEMPLATE',
      p_booking_id: booking.id,
    });
  });
});
