import { after, NextRequest, NextResponse } from 'next/server';
import { whatsappService } from '@/lib/services';

export const dynamic = 'force-dynamic';

/**
 * ========================================================================
 * Webhook WhatsApp Business (Meta Graph API)
 * 
 * GET  : Vérification de l'URL du webhook par Meta (hub.challenge)
 * POST : Réception des messages entrants (commandes AIDE / STATUT / ANNULER, sans modification
 *        de réservation) et des accusés de réception/livraison (sent/delivered/read/failed).
 *        Réponse 200 immédiate, traitement après la réponse : Meta renvoie un webhook trop lent,
 *        et les renvois sont dédoublonnés par identifiant de message (whatsapp_messages).
 * ========================================================================
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifiedChallenge = whatsappService.verifyWebhook(mode, token, challenge);

    if (verifiedChallenge) {
      console.log('[WhatsAppWebhook] Vérification du webhook Meta réussie.');
      return new Response(verifiedChallenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    console.warn('[WhatsAppWebhook] Échec de vérification du webhook Meta (token invalide ou mode incorrect).');
    return new Response('Vérification du webhook échouée.', { status: 403 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erreur de vérification';
    return new Response(errorMsg, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!whatsappService.verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    console.warn('[WhatsAppWebhook] Signature X-Hub-Signature-256 invalide ou absente. Requête rejetée.');
    return NextResponse.json({ success: false, error: 'Signature invalide' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Corps illisible : rien à rejouer, Meta ne doit pas renvoyer
    console.error('[WhatsAppWebhook] Corps JSON invalide.');
    return NextResponse.json({ success: false, error: 'Corps JSON invalide' }, { status: 200 });
  }

  // Accusé immédiat ; le traitement (réponses, statuts) se fait après la réponse HTTP
  after(async () => {
    try {
      const summary = await whatsappService.processWebhookPayload(body);
      if (summary.duplicateMessages) {
        console.log(`[WhatsAppWebhook] ${summary.duplicateMessages} message(s) déjà traité(s), ignoré(s).`);
      }
    } catch (err: unknown) {
      console.error('[WhatsAppWebhook] Erreur lors du traitement:', err instanceof Error ? err.message : err);
    }
  });

  return NextResponse.json({ success: true, received: true });
}
