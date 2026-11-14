import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { TrackingError } from './errors';
import { MAX_BODY_BYTES, processTrackingWebhook, type WebhookDeps } from './webhook';
import { SIGNATURE_HEADER, signGatewayPayload } from './providers/adapters/klickdrive-gateway';
import type { IngestResult } from './types';

vi.mock('@/lib/rate-limit', () => ({
  checkDistributedRateLimit: async () => null,
  checkRateLimit: () => ({ ok: true }),
  clientIpFromRequest: () => '203.0.113.7',
}));
vi.mock('@/lib/supabase/privileged', () => ({ requireServiceRoleClient: async () => ({}) }));

const SECRET = 'secret-de-test-tres-long-0123456789abcdef';
const NOW = new Date('2026-11-14T10:00:00.000Z');
const nowSeconds = Math.floor(NOW.getTime() / 1000);
const URL_ = 'https://clickdrive.ma/api/webhooks/tracking/klickdrive-gateway';

function makeDeps(overrides: Partial<WebhookDeps> = {}) {
  const ingest = vi.fn<WebhookDeps['ingest']>(async () => ({ status: 'accepted', quality: 'OK', late: false }));
  const recordFailure = vi.fn<WebhookDeps['recordFailure']>(async () => undefined);
  const deps: WebhookDeps = {
    now: () => NOW,
    env: { TRACKING_WEBHOOK_SECRET_KLICKDRIVE_GATEWAY: SECRET },
    rateLimit: async () => ({ ok: true }),
    ingest,
    recordFailure,
    ...overrides,
  };
  return { deps, ingest, recordFailure };
}

const event = (overrides: Record<string, unknown> = {}) => ({
  device_id: 'DEV-1',
  event_id: 'evt-1',
  recorded_at: '2026-11-14T09:59:50Z',
  latitude: 35.1688,
  longitude: -2.9335,
  speed_kmh: 40,
  ...overrides,
});

function signedRequest(body: string, options: { secret?: string; timestamp?: number; contentType?: string; signature?: string | null } = {}) {
  const headers: Record<string, string> = { 'Content-Type': options.contentType ?? 'application/json' };
  const signature = options.signature === undefined ? signGatewayPayload(options.secret ?? SECRET, options.timestamp ?? nowSeconds, body) : options.signature;
  if (signature !== null) headers[SIGNATURE_HEADER] = signature;
  return new NextRequest(URL_, { method: 'POST', headers, body });
}

const post = (request: NextRequest, deps: WebhookDeps, provider = 'klickdrive-gateway') => processTrackingWebhook(request, provider, deps);

