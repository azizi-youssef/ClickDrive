import { Agency, AgencyStatus } from '@/types';
import { createClient, createPublicClient } from '@/lib/supabase/server';

function requireSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !url.startsWith('http')) {
    throw new Error(
      'Supabase non configuré. Définissez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
}

export class AgenciesService {
  async getAgencies(onlyActive = true): Promise<Agency[]> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Client Supabase indisponible.');

    let query = supabase.from('agencies').select('*');
    if (onlyActive) {
      query = query.eq('status', 'ACTIVE');
    }
    const { data, error } = await query.order('rating', { ascending: false });
    if (error) {
      console.error('[AgenciesService] getAgencies error:', error.message);
      throw new Error('Impossible de charger les agences.');
    }
    return (data ?? []) as Agency[];
  }

  /**
   * Agences actives lues sans cookies, pour un cache partagé entre visiteurs (catalogue public) :
   * Next interdit cookies() dans unstable_cache. Client anon soumis à la RLS (agences actives seulement) :
   * aucun droit élevé n'est nécessaire. Le résultat doit passer par toPublicAgencies.
   */
  async getActiveAgenciesWithoutSession(): Promise<Agency[]> {
    requireSupabase();
    const supabase = createPublicClient();
    if (!supabase) throw new Error('Client Supabase indisponible.');
    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('rating', { ascending: false });
    if (error) {
      console.error('[AgenciesService] getActiveAgenciesWithoutSession error:', error.message);
      throw new Error('Impossible de charger les agences.');
    }
    return (data ?? []) as Agency[];
  }

  async getAgencyBySlug(slug: string): Promise<Agency | null> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Client Supabase indisponible.');

    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('[AgenciesService] getAgencyBySlug error:', error.message);
      throw new Error('Impossible de charger l\'agence.');
    }
    return (data as Agency) ?? null;
  }

  async getAgencyById(id: string): Promise<Agency | null> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Client Supabase indisponible.');

    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[AgenciesService] getAgencyById error:', error.message);
      throw new Error('Impossible de charger l\'agence.');
    }
    return (data as Agency) ?? null;
  }

  async updateAgencyStatus(
    id: string,
    status: AgencyStatus,
    verified: boolean
  ): Promise<Agency | null> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Client Supabase indisponible.');

    const { data, error } = await supabase
      .from('agencies')
      .update({ status, verified, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[AgenciesService] updateAgencyStatus error:', error.message);
      throw new Error('Impossible de mettre à jour le statut de l\'agence.');
    }
    return data as Agency;
  }

  // Création d'agence : uniquement par POST /api/admin/agencies (permission agencies.create, fonction SQL transactionnelle).

  async getAgencyStats(agencyId: string) {
    const { statsService } = await import('./stats.service');
    return statsService.getAgencyStats(agencyId);
  }

  async getAdminStats() {
    const { statsService } = await import('./stats.service');
    return statsService.getAdminStats();
  }
}

export const agenciesService = new AgenciesService();
