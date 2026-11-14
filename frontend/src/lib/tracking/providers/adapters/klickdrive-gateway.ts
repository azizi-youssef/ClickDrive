import { createHmac, timingSafeEqual } from 'node:crypto';
import { gatewayEnvelopeSchema, gatewayEventSchema, toIngestPayload } from '../../schemas';
import type {
  ParseOutcome,
  ParsedEvent,
  TrackingProviderAdapter,
  VerificationInput,
  VerificationResult,
} from '../provider.interface';

/**
 * Passerelle « klickdrive-gateway » — contrat d'ingestion NORMALISÉ de ClickDrive (version 1).
 *
 * Ce n'est pas le protocole d'un constructeur : c'est le contrat que doit produire tout émetteur
 * (connecteur propre à un fournisseur, passerelle de l'agence, service d'intégration) pour livrer des
 * positions. Il est entièrement défini et testé ici. Aucune position n'est inventée : sans émetteur
 * réel configuré avec le secret, rien n'arrive.
 *
 *   POST /api/webhooks/tracking/klickdrive-gateway
 *   Content-Type: application/json
 *   X-ClickDrive-Signature: t=<secondes Unix>,v1=<HMAC-SHA256 hex>
 *   signature = HMAC_SHA256(secret, `${t}.${corpsBrut}`)      (plusieurs v1= acceptés : rotation de secret)
 *
 *   { "events": [ { "device_id": "...", "event_id": "...", "recorded_at": "2026-11-14T10:00:00Z",
 *                   "latitude": 35.1688, "longitude": -2.9335, "speed_kmh": 42, "heading_deg": 90,
 *                   "ignition": true, ... } ] }       (100 événements au plus)
 *
 * Protection contre le rejeu : horodatage signé (tolérance 5 min dans le passé, 1 min dans le futur) ;
 * un rejeu dans la fenêtre est sans effet (déduplication par `event_id` ou empreinte en base).
 */

export const SIGNATURE_HEADER = 'x-clickdrive-signature';
export const SIGNATURE_PAST_TOLERANCE_S = 300;
export const SIGNATURE_FUTURE_TOLERANCE_S = 60;

const HEX_SHA256 = /^[0-9a-f]{64}$/;

export function signGatewayPayload(secret: string, timestampSeconds: number, rawBody: string): string {
  const digest = createHmac('sha256', secret).update(`${timestampSeconds}.${rawBody}`).digest('hex');
  return `t=${timestampSeconds},v1=${digest}`;
}

function equalHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function verify({ rawBody, headers, now, secrets }: VerificationInput): VerificationResult {
  const header = headers.get(SIGNATURE_HEADER);
  if (!header) return { ok: false, reason: 'missing_signature' };

  let timestamp: number | null = null;
  const candidates: string[] = [];
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 0) return { ok: false, reason: 'malformed_signature' };
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 't' && /^\d{9,12}$/.test(value)) timestamp = Number(value);
    else if (key === 'v1') candidates.push(value);
  }
  if (timestamp === null || candidates.length === 0 || candidates.length > 4 || candidates.some((c) => !HEX_SHA256.test(c))) {
    return { ok: false, reason: 'malformed_signature' };
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (nowSeconds - timestamp > SIGNATURE_PAST_TOLERANCE_S || timestamp - nowSeconds > SIGNATURE_FUTURE_TOLERANCE_S) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  // Signature vérifiée avant toute lecture du JSON ; comparaison en temps constant pour chaque secret
  let valid = false;
  for (const secret of secrets) {
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    for (const candidate of candidates) {
      if (equalHex(expected, candidate)) valid = true;
    }
  }
  return valid ? { ok: true } : { ok: false, reason: 'invalid_signature' };
}

function parseDelivery(rawBody: string): ParseOutcome {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  const envelope = gatewayEnvelopeSchema.safeParse(json);
  if (!envelope.success) return { ok: false, reason: 'invalid_envelope' };

  const events: ParsedEvent[] = [];
  const rejected: { index: number; reason: string }[] = [];
  envelope.data.events.forEach((candidate, index) => {
    const parsed = gatewayEventSchema.safeParse(candidate);
    if (!parsed.success) {
      rejected.push({ index, reason: 'invalid_event' });
      return;
    }
    events.push({ externalDeviceId: parsed.data.device_id, event: toIngestPayload(parsed.data) });
  });
  return { ok: true, events, rejected };
}

export const klickdriveGatewayAdapter: TrackingProviderAdapter = {
  id: 'klickdrive-gateway',
  displayName: 'Passerelle ClickDrive (contrat normalisé v1)',
  status: 'available',
  description:
    'Contrat d’ingestion normalisé et signé (HMAC-SHA256). À utiliser avec un connecteur ou une passerelle qui traduit les messages du fournisseur du boîtier vers ce contrat.',
  // Aucune hypothèse sur le matériel : les capacités réelles (contact, sabotage…) sont constatées à la réception
  capabilities: { ignition: true, tamper: true, powerStatus: true, odometer: true, accuracy: true },
  secretEnvVar: 'TRACKING_WEBHOOK_SECRET_KLICKDRIVE_GATEWAY',
  verifyRequest: verify,
  parseDelivery,
};
