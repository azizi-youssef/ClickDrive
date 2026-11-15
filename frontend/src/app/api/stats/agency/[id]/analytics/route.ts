import { NextResponse, type NextRequest } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { serverError } from '@/lib/api/server-error';
import { readRangeParams } from '@/lib/analytics/range-params';
import { AnalyticsRangeError, statsService } from '@/lib/services/stats.service';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Statistiques de l'agence sur une période (`from`, `to`, AAAA-MM-JJ ; 30 derniers jours par défaut),
 * comparées à la période précédente de même durée. Agrégats calculés par agency_analytics_report(),
 * qui revérifie reports.read sur l'agence.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const gate = await requireAgencyPermissionApi(id, 'reports.read');
  if (gate.denied) return gate.denied;

  const params = readRangeParams(request.nextUrl.searchParams);
  if (!params.ok) {
    return NextResponse.json({ success: false, error: params.error }, { status: 400 });
  }

  try {
    const data = await statsService.getAgencyAnalytics(id, params.range);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof AnalyticsRangeError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return serverError(error, '/api/stats/agency/[id]/analytics', "Impossible de charger les statistiques de l'agence.");
  }
}
