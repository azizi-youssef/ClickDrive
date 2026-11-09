import { createClient } from '@/lib/supabase/server';
import { PlatformSettings } from '@/types';

/** Taux par défaut utilisé si `platform_settings` n'est pas configuré (0% dans le modèle abonnement) */
const DEFAULT_COMMISSION_RATE = 0.0;

class CommissionService {
  private cachedRate: number = DEFAULT_COMMISSION_RATE;
  private lastFetched: number = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute de cache serveur

  /**
   * Récupère le taux de commission actuel de la plateforme (en pourcentage, ex: 15.00).
   * Résultat mis en cache 1 minute côté serveur.
   */
  async getCommissionRate(): Promise<number> {
    const now = Date.now();
    if (now - this.lastFetched < this.CACHE_TTL_MS) {
      return this.cachedRate;
    }

    try {
      const supabase = await createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('commission_rate')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data?.commission_rate !== undefined) {
          this.cachedRate = Number(data.commission_rate);
          this.lastFetched = now;
          return this.cachedRate;
        }
      }
    } catch (err) {
      console.warn('[CommissionService] Could not fetch commission rate, using cached value:', err);
    }

    return this.cachedRate;
  }

  /**
   * Récupère tous les paramètres globaux de la plateforme.
   */
  async getPlatformSettings(): Promise<PlatformSettings> {
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            commission_rate: Number(data.commission_rate),
            currency: data.currency || 'MAD',
            payment_fee: Number(data.payment_fee || 0),
            cancellation_fee: Number(data.cancellation_fee || 0),
            updated_at: data.updated_at,
          };
        }
      }
    } catch (err) {
      console.warn('[CommissionService] Could not fetch platform settings:', err);
    }

    return {
      id: 'default',
      commission_rate: this.cachedRate,
      currency: 'MAD',
      payment_fee: 0,
      cancellation_fee: 0,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Met à jour le taux de commission de la plateforme (SUPER_ADMIN uniquement).
   * Les réservations existantes conservent leur taux historique.
   */
  async updateCommissionRate(
    newRate: number
  ): Promise<{ success: boolean; rate: number; error?: string }> {
    const safeRate = Number(newRate);
    if (isNaN(safeRate) || safeRate < 0 || safeRate > 100) {
      return {
        success: false,
        rate: this.cachedRate,
        error: 'Le taux doit être compris entre 0 et 100%',
      };
    }

    try {
      const supabase = await createClient();
      if (!supabase) throw new Error('Client Supabase indisponible.');

      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ commission_rate: safeRate, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_settings')
          .insert({ commission_rate: safeRate, currency: 'MAD' });
        if (error) throw error;
      }

      this.cachedRate = safeRate;
      this.lastFetched = Date.now();
      return { success: true, rate: safeRate };
    } catch (err: unknown) {
      console.error('[CommissionService] updateCommissionRate error:', err);
      // Les erreurs Supabase sont des objets { message }, pas toujours des instances d'Error
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : null;
      return {
        success: false,
        rate: this.cachedRate,
        error: message ?? 'Erreur base de données',
      };
    }
  }
}

export const commissionService = new CommissionService();
