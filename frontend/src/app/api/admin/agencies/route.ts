import { NextRequest, NextResponse } from 'next/server';
import type { AccessPermission } from '@clickdrive/shared';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createAgencyWithAuthSchema } from '@/lib/validations/agency-access';
import {
  generateTemporaryPassword,
  normalizeAgencySlug,
} from '@/lib/utils/agency-credentials';

const AGENCY_SORT_COLUMNS = {
  created_at: 'created_at',
  name: 'name',
  status: 'status',
  city: 'city',
} as const;

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  const gate = await requirePlatformPermissionApi('agencies.read');
  if (gate.denied) return gate.denied;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get('pageSize') ?? '25', 10) || 25));
  const search = (params.get('q') ?? '').trim().slice(0, 120);
  const status = params.get('status') ?? 'ALL';
  const city = (params.get('city') ?? '').trim().slice(0, 80);
  const sort = params.get('sort') ?? 'created_at';
  const direction = params.get('direction') === 'asc';

  if (!['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'ARCHIVED'].includes(status)) {
    return failure('Filtre de statut invalide.', 400);
  }
  if (!Object.hasOwn(AGENCY_SORT_COLUMNS, sort)) {
    return failure('Tri invalide.', 400);
  }

  const adminClient = await createAdminClient();
  const db = adminClient || (await createClient());
  if (!db) return failure('Service de données indisponible.', 503);

  const escapedSearch = search.replace(/[\\%_,()]/g, '\\$&');
  let query = db
    .from('agencies')
    .select(
      'id, name, slug, email, phone, whatsapp, address, city, latitude, longitude, logo_url, status, verified, created_at, updated_at, archived_at, vehicles(count), bookings(count), agency_members(count)',
      { count: 'exact' }
    );

  if (status === 'ARCHIVED') {
    query = query.not('archived_at', 'is', null);
  } else {
    query = query.is('archived_at', null);
    if (status !== 'ALL') {
      query = query.eq('status', status);
    }
  }

  if (search) {
    query = query.or(
      `name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%,city.ilike.%${escapedSearch}%`
    );
  }
  if (city) {
    query = query.eq('city', city);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order(AGENCY_SORT_COLUMNS[sort as keyof typeof AGENCY_SORT_COLUMNS], { ascending: direction })
    .range(from, from + pageSize - 1);

  if (error) {
    console.error('[AdminAgencies] Listing failed:', error.message);
    return failure('Impossible de charger les agences.', 500);
  }

  return NextResponse.json({
    success: true,
    data: (data ?? []).map((agency) => {
      const vehicleCount = agency.vehicles?.[0]?.count;
      return {
        ...agency,
        vehicle_count: typeof vehicleCount === 'number' ? vehicleCount : null,
        booking_count: agency.bookings?.[0]?.count ?? 0,
        member_count: agency.agency_members?.[0]?.count ?? 0,
        vehicles: undefined,
        bookings: undefined,
        agency_members: undefined,
      };
    }),
    meta: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  });
}

export async function POST(request: NextRequest) {
  const permission: AccessPermission = 'agencies.create';
  const gate = await requirePlatformPermissionApi(permission);
  if (gate.denied) return gate.denied;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createAgencyWithAuthSchema.safeParse(body);
  if (!parsed.success) {
    return failure(parsed.error.issues.map((issue) => issue.message).join(', '), 400);
  }

  const supabase = await createClient();
  if (!supabase) return failure('Service de données indisponible.', 503);

  const adminClient = await createAdminClient();
  if (!adminClient) {
    return failure('Service de sécurité administrateur indisponible (SUPABASE_SERVICE_ROLE_KEY requis).', 503);
  }

  const input = parsed.data;
  const normalizedEmail = input.email.trim().toLowerCase();

  // 1. Vérification d'unicité de l'email dans les agences actives
  const { count: existingAgencyCount } = await adminClient
    .from('agencies')
    .select('id', { count: 'exact', head: true })
    .ilike('email', normalizedEmail)
    .is('archived_at', null);

  if (existingAgencyCount && existingAgencyCount > 0) {
    return failure('Une agence active utilise déjà cette adresse e-mail.', 409);
  }

  // 2. Génération / normalisation du mot de passe temporaire sécurisé
  const temporaryPassword = input.password?.trim() || generateTemporaryPassword(14);

  // 3. Génération d'un slug unique
  let candidateSlug = normalizeAgencySlug(input.name);
  let slugSuffix = 1;
  while (true) {
    const { count: slugCount } = await adminClient
      .from('agencies')
      .select('id', { count: 'exact', head: true })
      .eq('slug', candidateSlug);

    if (!slugCount || slugCount === 0) break;
    slugSuffix++;
    candidateSlug = `${normalizeAgencySlug(input.name)}-${slugSuffix}`;
  }

  // 4. Création du compte utilisateur dans Supabase Auth (Serveur sécurisé via Admin API)
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.manager_name || input.name,
      agency_name: input.name,
      role: 'AGENCY_OWNER',
    },
  });

  if (authError) {
    if (authError.message?.includes('already registered') || authError.message?.includes('already been registered')) {
      return failure('Cette adresse e-mail est déjà enregistrée dans le système d’authentification.', 409);
    }
    console.error('[AdminAgencies] Auth user creation failed:', authError.message);
    return failure(`Échec de création du compte d'accès : ${authError.message}`, 500);
  }

  const authUserId = authData.user.id;

  try {
    // 5. Création / synchronisation du profil utilisateur
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: authUserId,
          email: normalizedEmail,
          full_name: input.manager_name || input.name,
          phone: input.phone,
          role: 'AGENCY_OWNER',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      throw new Error(`Échec de création du profil : ${profileError.message}`);
    }

    // 6. Création de l'agence dans la table `agencies`
    const { data: agency, error: agencyError } = await adminClient
      .from('agencies')
      .insert({
        name: input.name,
        slug: candidateSlug,
        email: normalizedEmail,
        phone: input.phone,
        whatsapp: input.whatsapp || input.phone,
        address: input.address,
        city: input.city,
        latitude: input.latitude,
        longitude: input.longitude,
        description: input.description,
        logo_url: input.logo_url,
        status: input.status,
        verified: input.status === 'ACTIVE',
      })
      .select('id, name, slug, email, phone, whatsapp, address, city, latitude, longitude, logo_url, status, verified, created_at, updated_at')
      .single();

    if (agencyError) {
      throw new Error(`Échec d’enregistrement de l’agence : ${agencyError.message}`);
    }

    // 7. Liaison de l'agence et du propriétaire dans `agency_members`
    const { error: memberError } = await adminClient
      .from('agency_members')
      .insert({
        agency_id: agency.id,
        user_id: authUserId,
        role: 'agency_admin',
        status: input.status === 'ACTIVE' ? 'ACTIVE' : 'INVITED',
      });

    if (memberError) {
      throw new Error(`Échec d’attribution des droits agence : ${memberError.message}`);
    }

    // 8. Enregistrement dans les journaux d'audit (sans journaliser le mot de passe !)
    await adminClient.from('audit_logs').insert({
      user_id: gate.auth.userId,
      action: 'AGENCY_CREATE',
      entity_type: 'AGENCY',
      entity_id: agency.id,
      metadata: {
        agency_name: input.name,
        email: normalizedEmail,
        status: input.status,
        city: input.city,
        manager_name: input.manager_name || null,
      },
    });

    // 9. Retour des données avec les identifiants révélés une seule fois pour l'administrateur
    return NextResponse.json(
      {
        success: true,
        data: agency,
        credentials: {
          email: normalizedEmail,
          temporaryPassword,
          manager_name: input.manager_name || input.name,
          loginUrl: '/login?portal=agency',
        },
      },
      { status: 201 }
    );
  } catch (rollbackError) {
    // Nettoyage en cas d'échec pour éviter tout compte auth orphelin
    console.error('[AdminAgencies] Rollback during agency creation:', rollbackError);
    await adminClient.auth.admin.deleteUser(authUserId).catch(() => null);
    const msg = rollbackError instanceof Error ? rollbackError.message : 'Erreur interne de création.';
    return failure(msg, 500);
  }
}
