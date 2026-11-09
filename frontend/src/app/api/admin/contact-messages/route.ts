import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverError } from '@/lib/api/server-error';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';

const STATUSES = ['NEW', 'IN_PROGRESS', 'CLOSED'] as const;

const updateSchema = z.object({
  id: z.string().uuid('Identifiant invalide'),
  status: z.enum(STATUSES, { message: 'Statut invalide' }),
});

/** Messages du formulaire de contact, du plus récent au plus ancien (filtre de statut facultatif) */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformPermissionApi('customers.read');
  if (gate.denied) return gate.denied;
  try {
    const supabase = await createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Base de données indisponible' }, { status: 503 });
    }
    const status = req.nextUrl.searchParams.get('status');
    let query = supabase
      .from('contact_messages')
      .select('id, reference, name, email, phone, category, subject, message, status, team_notified_at, acknowledged_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return serverError(error, '/api/admin/contact-messages');
  }
}

/** Suivi du traitement : nouveau → en cours → clos */
export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformPermissionApi('customers.read');
  if (gate.denied) return gate.denied;
  try {
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const supabase = await createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Base de données indisponible' }, { status: 503 });
    }
    const { data, error } = await supabase
      .from('contact_messages')
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.id)
      .select('id, status')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Message introuvable' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return serverError(error, '/api/admin/contact-messages');
  }
}
