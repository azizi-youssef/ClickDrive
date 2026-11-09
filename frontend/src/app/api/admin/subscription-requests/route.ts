import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverError } from '@/lib/api/server-error';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { subscriptionService } from '@/lib/services/subscription.service';
import type { PlanChangeRequestStatus } from '@/types';

const STATUSES: readonly PlanChangeRequestStatus[] = ['PENDING_PAYMENT', 'APPROVED', 'REJECTED', 'CANCELLED'];

const decisionSchema = z.object({
  requestId: z.string().uuid('Identifiant invalide'),
  decision: z.enum(['APPROVED', 'REJECTED'], { message: 'Décision invalide' }),
  paymentReference: z.string().trim().max(120, 'Référence de paiement trop longue').optional(),
  note: z.string().trim().max(500, 'Note trop longue').optional(),
});

/** Demandes de changement de formule des agences (filtre de statut facultatif) */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformPermissionApi('agencies.read');
  if (gate.denied) return gate.denied;
  try {
    const status = req.nextUrl.searchParams.get('status');
    const requests = await subscriptionService.listPlanChangeRequests(
      STATUSES.includes(status as PlanChangeRequestStatus) ? (status as PlanChangeRequestStatus) : undefined
    );
    return NextResponse.json({ success: true, data: requests }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return serverError(error, '/api/admin/subscription-requests');
  }
}

/** Validation (paiement reçu : la formule est appliquée) ou refus d'une demande */
export async function POST(req: NextRequest) {
  const gate = await requirePlatformPermissionApi('agencies.update');
  if (gate.denied) return gate.denied;
  try {
    const parsed = decisionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { requestId, decision, paymentReference, note } = parsed.data;
    if (decision === 'APPROVED' && !paymentReference) {
      return NextResponse.json(
        { success: false, error: 'Indiquez la référence du paiement reçu avant de valider.' },
        { status: 400 }
      );
    }
    const result = await subscriptionService.decidePlanChange(requestId, decision, gate.auth.userId, {
      paymentReference,
      note,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 409 });
  } catch (error) {
    return serverError(error, '/api/admin/subscription-requests');
  }
}
