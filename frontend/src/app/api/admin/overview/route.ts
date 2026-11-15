import { NextResponse } from 'next/server';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { hasAccessPermission } from '@/lib/auth/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  ADMIN_OVERVIEW_GROUPS,
  RECENT_BOOKINGS_LIMIT,
  PENDING_AGENCIES_LIMIT,
  type AdminOverview,
  type AdminOverviewCount,
} from '@/lib/admin/overview';

const DAY_MS = 86_400_000;

/**
 * Vue d'ensemble de l'administration, calculée en base : décomptes par statut (requêtes `count`),
 * demandes des 30 derniers jours et des 30 précédents, 8 dernières réservations (colonnes affichées
 * seulement) et agences à vérifier. Aucune liste complète n'est envoyée au navigateur.
 */
export async function GET() {
  const gate = await requirePlatformPermissionApi('bookings.read');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Base de données indisponible' }, { status: 503 });
  }

  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS).toISOString();
  const since60 = new Date(now - 60 * DAY_MS).toISOString();

  const countBookings = (statuses?: readonly string[], range?: { after: string; until?: string }) => {
    let query = supabase.from('bookings').select('id', { count: 'exact', head: true });
    if (statuses) query = query.in('status', [...statuses]);
    if (range) {
      query = query.gt('created_at', range.after);
      if (range.until) query = query.lte('created_at', range.until);
    }
    return query;
  };

  try {
    const [canReadAgencies, canReadMessages] = await Promise.all([
      hasAccessPermission('agencies.read'),
      hasAccessPermission('customers.read'),
    ]);
    const [total, pending, confirmed, completed, closed, last30, previous30, recent, agencies, messages, planRequests] = await Promise.all([
      countBookings(),
      countBookings(ADMIN_OVERVIEW_GROUPS.pending),
      countBookings(ADMIN_OVERVIEW_GROUPS.confirmed),
      countBookings(ADMIN_OVERVIEW_GROUPS.completed),
      countBookings(ADMIN_OVERVIEW_GROUPS.closed),
      countBookings(undefined, { after: since30 }),
      countBookings(undefined, { after: since60, until: since30 }),
      supabase
        .from('bookings')
        .select(
          'id, booking_ref, reference, customer_name, start_date, end_date, total_price, status, created_at, vehicle:vehicles(brand, model), agency:agencies(name)'
        )
        .order('created_at', { ascending: false })
        .limit(RECENT_BOOKINGS_LIMIT),
      canReadAgencies
        ? supabase
            .from('agencies')
            .select('id, name, city, email, status, verified', { count: 'exact' })
            .or('status.eq.PENDING,verified.eq.false')
            .order('created_at', { ascending: false })
            .limit(PENDING_AGENCIES_LIMIT)
        : Promise.resolve(null),
      // Mêmes définitions que le compteur du menu « Messages » et que la carte « Demandes de changement de formule »
      canReadMessages
        ? supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'NEW')
        : Promise.resolve(null),
      canReadAgencies
        ? supabase.from('subscription_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_PAYMENT')
        : Promise.resolve(null),
    ]);

    const failed = [total, pending, confirmed, completed, closed, last30, previous30, recent, agencies].find(
      (result) => result && 'error' in result && result.error
    );
    if (failed && 'error' in failed && failed.error) throw failed.error;

    // Ces deux décomptes sont secondaires : leur échec ne doit pas faire disparaître les réservations et
    // les agences. Le nombre est alors déclaré indisponible, jamais présenté comme zéro.
    const toCount = (label: string, result: { count: number | null; error: { message: string } | null } | null): AdminOverviewCount => {
      if (!result) return { count: 0, restricted: true };
      if (result.error) {
        console.error(`[AdminOverview] Lecture « ${label} » impossible :`, result.error.message);
        return { count: 0, unavailable: true };
      }
      return { count: result.count ?? 0 };
    };

    const overview: AdminOverview = {
      bookings: {
        total: total.count ?? 0,
        pending: pending.count ?? 0,
        confirmed: confirmed.count ?? 0,
        completed: completed.count ?? 0,
        closed: closed.count ?? 0,
        createdLast30Days: last30.count ?? 0,
        createdPrevious30Days: previous30.count ?? 0,
      },
      recentBookings: (recent.data ?? []) as unknown as AdminOverview['recentBookings'],
      pendingAgencies: agencies
        ? { count: agencies.count ?? 0, items: (agencies.data ?? []) as AdminOverview['pendingAgencies']['items'] }
        : { count: 0, items: [], restricted: true },
      contactMessages: toCount('messages de contact', messages),
      planRequests: toCount('demandes de formule', planRequests),
      generatedAt: new Date(now).toISOString(),
    };

    return NextResponse.json(
      { success: true, data: overview },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[AdminOverview] Lecture impossible :', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Vue d’ensemble indisponible.' }, { status: 500 });
  }
}
