import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { AGENCY_LANGUAGE_CODES } from '@/lib/agencies/languages';

type RouteContext = { params: Promise<{ id: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

const settingsUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Le nom commercial est requis').max(120).optional(),
  description: z.string().trim().max(1000, 'Description limitée à 1000 caractères').optional(),
  phone: z.string().trim().min(8, 'Numéro de téléphone requis').max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  // Champ facultatif : une chaîne vide efface l'e-mail au lieu d'être refusée
  email: z.union([z.literal(''), z.string().trim().email('Email invalide').max(160)]).optional(),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(80).optional(),
  // Infos pratiques (fiche agence et fiches véhicules) ; un texte vide efface la valeur
  opening_hours: z.string().trim().max(300, 'Horaires limités à 300 caractères').transform((v) => v || null).optional(),
  languages: z.array(z.enum(AGENCY_LANGUAGE_CODES as [string, ...string[]])).max(8).optional(),
  cancellation_policy: z.string().trim().max(600, 'Politique d’annulation limitée à 600 caractères').transform((v) => v || null).optional(),
  delivery_fee_airport: z.number().min(0).max(5000).nullable().optional(),
  delivery_fee_port: z.number().min(0).max(5000).nullable().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'agencies.read');
  if (gate.denied) return gate.denied;

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  const { data: agency, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', agencyId)
    .maybeSingle();

  if (error || !agency) {
    return failure('Agence introuvable.', 404);
  }

  return NextResponse.json({
    success: true,
    data: agency,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: agencyId } = await context.params;
  const gate = await requireAgencyPermissionApi(agencyId, 'agencies.update');
  if (gate.denied) return gate.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure('Corps de requête JSON invalide.', 400);
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return failure(parsed.error.issues.map((i) => i.message).join(', '), 422);
  }

  const supabase = await createAdminClient();
  if (!supabase) return failure('Service de base de données indisponible.', 503);

  const { data: updated, error } = await supabase
    .from('agencies')
    .update(parsed.data)
    .eq('id', agencyId)
    .select()
    .single();

  if (error) {
    console.error('[AgencySettings] Update error:', error.message);
    return failure('Les paramètres n’ont pas pu être enregistrés. Réessayez.', 500);
  }

  return NextResponse.json({
    success: true,
    data: updated,
  });
}
