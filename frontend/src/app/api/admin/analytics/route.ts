import { NextResponse } from 'next/server';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { subscriptionService } from '@/lib/services/subscription.service';
import { selectAll } from '@/lib/supabase/select-all';
import { ADMIN_OVERVIEW_GROUPS } from '@/lib/admin/overview';

type AnalyticsBooking = {
  id: string;
  total_days: number | null;
  status: string;
  start_date: string | null;
  created_at: string | null;
  pickup_location: string | null;
  agency: { id: string; name: string; rating: number | null; city: string | null } | null;
  vehicle: { category: string | null } | null;
};

const CONFIRMED = new Set<string>([...ADMIN_OVERVIEW_GROUPS.confirmed, ...ADMIN_OVERVIEW_GROUPS.completed]);
const PENDING = new Set<string>(ADMIN_OVERVIEW_GROUPS.pending);
const CLOSED = new Set<string>(ADMIN_OVERVIEW_GROUPS.closed);

export async function GET() {
  const gate = await requirePlatformPermissionApi('reports.read');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Base de données indisponible' }, { status: 503 });
  }

  try {
    // 1. Réservations (toutes : lecture paginée, l'API plafonne chaque réponse), abonnements, décomptes
    const [allBookings, subscriptionStats, agenciesCountRes, vehiclesCountRes] = await Promise.all([
      selectAll<AnalyticsBooking>((from, to) =>
        supabase
          .from('bookings')
          .select('id, total_days, status, start_date, created_at, pickup_location, agency:agencies(id, name, rating, city), vehicle:vehicles(category)')
          .order('id')
          .range(from, to)
          .then(({ data, error }) => ({ data: data as unknown as AnalyticsBooking[] | null, error }))
      ),
      subscriptionService.getSubscriptionStats().catch(() => ({
        monthlyRecurringRevenue: 0,
        activeSubscribers: 0,
        fleetCapacityTotal: 0,
      })),
      supabase.from('agencies').select('id', { count: 'exact', head: true }),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }),
    ]);

    const totalAgencies = agenciesCountRes.count || 0;
    const totalVehicles = vehiclesCountRes.count || 0;

    // 2. Calcul des indicateurs de performance des réservations
    // Mêmes groupes de statuts que la vue d'ensemble (toute la machine à états)
    const confirmedCount = allBookings.filter((b) => CONFIRMED.has(b.status)).length;
    const cancelledCount = allBookings.filter((b) => CLOSED.has(b.status)).length;
    const pendingCount = allBookings.filter((b) => PENDING.has(b.status)).length;

    const confirmationRate = allBookings.length > 0 ? Math.round((confirmedCount / allBookings.length) * 100) : 0;
    const cancellationRate = allBookings.length > 0 ? Math.round((cancelledCount / allBookings.length) * 100) : 0;

    const validBookings = allBookings.filter((b) => !CLOSED.has(b.status));
    const totalDays = validBookings.reduce((sum, b) => sum + (Number(b.total_days) || 1), 0);
    const averageRentalDays = validBookings.length > 0 ? Number((totalDays / validBookings.length).toFixed(1)) : 0;

    // 3. Répartition par catégorie de véhicule
    const categoryCounts: Record<string, number> = {};
    validBookings.forEach((b) => {
      const cat = b.vehicle?.category || 'Non renseigné';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const categoryBreakdown = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: validBookings.length > 0 ? Math.round((count / validBookings.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // 4. Performance des agences partenaires (par nombre de réservations et note)
    // Note réelle de l'agence, ou null sans avis (jamais de note par défaut)
    const agencyStatsMap: Record<string, { name: string; city: string | null; count: number; rating: number | null }> = {};
    validBookings.forEach((b) => {
      const ag = b.agency;
      const agencyId = ag?.id || 'unknown';
      if (!agencyStatsMap[agencyId]) {
        const rating = Number(ag?.rating);
        agencyStatsMap[agencyId] = {
          name: ag?.name || 'Agence',
          city: ag?.city || null,
          count: 0,
          rating: Number.isFinite(rating) && rating > 0 ? rating : null,
        };
      }
      agencyStatsMap[agencyId].count += 1;
    });

    const topAgencies = Object.values(agencyStatsMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 5. Points de rendez-vous les plus demandés
    const locationCounts: Record<string, number> = {};
    validBookings.forEach((b) => {
      const loc = b.pickup_location || 'Agence principale';
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    const topLocations = Object.entries(locationCounts)
      .map(([location, count]) => ({
        location,
        count,
        percentage: validBookings.length > 0 ? Math.round((count / validBookings.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 6. Tendances mensuelles des réservations (6 derniers mois)
    // Le mois en cours est marqué « partiel » : il ne se compare pas aux mois complets
    const monthlyTrendsMap: Record<string, { key: string; month: string; bookings: number; confirmed: number; partial: boolean }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      monthlyTrendsMap[key] = { key, month: label, bookings: 0, confirmed: 0, partial: i === 0 };
    }

    allBookings.forEach((b) => {
      const dateStr = b.created_at || b.start_date;
      if (dateStr) {
        const key = dateStr.slice(0, 7);
        if (monthlyTrendsMap[key]) {
          monthlyTrendsMap[key].bookings += 1;
          if (CONFIRMED.has(b.status)) {
            monthlyTrendsMap[key].confirmed += 1;
          }
        }
      }
    });

    const monthlyTrends = Object.values(monthlyTrendsMap);

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalBookings: allBookings.length,
          confirmedBookings: confirmedCount,
          pendingBookings: pendingCount,
          cancelledBookings: cancelledCount,
          confirmationRate,
          cancellationRate,
          averageRentalDays,
          totalAgencies,
          totalVehicles,
        },
        subscriptions: subscriptionStats,
        monthlyTrends,
        categoryBreakdown,
        topAgencies,
        topLocations,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur calcul analytics';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
