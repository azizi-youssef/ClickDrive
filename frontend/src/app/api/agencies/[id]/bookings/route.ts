import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { createClient } from '@/lib/supabase/server';
import { AGENCY_TO_PROCESS_STATUSES, TO_PROCESS_FILTER } from '@/lib/bookings/agency-queue';
import { CAR_CATEGORIES, MOTORCYCLE_CATEGORIES, parseVehicleTypeParam } from '@/lib/vehicles/kind';

type RouteContext = { params: Promise<{ id: string }> };

/** Colonnes strictement necessaires au tableau de bord agence. */
const BOOKING_LIST_COLUMNS =
  'id, booking_ref, reference, vehicle_id, agency_id, customer_name, start_date, end_date, total_days, total_price, commission_rate, commission_amount, agency_amount, status, created_at, vehicle:vehicles(id, brand, model, category)';

const MAX_PAGE_SIZE = 50;

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function clampInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(1, Math.trunc(parsed)), max);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'bookings.read');
  if (gate.denied) return gate.denied;

  const params = request.nextUrl.searchParams;
  const page = clampInt(params.get('page'), 1, 10_000);
  const pageSize = clampInt(params.get('pageSize'), 15, MAX_PAGE_SIZE);
  const search = (params.get('q') ?? '').trim();
  const status = params.get('status')?.trim() || undefined;
  const vehicleType = parseVehicleTypeParam(params.get('type'));
  const sort = params.get('sort') === 'amount_asc' ? 'amount_asc'
    : params.get('sort') === 'amount_desc' ? 'amount_desc'
    : params.get('sort') === 'start_date' ? 'start_date'
    : 'created_at';

  const supabase = await createClient();
  if (!supabase) return failure('Service de données indisponible.', 503);

  await supabase.rpc('expire_completed_bookings');

  // Le RLS garantit l'isolation locative ; le filtre agency_id est explicite
  // afin de ne jamais dependre implicitement des policies.
  // Filtre voitures / motos : jointure stricte sur le véhicule et sa catégorie
  let query = supabase
    .from('bookings')
    .select(vehicleType ? BOOKING_LIST_COLUMNS.replace('vehicle:vehicles(', 'vehicle:vehicles!inner(') : BOOKING_LIST_COLUMNS, {
      count: 'exact',
    })
    .eq('agency_id', agencyId);

  if (vehicleType) {
    query = query.in('vehicle.category', [...(vehicleType === 'MOTORCYCLE' ? MOTORCYCLE_CATEGORIES : CAR_CATEGORIES)]);
  }
  // TO_PROCESS : toute la file des demandes qui attendent une décision de l'agence (liste de statuts, pas un statut)
  if (status === TO_PROCESS_FILTER) query = query.in('status', [...AGENCY_TO_PROCESS_STATUSES]);
  else if (status) query = query.eq('status', status);

  if (search) {
    // Echappe les jokers PostgRES pour eviter les injections de motif ilike.
    const escaped = search.replace(/[\\%_,()]/g, '\\$&');
    query = query.or(
      `booking_ref.ilike.%${escaped}%,reference.ilike.%${escaped}%,customer_name.ilike.%${escaped}%`
    );
  }

  if (sort === 'amount_asc') query = query.order('total_price', { ascending: true });
  else if (sort === 'amount_desc') query = query.order('total_price', { ascending: false });
  else if (sort === 'start_date') query = query.order('start_date', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const start = (page - 1) * pageSize;
  const { data, error, count } = await query.range(start, start + pageSize - 1);

  if (error) {
    console.error('[AgencyBookings] Listing failed:', error.message);
    return failure('Impossible de charger les réservations.', 500);
  }

  const total = count ?? 0;
  return NextResponse.json({
    success: true,
    data: data ?? [],
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
