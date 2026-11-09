import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api/server-error';
import { CONTACT_ALERT_LATEST_LIMIT, type ContactAlertSummary } from '@/lib/admin/contact-alerts';
import { requirePlatformPermissionApi } from '@/lib/auth/access-api';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Résumé léger des messages de contact non traités, interrogé régulièrement par le tableau de bord :
 * compteur du menu « Messages » et alerte à l'arrivée d'un nouveau message.
 */
export async function GET() {
  const gate = await requirePlatformPermissionApi('customers.read');
  if (gate.denied) return gate.denied;
  try {
    const supabase = await createAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Base de données indisponible' }, { status: 503 });
    }
    const [count, latest] = await Promise.all([
      supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'NEW'),
      supabase
        .from('contact_messages')
        .select('id, reference, name, category, subject, created_at')
        .eq('status', 'NEW')
        .order('created_at', { ascending: false })
        .limit(CONTACT_ALERT_LATEST_LIMIT),
    ]);
    if (count.error) throw count.error;
    if (latest.error) throw latest.error;
    const data: ContactAlertSummary = {
      newCount: count.count ?? 0,
      latest: (latest.data ?? []) as ContactAlertSummary['latest'],
    };
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return serverError(error, '/api/admin/contact-messages/summary');
  }
}
