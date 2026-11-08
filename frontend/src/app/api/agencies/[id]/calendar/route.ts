import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { isBlockingBookingStatus } from '@clickdrive/shared';

type RouteContext = { params: Promise<{ id: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'bookings.read');
  if (gate.denied) return gate.denied;
  const vehicleGate = await requireAgencyPermissionApi(agencyId, 'vehicles.read');
  if (vehicleGate.denied) return vehicleGate.denied;

  const params = request.nextUrl.searchParams;
  const vehicleFilter = params.get('vehicleId');

  // Dates par défaut : 30 jours autour d'aujourd'hui
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0]!;
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    .toISOString()
    .split('T')[0]!;

  const startDate = params.get('start') || defaultStart;
  const endDate = params.get('end') || defaultEnd;

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  await supabase.rpc('expire_completed_bookings');

  // 1. Récupérer les véhicules de l'agence
  let vehiclesQuery = supabase
    .from('vehicles')
    .select('id, brand, model, license_plate, unit_number, category, status, daily_price, images:vehicle_images(url, is_primary)')
    .eq('agency_id', agencyId);

  if (vehicleFilter && vehicleFilter !== 'all') {
    vehiclesQuery = vehiclesQuery.eq('id', vehicleFilter);
  }

  const { data: vehicles, error: vErr } = await vehiclesQuery.order('brand', { ascending: true });
  if (vErr) {
    return failure('Impossible de charger les véhicules pour le calendrier.', 500);
  }

  const vehicleIds = (vehicles ?? []).map((v) => v.id);
  if (vehicleIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: { vehicles: [], events: [] },
    });
  }

  // 2. Récupérer les réservations
  const todayIso = new Date().toISOString().split('T')[0]!;
  const bookingsQuery = supabase
    .from('bookings')
    .select(
      'id, booking_ref, reference, vehicle_id, customer_name, customer_phone, start_date, end_date, pickup_time, dropoff_time, status, total_price'
    )
    .eq('agency_id', agencyId)
    .in('vehicle_id', vehicleIds)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .gte('end_date', todayIso);

  const { data: bookings, error: bErr } = await bookingsQuery;
  if (bErr) {
    return failure('Impossible de charger les réservations du calendrier.', 500);
  }

  // 3. Récupérer les indisponibilités manuelles et maintenances
  const { data: unavailability, error: unavailableErr } = await supabase
    .from('vehicle_unavailability')
    .select('id, vehicle_id, start_date, end_date, reason, notes, cost')
    .eq('agency_id', agencyId)
    .in('vehicle_id', vehicleIds)
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (unavailableErr) {
    return failure('Impossible de charger les indisponibilités du calendrier.', 500);
  }

  // Assembler les événements calendaires avec types uniformes
  const events = [
    ...(bookings ?? [])
      .filter((b) => b.end_date >= todayIso && isBlockingBookingStatus(b.status))
      .map((b) => ({
      id: b.id,
      vehicleId: b.vehicle_id,
      type: 'BOOKING' as const,
      status: b.status,
      isBlocking: isBlockingBookingStatus(b.status),
      title: `${b.customer_name || 'Client'} (${b.reference || b.booking_ref || 'Réservation'})`,
      subtitle: `${b.total_price} MAD`,
      startDate: b.start_date,
      endDate: b.end_date,
      pickupTime: b.pickup_time,
      dropoffTime: b.dropoff_time,
      details: {
        customerName: b.customer_name,
        customerPhone: b.customer_phone,
        reference: b.reference || b.booking_ref,
      },
    }),
    ...(unavailability ?? []).map((period) => {
      const isMaintenance = period.reason === 'MAINTENANCE';
      return {
        id: period.id,
        vehicleId: period.vehicle_id,
        type: isMaintenance ? 'MAINTENANCE' as const : 'BLOCKED' as const,
        status: isMaintenance ? 'MAINTENANCE' : 'BLOCKED',
        isBlocking: true,
        title: period.notes || (isMaintenance ? 'Maintenance / Révision' : 'Indisponibilité manuelle'),
        subtitle: isMaintenance && period.cost ? `${period.cost} MAD` : isMaintenance ? 'Atelier' : 'Bloqué',
        startDate: period.start_date,
        endDate: period.end_date,
        details: { reason: period.notes || period.reason, cost: period.cost },
      };
    })),
  ];

  const normalizedVehicles = (vehicles ?? []).map((v: any) => {
    const rawImages = (v.images ?? []) as any[];
    rawImages.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    return {
      id: v.id,
      brand: v.brand,
      model: v.model,
      licensePlate: v.license_plate,
      unitNumber: v.unit_number,
      category: v.category,
      status: v.status,
      dailyPrice: v.daily_price,
      primaryImage: rawImages[0]?.url || null,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      vehicles: normalizedVehicles,
      events,
    },
  });
}
