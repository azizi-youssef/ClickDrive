import test from 'node:test';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { whatsappService } from '../lib/services/whatsapp.service';

test('1. Webhook WhatsApp — Vérification du jeton Meta (GET handshake hub.challenge)', () => {
  const challenge = 'meta_test_challenge_123456';
  const defaultToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'klickdrive_whatsapp_secure_webhook_token_2026';

  // Cas valide : mode subscribe + bon jeton
  const validResult = whatsappService.verifyWebhook('subscribe', defaultToken, challenge);
  assert.equal(validResult, challenge, 'Le challenge doit être retourné tel quel si le jeton est valide');

  // Cas invalide : mauvais jeton
  const invalidTokenResult = whatsappService.verifyWebhook('subscribe', 'wrong_token', challenge);
  assert.equal(invalidTokenResult, null, 'Doit refuser si le jeton ne correspond pas');

  // Cas invalide : mauvais mode
  const invalidModeResult = whatsappService.verifyWebhook('unsubscribe', defaultToken, challenge);
  assert.equal(invalidModeResult, null, 'Doit refuser si le mode n’est pas "subscribe"');
});

test('2. Webhook WhatsApp — Traitement d’un message entrant client « OUI » (aucune confirmation)', async () => {
  const metaWebhookPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '212600000000',
                phone_number_id: '123456789',
              },
              contacts: [
                {
                  profile: { name: 'Youssef Client' },
                  wa_id: '212612345678',
                },
              ],
              messages: [
                {
                  from: '212612345678',
                  id: 'wamid.HBgLMjEyNjEyMzQ1Njc4FQIAEhgg...',
                  timestamp: '1729141200',
                  text: { body: 'OUI CD-2026-TEST42' },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const processSummary = await whatsappService.processWebhookPayload(metaWebhookPayload);
  assert.equal(processSummary.processedMessages, 1, 'Un message doit être traité');
  assert.equal(processSummary.results.length, 1);

  const result = processSummary.results[0];
  // « OUI » n'est pas une commande : le client ne peut pas confirmer lui-même sa réservation
  assert.equal(result.intent, 'DEFAULT', '« OUI » ne doit déclencher aucune action');
  assert.equal(result.bookingRef, undefined, "Sans dossier vérifié, aucune référence n'est reprise");
  assert.ok(result.replySent?.includes('ne modifie pas vos réservations'), 'Le menu rappelle que le canal ne modifie rien');
  assert.ok(!/confirm/i.test(result.actionTaken), 'Aucune confirmation ne doit être annoncée');
});

test('3. Webhook WhatsApp — « ANNULER » oriente vers le bon canal sans annuler', async () => {
  const result = await whatsappService.handleInboundMessage({
    from: '0612345678',
    messageId: 'wamid.test_cancel_1',
    timestamp: '1729141300',
    type: 'text',
    body: 'ANNULER CD-2026-123456',
  });

  assert.equal(result.intent, 'CANCEL_REQUEST');
  assert.ok(result.replySent?.includes("n'a pas été modifiée"), 'La réponse ne doit jamais annoncer une annulation');
});

test('4. Webhook WhatsApp — Traitement d’un message entrant client « AIDE » (Conciergerie / RDV)', async () => {
  const result = await whatsappService.handleInboundMessage({
    from: '0612345678',
    messageId: 'wamid.test_help_1',
    timestamp: '1729141400',
    type: 'text',
    body: 'AIDE',
  });

  assert.equal(result.intent, 'HELP', 'L’intention détectée doit être HELP');
  assert.ok(result.replySent && result.replySent.includes('Assistance ClickDrive'), 'La réponse automatique doit fournir le guide conciergerie');
});

test('5. Webhook WhatsApp — Accusés de réception sans base : ignorés sans erreur', async () => {
  // Sans clé service-role (tests hors base), aucun statut n'est enregistré et rien n'est levé
  const recorded = await whatsappService.handleStatusUpdate({
    messageId: 'wamid.status_test',
    status: 'delivered',
    recipientId: '212612345678',
    timestamp: '1729141500',
  });
  assert.equal(recorded, null);

  // Statut inconnu : ignoré
  const unknown = await whatsappService.handleStatusUpdate({
    messageId: 'wamid.status_test',
    status: 'deleted' as never,
    recipientId: '212612345678',
    timestamp: '1729141500',
  });
  assert.equal(unknown, null);
});

test('Webhook WhatsApp — Signature X-Hub-Signature-256 (HMAC du corps brut)', () => {
  const previousSecret = process.env.WHATSAPP_APP_SECRET;
  process.env.WHATSAPP_APP_SECRET = 'test_app_secret';
  try {
    const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = `sha256=${createHmac('sha256', 'test_app_secret').update(rawBody).digest('hex')}`;

    assert.equal(whatsappService.verifyWebhookSignature(rawBody, signature), true, 'Signature valide acceptée');
    assert.equal(whatsappService.verifyWebhookSignature(`${rawBody} `, signature), false, 'Corps modifié refusé');
    assert.equal(whatsappService.verifyWebhookSignature(rawBody, 'sha256=deadbeef'), false, 'Signature fausse refusée');
    assert.equal(whatsappService.verifyWebhookSignature(rawBody, null), false, 'Signature absente refusée');
  } finally {
    if (previousSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = previousSecret;
  }
});
