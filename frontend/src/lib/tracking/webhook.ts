import { NextResponse } from 'next/server';
import { checkDistributedRateLimit, checkRateLimit, clientIpFromRequest, type RateLimitResult } from '@/lib/rate-limit';
import { ingestTrackingEvent, recordIngestFailure } from './location.service';
import { trackingLog } from './log';
import { getProvider, getProviderSecrets } from './providers/provider.factory';
import { ProviderError, type TrackingProviderAdapter } from './providers/provider.interface';
import { TrackingError } from './errors';
import type { IngestResult, NormalizedTrackingEvent } from './types';

/**
 * Pipeline d'ingestion du webhook /api/webhooks/tracking/[provider].
 *
 * Ordre volontaire (le moins coûteux d'abord, aucune donnée lue avant authentification) :
 *   fournisseur connu → taille → débit → secret configuré → signature + horodatage → JSON → événements.
 * Rien n'est accepté sans signature valide : si le secret est absent, la route répond 503 (fail-closed).
 */

export const MAX_BODY_BYTES = 256 * 1024;
export const WEBHOOK_RATE_LIMIT = { limit: 1200, windowMs: 60_000 } as const;

export interface WebhookDeps {
  now: () => Date;
  env: Record<string, string | undefined>;
  rateLimit: (key: string, limit: number, windowMs: number) => Promise<RateLimitResult>;
  ingest: (provider: string, deviceId: string, event: NormalizedTrackingEvent) => Promise<IngestResult>;
  recordFailure: (provider: string, reason: string, deviceRef?: string, detail?: string) => Promise<void>;
}

class RateLimiterUnavailableError extends Error {}

async function defaultRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const distributed = await checkDistributedRateLimit(key, limit, windowMs);
    if (distributed) return distributed;
  } catch {
    // Production : limiteur partagé indispensable (fail-closed). Le développement retombe sur la mémoire locale.
    if (process.env.NODE_ENV === 'production') throw new RateLimiterUnavailableError();
  }
  if (process.env.NODE_ENV === 'production') throw new RateLimiterUnavailableError();
  return checkRateLimit(key, limit, windowMs);
}

export const defaultWebhookDeps: WebhookDeps = {
  now: () => new Date(),
  env: process.env,
  rateLimit: defaultRateLimit,
  ingest: (provider, deviceId, event) => ingestTrackingEvent(provider, deviceId, event),
  recordFailure: (provider, reason, deviceRef, detail) => recordIngestFailure(provider, reason, deviceRef, detail),
};

function respond(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Lit le corps avec un plafond réel (l'en-tête Content-Length n'est pas digne de confiance) */
async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string | 'too_large'> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return 'too_large';
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return 'too_large';
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
}

