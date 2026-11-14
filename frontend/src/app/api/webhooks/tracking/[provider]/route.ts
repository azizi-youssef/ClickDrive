import { NextRequest, NextResponse } from 'next/server';
import { processTrackingWebhook } from '@/lib/tracking/webhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RouteContext = { params: Promise<{ provider: string }> };

/**
 * POST /api/webhooks/tracking/[provider] — ingestion des positions d'un fournisseur GPS.
 *
 * Sécurité : fournisseur connu, Content-Type JSON, corps ≤ 256 Ko (plafond réel), limitation de débit,
 * secret serveur obligatoire (503 sinon), signature HMAC + horodatage signé (401), JSON strict (400/422),
 * appareil résolu côté serveur (agency_id / vehicle_id de la charge utile ignorés), ingestion idempotente.
 * Contrat détaillé : docs/gps-tracking.md.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { provider } = await context.params;
  return processTrackingWebhook(request, provider);
}

/** Les autres méthodes ne sont pas prises en charge (aucune vérification d'URL de type challenge) */
export async function GET() {
  return NextResponse.json({ success: false, error: 'Méthode non autorisée.' }, { status: 405, headers: { Allow: 'POST' } });
}
