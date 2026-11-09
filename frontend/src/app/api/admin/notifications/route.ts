import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { whatsappService } from '@/lib/services';
import { z } from 'zod';

const broadcastSchema = z.object({
  recipientPhone: z.string().min(8, 'Le numéro de téléphone est requis'),
  message: z.string().min(5, 'Le message doit contenir au moins 5 caractères'),
  type: z.enum(['ALERT', 'INFO', 'MARKETING']).default('INFO'),
  bookingRef: z.string().optional(),
});

export async function GET() {
  const gate = await requirePlatformPermissionApi('agencies.read');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Base de données indisponible' }, { status: 503 });
  }

  try {
    // 1. Récupérer les logs récents depuis audit_logs
    const { data: dbLogs } = await supabase
      .from('audit_logs')
      .select('id, action, entity_id, agency_id, metadata, created_at')
      .in('action', [
        'WHATSAPP_MESSAGE_SENT',
        'WHATSAPP_MESSAGE_FAILED',
        'NOTIFICATION_SENT',
        'WHATSAPP_INBOUND_CONFIRMED',
        'WHATSAPP_INBOUND_CANCELLED',
        'WHATSAPP_INBOUND_MESSAGE',
      ])
      .order('created_at', { ascending: false })
      .limit(50);

    // 2. Récupérer les logs récents en mémoire du service WhatsApp
    const memoryLogs = whatsappService.getRecentLogs(50);

    // 3. Fusionner et dédupliquer
    const recentFeed = [
      ...memoryLogs.map((m) => ({
        id: m.id,
        channel: 'WHATSAPP' as const,
        messageId: m.messageId,
        recipient: m.recipientPhone,
        bookingRef: m.bookingRef || '—',
        status: m.status,
        type: m.type,
        snippet: String(m.payloadSummary?.snippet || m.payloadSummary?.body || 'Notification WhatsApp'),
        timestamp: m.sentAt,
      })),
      ...(dbLogs || []).map((db) => {
        const meta = (db.metadata as any) || {};
        const isInbound = db.action.startsWith('WHATSAPP_INBOUND');
        let mappedStatus = meta.status || (db.action.includes('FAILED') ? 'FAILED' : 'SENT');
        if (db.action === 'WHATSAPP_INBOUND_CONFIRMED') mappedStatus = 'CONFIRMED';
        else if (db.action === 'WHATSAPP_INBOUND_CANCELLED') mappedStatus = 'CANCELLED';
        else if (db.action === 'WHATSAPP_INBOUND_MESSAGE') mappedStatus = 'RECEIVED';

        let snippet = meta.error || `Action ${db.action}`;
        if (isInbound) {
          snippet = meta.body
            ? `« ${meta.body} » → ${meta.actionTaken || meta.intent || 'Traité'}`
            : meta.actionTaken || `Réponse client WhatsApp`;
        }

        return {
          id: db.id,
          channel: 'WHATSAPP' as const,
          messageId: db.entity_id || meta.messageId,
          recipient: meta.from || meta.recipient || '—',
          bookingRef: meta.bookingRef || '—',
          status: mappedStatus,
          type: isInbound ? 'INBOUND' : meta.type || 'TEXT',
          snippet,
          timestamp: db.created_at,
        };
      }),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);

    const isWhatsAppConfigured = whatsappService.isConfigured();

    // 4. Modèles officiels disponibles
    const templates = [
      {
        id: 'booking_confirmation',
        name: 'Confirmation Réservation Client',
        description: 'Transmise dès validation de la demande avec référence, dates, point de RDV et caution.',
        variables: ['nom_client', 'reference', 'vehicule', 'dates', 'point_rdv', 'prix_total', 'caution'],
        status: 'Actif',
      },
      {
        id: 'agency_new_lead',
        name: 'Alerte Nouvelle Demande Agence',
        description: 'Alerte instantanée sur le WhatsApp de l’agence avec lien direct vers la fiche PDF et dashboard.',
        variables: ['reference', 'vehicule', 'client_nom', 'client_tel', 'dates', 'lien_pdf'],
        status: 'Actif',
      },
      {
        id: 'delivery_meeting_invite',
        name: 'Organisation Remise du Véhicule',
        description: 'Informations de rencontre à l’Aéroport Nador ou Port avec agent d’accueil et consignes de vol.',
        variables: ['nom_client', 'reference', 'point_rencontre', 'date_heure', 'agent_nom', 'agent_tel'],
        status: 'Actif',
      },
      {
        id: 'handover_summary_receipt',
        name: 'Reçu Numérique État des Lieux',
        description: 'Relevé certifié du kilométrage, niveau de jauge de carburant et statut de la caution.',
        variables: ['nom_client', 'reference', 'type', 'kilometrage', 'carburant', 'statut_caution'],
        status: 'Actif',
      },
    ];

    const webhookInfo = {
      endpointUrl: '/api/webhooks/whatsapp',
      verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'klickdrive_whatsapp_secure_webhook_token_2026',
      isConfigured: isWhatsAppConfigured,
      supportedIntents: [
        {
          keyword: 'OUI / CONFIRMER',
          action: 'Confirmation automatique de la réservation (PENDING -> CONFIRMED)',
          description: 'Met à jour la réservation et notifie l’agence et le client instantanément.',
        },
        {
          keyword: 'NON / ANNULER',
          action: 'Annulation sécurisée de la réservation (PENDING -> CANCELLED)',
          description: 'Libère le créneau et trace l’annulation demandée par le client.',
        },
        {
          keyword: 'AIDE / LIEU',
          action: 'Assistance & Détails du point de rencontre',
          description: 'Renvoie l’adresse du point de rendez-vous et le numéro d’urgence conciergerie.',
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: {
        isWhatsAppConfigured,
        kpis: {
          totalSent: recentFeed.length,
          deliveredCount: recentFeed.filter((f) => f.status === 'SENT' || f.status === 'SIMULATED' || f.status === 'CONFIRMED' || f.status === 'RECEIVED').length,
          failedCount: recentFeed.filter((f) => f.status === 'FAILED').length,
          activeTemplatesCount: templates.length,
        },
        recentFeed,
        templates,
        webhookInfo,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur chargement notifications';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requirePlatformPermissionApi('agencies.read');
  if (gate.denied) return gate.denied;

  try {
    const body = await request.json();

    // Cas spécifique : Simulation d'un message client entrant via Webhook
    if (body.action === 'simulate_inbound') {
      const senderPhone = String(body.senderPhone || '').trim();
      const messageText = String(body.messageText || '').trim();
      const bookingRef = body.bookingRef ? String(body.bookingRef).trim() : undefined;

      if (!senderPhone || !messageText) {
        return NextResponse.json(
          { success: false, error: 'Numéro de téléphone et message requis pour la simulation' },
          { status: 400 }
        );
      }

      const compositeBody = bookingRef ? `${messageText} ${bookingRef}` : messageText;

      const result = await whatsappService.handleInboundMessage({
        from: senderPhone,
        messageId: `sim_${Date.now()}`,
        timestamp: `${Math.floor(Date.now() / 1000)}`,
        type: 'text',
        body: compositeBody,
      });

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // Cas standard : Envoi direct sortant (broadcast)
    const parsed = broadcastSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { recipientPhone, message, bookingRef } = parsed.data;

    // Envoi via le service WhatsApp
    const sendResult = await whatsappService.sendTextMessage(recipientPhone, message, {
      bookingRef,
    });

    return NextResponse.json({
      success: sendResult.success,
      data: sendResult,
      error: sendResult.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la diffusion de la notification';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
