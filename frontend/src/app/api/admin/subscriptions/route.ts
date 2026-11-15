import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { subscriptionService } from '@/lib/services/subscription.service';

/**
 * Abonnements de la plateforme. `?only=stats` : seulement les statistiques (MRR, abonnés, répartition),
 * agrégées en base, sans construire la liste des agences (vue d'ensemble admin).
 */
export async function GET(request: NextRequest) {
  const gate = await requirePlatformPermissionApi('agencies.read');
  if (gate.denied) return gate.denied;

  if (request.nextUrl.searchParams.get('only') === 'stats') {
    try {
      const stats = await subscriptionService.getSubscriptionStats();
      return NextResponse.json({ success: true, data: { stats } });
    } catch (error: unknown) {
      return serverError(error, '/api/admin/subscriptions', 'Impossible de charger les statistiques d’abonnement.');
    }
  }

  try {
    const [subscriptions, stats, plans] = await Promise.all([
      subscriptionService.getAllAgencySubscriptions(),
      subscriptionService.getSubscriptionStats(),
      subscriptionService.getSubscriptionPlans(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        subscriptions,
        stats,
        plans,
      },
    });
  } catch (error: unknown) {
    return serverError(error, '/api/admin/subscriptions', 'Impossible de charger les abonnements.');
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePlatformPermissionApi('agencies.update');
  if (gate.denied) return gate.denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalide.' }, { status: 400 });
  }

  const { agencyId, planSlug } = body || {};
  if (!agencyId || !planSlug) {
    return NextResponse.json(
      { success: false, error: 'agencyId et planSlug sont requis.' },
      { status: 422 }
    );
  }

  try {
    const result = await subscriptionService.updateAgencyPlan(agencyId, planSlug);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.subscription });
  } catch (error: unknown) {
    return serverError(error, '/api/admin/subscriptions', 'Erreur lors de la mise à jour.');
  }
}
