import { describe, expect, it } from 'vitest';
import {
  SIGNATURE_HEADER,
  klickdriveGatewayAdapter as adapter,
  signGatewayPayload,
} from './adapters/klickdrive-gateway';
import { ProviderNotImplementedError } from './provider.interface';
import { getProvider, getProviderSecrets, isRegistrationAllowed, listProviders, publicProviders } from './provider.factory';

const SECRET = 'secret-de-test-tres-long-0123456789abcdef';
const OLD_SECRET = 'ancien-secret-de-test-0123456789abcdef-x';
const NOW = new Date('2026-11-14T10:00:00.000Z');
const nowSeconds = Math.floor(NOW.getTime() / 1000);

const body = JSON.stringify({
  events: [{ device_id: 'DEV-1', event_id: 'e1', recorded_at: '2026-11-14T09:59:30Z', latitude: 35.1688, longitude: -2.9335, speed_kmh: 42 }],
});

const headers = (value: string | null) => new Headers(value === null ? {} : { [SIGNATURE_HEADER]: value });
const verify = (signature: string | null, secrets: string[] = [SECRET], now = NOW, raw = body) =>
  adapter.verifyRequest({ rawBody: raw, headers: headers(signature), now, secrets });

describe('klickdrive-gateway — signature', () => {
  it('signature valide acceptée', () => {
    expect(verify(signGatewayPayload(SECRET, nowSeconds, body))).toEqual({ ok: true });
  });

  it('signature absente, mal formée ou fausse refusée', () => {
    expect(verify(null)).toEqual({ ok: false, reason: 'missing_signature' });
    expect(verify('pas une signature')).toEqual({ ok: false, reason: 'malformed_signature' });
    expect(verify(`t=${nowSeconds}`)).toEqual({ ok: false, reason: 'malformed_signature' });
    expect(verify(`t=${nowSeconds},v1=abc`)).toEqual({ ok: false, reason: 'malformed_signature' });
    expect(verify(`t=abc,v1=${'a'.repeat(64)}`)).toEqual({ ok: false, reason: 'malformed_signature' });
    expect(verify(`t=${nowSeconds},v1=${'a'.repeat(64)}`)).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('un secret différent est refusé', () => {
    expect(verify(signGatewayPayload('un-autre-secret-0123456789abcdef-0123', nowSeconds, body))).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('toute modification du corps invalide la signature (pas de JSON reformaté)', () => {
    const signature = signGatewayPayload(SECRET, nowSeconds, body);
    expect(verify(signature, [SECRET], NOW, body.replace('42', '43'))).toEqual({ ok: false, reason: 'invalid_signature' });
    expect(verify(signature, [SECRET], NOW, `${body} `)).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('horodatage signé : tolérance 5 min dans le passé, 1 min dans le futur (anti-rejeu)', () => {
    expect(verify(signGatewayPayload(SECRET, nowSeconds - 299, body))).toEqual({ ok: true });
    expect(verify(signGatewayPayload(SECRET, nowSeconds - 301, body))).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
    expect(verify(signGatewayPayload(SECRET, nowSeconds + 59, body))).toEqual({ ok: true });
    expect(verify(signGatewayPayload(SECRET, nowSeconds + 61, body))).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
    // Un horodatage ancien dont la signature est correcte reste refusé : le rejeu hors fenêtre est impossible
    expect(verify(signGatewayPayload(SECRET, nowSeconds - 86_400, body))).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
  });

  it('falsifier l’horodatage sans le secret échoue (l’horodatage fait partie du message signé)', () => {
    const old = signGatewayPayload(SECRET, nowSeconds - 3600, body);
    const forged = old.replace(`t=${nowSeconds - 3600}`, `t=${nowSeconds}`);
    expect(verify(forged)).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('rotation de secret : l’ancien ou le nouveau secret est accepté, dans les deux sens', () => {
    expect(verify(signGatewayPayload(OLD_SECRET, nowSeconds, body), [SECRET, OLD_SECRET])).toEqual({ ok: true });
    expect(verify(signGatewayPayload(SECRET, nowSeconds, body), [SECRET, OLD_SECRET])).toEqual({ ok: true });
    const dual = `${signGatewayPayload(OLD_SECRET, nowSeconds, body)},v1=${signGatewayPayload(SECRET, nowSeconds, body).split('v1=')[1]}`;
    expect(verify(dual, [SECRET])).toEqual({ ok: true });
  });
});

describe('klickdrive-gateway — normalisation', () => {
  const event = (overrides: Record<string, unknown> = {}) => ({ device_id: 'DEV-1', recorded_at: '2026-11-14T09:59:30Z', latitude: 35.1, longitude: -2.9, ...overrides });
  const parse = (events: unknown[]) => adapter.parseDelivery(JSON.stringify({ events }));

  it('événement valide : appareil identifié et charge utile normalisée', () => {
    const outcome = parse([event({ speed_kmh: 30, ignition: true, event_id: 'abc' })]);
    expect(outcome).toMatchObject({ ok: true, rejected: [] });
    if (!outcome.ok) return;
    expect(outcome.events).toHaveLength(1);
    expect(outcome.events[0]).toEqual({
      externalDeviceId: 'DEV-1',
      event: { event_id: 'abc', recorded_at: '2026-11-14T09:59:30Z', latitude: 35.1, longitude: -2.9, speed_kmh: 30, ignition: true },
    });
  });

  it('agency_id / vehicle_id / champs inconnus de la charge utile sont supprimés (jamais transmis)', () => {
    const outcome = parse([event({ agency_id: '10000000-0000-4000-8000-00000000000b', vehicle_id: '20000000-0000-4000-8000-00000000000b', role: 'SUPER_ADMIN', device_id_override: 'x' })]);
    if (!outcome.ok) throw new Error('attendu : ok');
    const forwarded = JSON.stringify(outcome.events[0]!.event);
    expect(forwarded).not.toMatch(/agency_id|vehicle_id|role|override|10000000/);
  });

  it('événements invalides rejetés individuellement sans bloquer les autres', () => {
    const outcome = parse([
      event(),
      event({ latitude: 95 }),
      event({ latitude: 0, longitude: 0 }),
      event({ longitude: undefined }), // longitude manquante
      event({ recorded_at: 'hier' }),
      event({ device_id: 'avec espace' }),
      event({ speed_kmh: -5 }),
      { device_id: 'DEV-2', recorded_at: '2026-11-14T09:59:30Z' }, // ni position ni signal
      null,
      event({ device_id: 'DEV-3', tamper: true, latitude: undefined, longitude: undefined }), // signal sans position : valide
    ]);
    if (!outcome.ok) throw new Error('attendu : ok');
    expect(outcome.events.map((e) => e.externalDeviceId)).toEqual(['DEV-1', 'DEV-3']);
    expect(outcome.rejected.map((r) => r.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('enveloppe invalide : JSON illisible, tableau vide, plus de 100 événements', () => {
    expect(adapter.parseDelivery('{pas du json')).toEqual({ ok: false, reason: 'invalid_json' });
    expect(adapter.parseDelivery('[]')).toEqual({ ok: false, reason: 'invalid_envelope' });
    expect(adapter.parseDelivery(JSON.stringify({ events: [] }))).toEqual({ ok: false, reason: 'invalid_envelope' });
    expect(adapter.parseDelivery(JSON.stringify({ events: Array.from({ length: 101 }, () => event()) }))).toEqual({ ok: false, reason: 'invalid_envelope' });
    expect(adapter.parseDelivery(JSON.stringify({ events: 'x' }))).toEqual({ ok: false, reason: 'invalid_envelope' });
  });
});

describe('registre des fournisseurs', () => {
  it('un seul adaptateur réel ; les autres sont explicitement « pending » et ne simulent rien', () => {
    const statuses = Object.fromEntries(listProviders().map((p) => [p.id, p.status]));
    expect(statuses).toEqual({ 'klickdrive-gateway': 'available', traccar: 'pending', flespi: 'pending' });
    for (const id of ['traccar', 'flespi']) {
      const pending = getProvider(id)!;
      expect(pending.pendingReason).toBeTruthy();
      expect(() => pending.parseDelivery('{}')).toThrow(ProviderNotImplementedError);
      expect(() => pending.verifyRequest({ rawBody: '', headers: new Headers(), now: NOW, secrets: [SECRET] })).toThrow(ProviderNotImplementedError);
    }
  });

  it('l’enregistrement d’un boîtier n’est autorisé que pour un fournisseur intégré', () => {
    expect(isRegistrationAllowed('klickdrive-gateway')).toBe(true);
    expect(isRegistrationAllowed('traccar')).toBe(false);
    expect(isRegistrationAllowed('inconnu')).toBe(false);
    expect(getProvider('inconnu')).toBeNull();
  });

  it('les secrets viennent de l’environnement serveur : absent ou trop court = non configuré (fail-closed)', () => {
    expect(getProviderSecrets(adapter, {})).toEqual([]);
    expect(getProviderSecrets(adapter, { TRACKING_WEBHOOK_SECRET_KLICKDRIVE_GATEWAY: 'court' })).toEqual([]);
    expect(getProviderSecrets(adapter, { TRACKING_WEBHOOK_SECRET_KLICKDRIVE_GATEWAY: SECRET })).toEqual([SECRET]);
    expect(getProviderSecrets(adapter, { TRACKING_WEBHOOK_SECRET_KLICKDRIVE_GATEWAY: `${SECRET}, ${OLD_SECRET}` })).toEqual([SECRET, OLD_SECRET]);
  });

  it('la description publique n’expose ni variable d’environnement ni secret', () => {
    const json = JSON.stringify(publicProviders());
    expect(json).not.toMatch(/TRACKING_WEBHOOK_SECRET|secretEnvVar/);
    expect(publicProviders().find((p) => p.id === 'traccar')).toMatchObject({ status: 'pending' });
  });
});