describe('webhook de suivi — rejets avant toute lecture de données', () => {
  it('fournisseur inconnu : 404, fournisseur non intégré : 501 (aucune connectivité simulée)', async () => {
    const { deps, ingest } = makeDeps();
    expect((await post(signedRequest('{}'), deps, 'inconnu')).status).toBe(404);
    const pending = await post(signedRequest('{}'), deps, 'traccar');
    expect(pending.status).toBe(501);
    expect(await pending.json()).toMatchObject({ success: false, code: 'PROVIDER_INTEGRATION_PENDING' });
    expect(ingest).not.toHaveBeenCalled();
  });

  it('Content-Type autre que JSON : 415', async () => {
    const { deps, ingest } = makeDeps();
    expect((await post(signedRequest('{}', { contentType: 'text/plain' }), deps)).status).toBe(415);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('corps trop volumineux : 413 (en-tête Content-Length ET flux réel), rien n’est ingéré', async () => {
    const { deps, ingest } = makeDeps();
    const big = JSON.stringify({ events: [event()], padding: 'x'.repeat(MAX_BODY_BYTES + 10) });
    expect((await post(signedRequest(big), deps)).status).toBe(413);

    // Content-Length mensonger : le plafond s'applique au flux lu
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const chunk = new TextEncoder().encode('x'.repeat(64 * 1024));
        for (let i = 0; i < 6; i += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    const lying = new Request(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '100' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await post(lying as NextRequest, deps)).status).toBe(413);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('limitation de débit : 429 avec Retry-After ; limiteur indisponible : 503 (fail-closed)', async () => {
    const limited = makeDeps({ rateLimit: async () => ({ ok: false, retryAfterSec: 17 }) });
    const response = await post(signedRequest('{}'), limited.deps);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('17');

    const broken = makeDeps({ rateLimit: async () => { throw new Error('rpc down'); } });
    expect((await post(signedRequest('{}'), broken.deps)).status).toBe(503);
    expect(limited.ingest).not.toHaveBeenCalled();
    expect(broken.ingest).not.toHaveBeenCalled();
  });

  it('secret non configuré ou trop court : 503, on n’accepte JAMAIS une livraison non signée', async () => {
    for (const env of [{}, { TRACKING_WEBHOOK_SECRET_KLICKDRIVE_GATEWAY: 'court' }]) {
      const { deps, ingest } = makeDeps({ env });
      const body = JSON.stringify({ events: [event()] });
      const response = await post(signedRequest(body, { signature: null }), deps);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
      expect(ingest).not.toHaveBeenCalled();
    }
  });
});

describe('webhook de suivi — authentification', () => {
  const body = JSON.stringify({ events: [event()] });

  it('signature absente, fausse ou d’un autre secret : 401 sans détail, rien n’est ingéré', async () => {
    for (const request of [
      signedRequest(body, { signature: null }),
      signedRequest(body, { signature: `t=${nowSeconds},v1=${'0'.repeat(64)}` }),
      signedRequest(body, { secret: 'un-autre-secret-0123456789abcdef-0123456' }),
    ]) {
      const { deps, ingest, recordFailure } = makeDeps();
      const response = await post(request, deps);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ success: false, error: 'Signature invalide.' });
      expect(ingest).not.toHaveBeenCalled();
      expect(recordFailure).not.toHaveBeenCalled();
    }
  });

  it('rejeu d’une livraison ancienne (horodatage signé hors tolérance) : 401', async () => {
    const { deps, ingest } = makeDeps();
    expect((await post(signedRequest(body, { timestamp: nowSeconds - 3600 }), deps)).status).toBe(401);
    expect((await post(signedRequest(body, { timestamp: nowSeconds + 3600 }), deps)).status).toBe(401);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('un corps modifié après signature est refusé', async () => {
    const { deps, ingest } = makeDeps();
    const signature = signGatewayPayload(SECRET, nowSeconds, body);
    const tampered = body.replace('35.1688', '36.0000');
    expect((await post(signedRequest(tampered, { signature }), deps)).status).toBe(401);
    expect(ingest).not.toHaveBeenCalled();
  });
});

describe('webhook de suivi — traitement des événements', () => {
  it('livraison valide : événement normalisé transmis, appareil identifié, réponse 200 avec compteurs', async () => {
    const { deps, ingest } = makeDeps();
    const response = await post(signedRequest(JSON.stringify({ events: [event()] })), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, received: 1, accepted: 1, duplicate: 0, rejected: 0 });
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledWith('klickdrive-gateway', 'DEV-1', {
      event_id: 'evt-1',
      recorded_at: '2026-11-14T09:59:50Z',
      latitude: 35.1688,
      longitude: -2.9335,
      speed_kmh: 40,
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('agency_id et vehicle_id de la charge utile ne sont jamais transmis à l’ingestion', async () => {
    const { deps, ingest } = makeDeps();
    const hostile = event({ agency_id: '10000000-0000-4000-8000-00000000000b', vehicle_id: '20000000-0000-4000-8000-00000000000b' });
    await post(signedRequest(JSON.stringify({ events: [hostile] })), deps);
    const forwarded = JSON.stringify(ingest.mock.calls);
    expect(forwarded).not.toMatch(/agency_id|vehicle_id|10000000/);
  });

  it('appareil inconnu : comptabilisé et journalisé pour le monitoring, sans erreur pour le fournisseur', async () => {
    const { deps, recordFailure } = makeDeps({ ingest: async () => ({ status: 'unknown_device' }) });
    const response = await post(signedRequest(JSON.stringify({ events: [event()] })), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: 0, unknown_device: 1 });
    expect(recordFailure).toHaveBeenCalledWith('klickdrive-gateway', 'unknown_device', 'DEV-1');
  });

  it('doublons, événements en retard, boîtiers en pause ou non affectés : comptés, jamais en erreur', async () => {
    const results: IngestResult[] = [
      { status: 'duplicate' },
      { status: 'accepted', quality: 'LATE', late: true },
      { status: 'disabled' },
      { status: 'unassigned' },
    ];
    const ingest = vi.fn<WebhookDeps['ingest']>(async () => results.shift()!);
    const { deps } = makeDeps({ ingest });
    const events = ['a', 'b', 'c', 'd'].map((id) => event({ event_id: id }));
    const response = await post(signedRequest(JSON.stringify({ events })), deps);
    expect(await response.json()).toMatchObject({ received: 4, accepted: 1, duplicate: 1, late: 1, disabled: 1, unassigned: 1 });
  });

  it('événement rejeté par la base (coordonnées, horodatage) : compté et journalisé', async () => {
    const { deps, recordFailure } = makeDeps({ ingest: async () => ({ status: 'rejected', reason: 'invalid_coordinates' }) });
    const response = await post(signedRequest(JSON.stringify({ events: [event()] })), deps);
    expect(await response.json()).toMatchObject({ rejected: 1, accepted: 0 });
    expect(recordFailure).toHaveBeenCalledWith('klickdrive-gateway', 'invalid_coordinates', 'DEV-1');
  });

  it('charges utiles mal formées : JSON illisible 400, enveloppe invalide 422, événements invalides rejetés sans bloquer les autres', async () => {
    const { deps, ingest } = makeDeps();
    expect((await post(signedRequest('{pas du json'), deps)).status).toBe(400);
    expect((await post(signedRequest(JSON.stringify({ events: [] })), deps)).status).toBe(422);
    const mixed = await post(signedRequest(JSON.stringify({ events: [event(), event({ latitude: 400 }), 'x'] })), deps);
    expect(await mixed.json()).toMatchObject({ received: 3, accepted: 1, rejected: 2 });
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('erreur fournisseur / infrastructure : 503 + Retry-After pour déclencher une nouvelle livraison (idempotente)', async () => {
    const { deps } = makeDeps({ ingest: async () => { throw new TrackingError(500, 'INTERNAL', 'x'); } });
    const response = await post(signedRequest(JSON.stringify({ events: [event()] })), deps);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('30');
  });

  it('la réponse ne renvoie ni coordonnées ni identifiants d’agence ou de véhicule', async () => {
    const { deps } = makeDeps();
    const response = await post(signedRequest(JSON.stringify({ events: [event()] })), deps);
    const text = JSON.stringify(await response.json());
    expect(text).not.toMatch(/35\.1688|-2\.9335|agency|vehicle|DEV-1/);
  });
});
