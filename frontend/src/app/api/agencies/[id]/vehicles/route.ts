import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeVehicleKindFields, vehicleCreateSchema } from '@/lib/validations/vehicle';
import { CAR_CATEGORIES, MOTORCYCLE_CATEGORIES, parseVehicleTypeParam } from '@/lib/vehicles/kind';
import { isMotorcycleSchemaMissing, MOTORCYCLE_SCHEMA_MISSING_MESSAGE } from '@/lib/vehicles/schema-support';
import { subscriptionService } from '@/lib/services/subscription.service';
const slugify = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

type RouteContext = { params: Promise<{ id: string }> };

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
  const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.read');
  if (gate.denied) return gate.denied;

  const params = request.nextUrl.searchParams;
  const page = clampInt(params.get('page'), 1, 10_000);
  const pageSize = clampInt(params.get('pageSize'), 15, 100);
  const q = (params.get('q') ?? '').trim();
  const category = params.get('category')?.trim();
  const vehicleType = parseVehicleTypeParam(params.get('type'));
  const transmission = params.get('transmission')?.trim();
  const fuel = params.get('fuel')?.trim();
  const status = params.get('status')?.trim();
  const published = params.get('published');
  const sort = params.get('sort') ?? 'created_at';

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  let query = supabase
    .from('vehicles')
    .select(
      // « * » : inclut vehicle_type / engine_cc / license_required une fois la migration motos appliquée,
      // sans échouer avant.
      '*, images:vehicle_images(url, is_primary, display_order), features:vehicle_features(name)',
      { count: 'exact' }
    )
    .eq('agency_id', agencyId);

  // Filtre voitures / motos par catégorie (chaque catégorie appartient à un seul type)
  if (vehicleType) {
    query = query.in('category', [...(vehicleType === 'MOTORCYCLE' ? MOTORCYCLE_CATEGORIES : CAR_CATEGORIES)]);
  }

  if (category && category !== 'all' && category !== 'Tous les types') {
    query = query.ilike('category', category);
  }
  if (transmission && transmission !== 'all') {
    query = query.eq('transmission', transmission);
  }
  if (fuel && fuel !== 'all') {
    query = query.eq('fuel', fuel);
  }
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (published === 'true') {
    query = query.eq('published', true);
  } else if (published === 'false') {
    query = query.eq('published', false);
  }

  if (q) {
    const escaped = q.replace(/[\\%_,()]/g, '\\$&');
    query = query.or(
      `brand.ilike.%${escaped}%,model.ilike.%${escaped}%,license_plate.ilike.%${escaped}%,unit_number.ilike.%${escaped}%`
    );
  }

  if (sort === 'price_asc') {
    query = query.order('daily_price', { ascending: true });
  } else if (sort === 'price_desc') {
    query = query.order('daily_price', { ascending: false });
  } else if (sort === 'year_desc') {
    query = query.order('year', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const start = (page - 1) * pageSize;
  const countByType = (categories: readonly string[]) =>
    supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).in('category', [...categories]);
  const [{ data, error, count }, carsCount, motosCount] = await Promise.all([
    query.range(start, start + pageSize - 1),
    countByType(CAR_CATEGORIES),
    countByType(MOTORCYCLE_CATEGORIES),
  ]);

  if (error) {
    console.error('[AgencyVehicles] List error:', error.message);
    return failure('Impossible de charger la flotte de véhicules.', 500);
  }

  // Normaliser les véhicules et récupérer le compte de réservations actives pour chacun
  const vehicleList = (data ?? []).map((row: any) => {
    const rawImages = (row.images ?? []) as any[];
    rawImages.sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });
    const images = rawImages.map((img) => img.url);
    const features = ((row.features ?? []) as any[]).map((f) => f.name);

    return {
      ...row,
      images,
      features,
    };
  });

  return NextResponse.json({
    success: true,
    data: vehicleList,
    meta: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      // Voitures et motos gérées séparément dans le tableau de bord
      typeCounts: { CAR: carsCount.count ?? 0, MOTORCYCLE: motosCount.count ?? 0 },
    },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'vehicles.manage');
  if (gate.denied) return gate.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure('Corps de requête JSON invalide.', 400);
  }

  const parsed = vehicleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return failure(
      parsed.error.issues.map((i) => i.message).join(', '),
      422
    );
  }

  // Vérification stricte de la capacité maximale du forfait d'abonnement
  const capacityCheck = await subscriptionService.canAgencyAddVehicle(agencyId);
  if (!capacityCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: capacityCheck.reason,
        code: 'CAPACITY_LIMIT_REACHED',
        current_count: capacityCheck.currentCount,
        max_vehicles: capacityCheck.maxVehicles,
        plan_name: capacityCheck.planName,
      },
      { status: 403 }
    );
  }

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  const input = normalizeVehicleKindFields(parsed.data);
  const isMotorcycle = input.vehicle_type === 'MOTORCYCLE';
  const rawSlug = slugify(`${input.brand}-${input.model}-${input.year}`);
  const uniqueSuffix = Math.random().toString(36).substring(2, 7);
  const slug = `${rawSlug}-${uniqueSuffix}`;
  const unitNumber = input.unit_number || `${input.model.substring(0, 4).toUpperCase()}#${Math.floor(100 + Math.random() * 900)}`;

  const { data: vehicle, error: insertError } = await supabase
    .from('vehicles')
    .insert({
      agency_id: agencyId,
      brand: input.brand,
      model: input.model,
      slug,
      year: input.year,
      category: input.category,
      transmission: input.transmission,
      fuel: input.fuel,
      seats: input.seats,
      doors: input.doors,
      air_conditioning: input.air_conditioning,
      mileage: input.mileage,
      daily_price: input.daily_price,
      weekly_price: input.weekly_price || null,
      monthly_price: input.monthly_price || null,
      deposit: input.deposit,
      min_rental_days: input.min_rental_days,
      status: input.status,
      published: input.published,
      unit_number: unitNumber,
      license_plate: input.license_plate || null,
      description: input.description || null,
      // Assurance : envoyée seulement si renseignée (fonctionne avant la migration 20261109000100)
      ...(input.insurance_coverage || input.insurance_excess != null
        ? { insurance_coverage: input.insurance_coverage ?? null, insurance_excess: input.insurance_excess ?? null }
        : {}),
      // Colonnes motos envoyées uniquement pour une moto : une voiture s'enregistre même
      // si la migration motos n'est pas encore appliquée (vehicle_type vaut 'CAR' par défaut).
      ...(isMotorcycle
        ? {
            vehicle_type: 'MOTORCYCLE',
            engine_cc: input.engine_cc ?? null,
            license_required: input.license_required ?? null,
          }
        : {}),
    })
    .select()
    .single();

  if (insertError) {
    console.error('[AgencyVehicles] Insert error:', insertError.message);
    if (isMotorcycle && isMotorcycleSchemaMissing(insertError)) {
      return failure(MOTORCYCLE_SCHEMA_MISSING_MESSAGE, 503);
    }
    return failure(`Erreur lors de la création du véhicule: ${insertError.message}`, 500);
  }

  // Insérer les images
  if (input.images.length > 0) {
    const imagesToInsert = input.images.map((url, idx) => ({
      vehicle_id: vehicle.id,
      url,
      is_primary: idx === 0,
      display_order: idx,
    }));
    const { error: imgError } = await supabase.from('vehicle_images').insert(imagesToInsert);
    if (imgError) {
      console.warn('[AgencyVehicles] Images insert warning:', imgError.message);
    }
  }

  // Insérer les équipements (features)
  if (input.features.length > 0) {
    const featuresToInsert = input.features.map((name) => ({
      vehicle_id: vehicle.id,
      name,
    }));
    const { error: featError } = await supabase.from('vehicle_features').insert(featuresToInsert);
    if (featError) {
      console.warn('[AgencyVehicles] Features insert warning:', featError.message);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      ...vehicle,
      images: input.images,
      features: input.features,
    },
  });
}