export async function processTrackingWebhook(
  request: Request,
  providerId: string,
  deps: WebhookDeps = defaultWebhookDeps
): Promise<NextResponse> {
  const adapter: TrackingProviderAdapter | null = getProvider(providerId);
  if (!adapter) return respond(404, { success: false, error: 'Fournisseur inconnu.' });
  if (adapter.status === 'pending') {
    return respond(501, {
      success: false,
      code: 'PROVIDER_INTEGRATION_PENDING',
      error: 'L’intégration de ce fournisseur n’est pas encore disponible.',
    });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(contentType)) {
    return respond(415, { success: false, error: 'Content-Type application/json requis.' });
  }

  const rawBody = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (rawBody === 'too_large') {
    trackingLog('warn', 'webhook.rejected', { provider: providerId, reason: 'body_too_large' });
    return respond(413, { success: false, error: 'Requête trop volumineuse.' });
  }

  const ip = clientIpFromRequest(request);
  try {
    const limited = await deps.rateLimit(`tracking-webhook:${providerId}:${ip}`, WEBHOOK_RATE_LIMIT.limit, WEBHOOK_RATE_LIMIT.windowMs);
    if (!limited.ok) {
      trackingLog('warn', 'webhook.rejected', { provider: providerId, reason: 'rate_limited' });
      return respond(429, { success: false, error: 'Trop de requêtes.' }, { 'Retry-After': String(limited.retryAfterSec) });
    }
  } catch {
    trackingLog('error', 'webhook.rate_limiter_unavailable', { provider: providerId });
    return respond(503, { success: false, error: 'Service temporairement indisponible.' }, { 'Retry-After': '30' });
  }

  const secrets = getProviderSecrets(adapter, deps.env);
  if (secrets.length === 0) {
    trackingLog('error', 'webhook.secret_not_configured', { provider: providerId, env_var: adapter.secretEnvVar });
    return respond(503, { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'Fournisseur non configuré.' });
  }

  const verification = adapter.verifyRequest({ rawBody, headers: request.headers, now: deps.now(), secrets });
  if (!verification.ok) {
    // Raison journalisée seulement : la réponse ne dit pas pourquoi (aucune aide à un attaquant)
    trackingLog('warn', 'webhook.signature_rejected', { provider: providerId, reason: verification.reason });
    return respond(401, { success: false, error: 'Signature invalide.' });
  }

  let parsed;
  try {
    parsed = adapter.parseDelivery(rawBody);
  } catch (error) {
    if (error instanceof ProviderError && !error.retryable) return respond(422, { success: false, error: 'Charge utile non prise en charge.' });
    trackingLog('error', 'webhook.provider_error', { provider: providerId, message: error instanceof Error ? error.message : 'inconnue' });
    return respond(503, { success: false, error: 'Service temporairement indisponible.' }, { 'Retry-After': '30' });
  }
  if (!parsed.ok) {
    trackingLog('warn', 'webhook.malformed', { provider: providerId, reason: parsed.reason });
    return respond(parsed.reason === 'invalid_json' ? 400 : 422, {
      success: false,
      error: parsed.reason === 'invalid_json' ? 'Corps JSON invalide.' : 'Enveloppe d’événements invalide.',
    });
  }

  const counts = { accepted: 0, duplicate: 0, unknown_device: 0, unassigned: 0, disabled: 0, rejected: parsed.rejected.length, late: 0 };
  const results: { index: number; status: string; reason?: string }[] = parsed.rejected.map((r) => ({ index: r.index, status: 'rejected', reason: r.reason }));

  for (const [position, { externalDeviceId, event }] of parsed.events.entries()) {
    let result: IngestResult;
    try {
      result = await deps.ingest(providerId, externalDeviceId, event);
    } catch (error) {
      // Erreur d'infrastructure : le fournisseur doit rejouer (l'ingestion est idempotente, aucun doublon possible)
      const code = error instanceof TrackingError ? error.code : 'INTERNAL';
      trackingLog('error', 'webhook.ingest_failed', { provider: providerId, code });
      return respond(503, { success: false, error: 'Service temporairement indisponible.' }, { 'Retry-After': '30' });
    }
    results.push({ index: position, status: result.status, ...(result.reason ? { reason: result.reason } : {}) });
    switch (result.status) {
      case 'accepted':
        counts.accepted += 1;
        if (result.late) counts.late += 1;
        break;
      case 'duplicate':
        counts.duplicate += 1;
        break;
      case 'unknown_device':
        counts.unknown_device += 1;
        void deps.recordFailure(providerId, 'unknown_device', externalDeviceId);
        break;
      case 'unassigned':
        counts.unassigned += 1;
        break;
      case 'disabled':
        counts.disabled += 1;
        break;
      case 'rejected':
        counts.rejected += 1;
        void deps.recordFailure(providerId, result.reason ?? 'rejected', externalDeviceId);
        break;
    }
  }
  if (parsed.rejected.length > 0) void deps.recordFailure(providerId, 'invalid_event', undefined, `${parsed.rejected.length} événement(s) invalide(s)`);

  trackingLog('info', 'webhook.processed', { provider: providerId, received: parsed.events.length + parsed.rejected.length, ...counts });
  return respond(200, { success: true, received: parsed.events.length + parsed.rejected.length, ...counts, results });
}
