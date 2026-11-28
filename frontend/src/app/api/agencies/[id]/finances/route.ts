import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { subscriptionService } from '@/lib/services/subscription.service';

type RouteContext = { params: Promise<{ id: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'reports.read');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  // Récupérer toutes les réservations de l'agence
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select(
      'id, booking_ref, reference, customer_name, start_date, end_date, total_days, total_price, status, created_at, vehicle:vehicles(brand, model)'
    )
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });

  if (bErr) {
    console.error('[AgencyFinances] Fetch error:', bErr.message);
    return failure('Impossible de charger les données financières.', 500);
  }

  const allBookings = bookings ?? [];

  // Filtrer les réservations qui comptent dans les revenus : CONFIRMED, ACTIVE, COMPLETED
  const revenueEligible = allBookings.filter((b) =>
    ['CONFIRMED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'READY_FOR_PICKUP'].includes(b.status)
  );

  // Aucune commission (modèle par abonnement) : le montant d'une location revient entièrement à l'agence
  let revenue = 0;
  let settledRevenue = 0;

  for (const b of revenueEligible) {
    const total = Number(b.total_price) || 0;
    revenue += total;
    if (b.status === 'COMPLETED') settledRevenue += total;
  }

  const pendingRevenue = revenue - settledRevenue;
  const subscription = await subscriptionService.getAgencySubscription(agencyId);

  return NextResponse.json({
    success: true,
    data: {
      subscription,
      kpis: {
        revenue,
        settledRevenue,
        pendingRevenue,
        totalBookingsCount: revenueEligible.length,
        completedBookingsCount: allBookings.filter((b) => b.status === 'COMPLETED').length,
      },
      transactions: allBookings.map((b) => ({
        id: b.id,
        reference: b.reference || b.booking_ref || b.id,
        date: b.created_at,
        customerName: b.customer_name,
        vehicle: b.vehicle ? `${(b.vehicle as any).brand} ${(b.vehicle as any).model}` : 'Véhicule',
        totalPrice: Number(b.total_price) || 0,
        status: b.status,
      })),
    },
  });
}
