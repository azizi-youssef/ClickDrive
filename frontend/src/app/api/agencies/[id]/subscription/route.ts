import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { subscriptionService } from '@/lib/services/subscription.service';

type RouteContext = { params: Promise<{ id: string }> };

/** Formule en cours + demande de changement en attente de paiement (le cas échéant) */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'reports.read');
  if (gate.denied) return gate.denied;

  try {
    const [subscription, pendingChange] = await Promise.all([
      subscriptionService.getAgencySubscription(agencyId),
      subscriptionService.getPendingPlanChange(agencyId),
    ]);
    return NextResponse.json({ success: true, data: subscription, pendingChange });
  } catch (error: unknown) {
    return serverError(error, '/api/agencies/[id]/subscription', "Erreur lors du chargement de l'abonnement.");
  }
}

/**
 * Demande de changement de formule. La formule actuelle reste active : la nouvelle ne s'applique
 * qu'une fois le paiement reçu et la demande validée par l'administration ClickDrive.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'agencies.update');
  if (gate.denied) return gate.denied;

  const body: unknown = await request.json().catch(() => null);
  const planSlug =
    typeof body === 'object' && body !== null && 'planSlug' in body && typeof body.planSlug === 'string'
      ? body.planSlug
      : null;
  if (!planSlug) {
    return NextResponse.json({ success: false, error: 'Le paramètre planSlug est obligatoire.' }, { status: 422 });
  }

  try {
    const result = await subscriptionService.requestPlanChange(agencyId, planSlug, gate.auth.userId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.conflict ? 409 : 400 });
    }
    return NextResponse.json({ success: true, pendingChange: result.request }, { status: 202 });
  } catch (error: unknown) {
    return serverError(error, '/api/agencies/[id]/subscription', 'Erreur lors de la demande de changement de formule.');
  }
}

/** L'agence retire sa demande en attente */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'agencies.update');
  if (gate.denied) return gate.denied;

  const requestId = request.nextUrl.searchParams.get('requestId');
  if (!requestId) {
    return NextResponse.json({ success: false, error: 'Le paramètre requestId est obligatoire.' }, { status: 422 });
  }
  try {
    const result = await subscriptionService.cancelPlanChange(agencyId, requestId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    return serverError(error, '/api/agencies/[id]/subscription', "Erreur lors de l'annulation de la demande.");
  }
}
