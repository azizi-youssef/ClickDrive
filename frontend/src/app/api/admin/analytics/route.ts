import { NextResponse, type NextRequest } from 'next/server';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { serverError } from '@/lib/api/server-error';
import { readRangeParams } from '@/lib/analytics/range-params';
import { AnalyticsRangeError, statsService } from '@/lib/services/stats.service';

/**
 * Statistiques de la plateforme sur une période (`from`, `to`, AAAA-MM-JJ ; 30 derniers jours par
 * défaut) : entonnoir, délais de réponse, occupation, tendances, répartitions, classement des agences
 * et revenu récurrent. Tout est agrégé par admin_analytics_report() en base : aucune table n'est
 * ramenée au serveur. La base revérifie le droit (reports.read plateforme, donc SUPER_ADMIN seul).
 */
export async function GET(request: NextRequest) {
  const gate = await requirePlatformPermissionApi('reports.read');
  if (gate.denied) return gate.denied;

  const params = readRangeParams(request.nextUrl.searchParams);
  if (!params.ok) {
    return NextResponse.json({ success: false, error: params.error }, { status: 400 });
  }

  try {
    const data = await statsService.getAdminAnalytics(params.range);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof AnalyticsRangeError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return serverError(error, '/api/admin/analytics', 'Impossible de charger les statistiques de la plateforme.');
  }
}
