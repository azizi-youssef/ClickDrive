import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  SubscriptionPlan,
  AgencySubscription,
  SubscriptionStats,
  SubscriptionStatus,
} from '@/types';

/** Grille tarifaire officielle ClickDrive par capacité de flotte */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter',
    slug: 'starter',
    min_vehicles: 5,
    max_vehicles: 15,
    price_monthly: 300,
    currency: 'MAD',
    badge: 'Petite flotte',
    is_popular: false,
    is_active: true,
    sort_order: 1,
    features: [
      'De 5 à 15 véhicules actifs au catalogue',
      '0% de commission sur toutes les réservations',
      '100% des revenus locatifs conservés par la concession',
      'Gestion en direct du calendrier & des indisponibilités',
      'Support client et assistance WhatsApp standard',
    ],
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    slug: 'pro',
    min_vehicles: 15,
    max_vehicles: 25,
    price_monthly: 400,
    currency: 'MAD',
    badge: 'Le plus populaire',
    is_popular: true,
    is_active: true,
    sort_order: 2,
    features: [
      'De 15 à 25 véhicules actifs au catalogue',
      '0% de commission sur toutes les réservations',
      'Mise en avant prioritaire sur le moteur de recherche ClickDrive',
      "Suivi opérationnel simple de la flotte",
      'Gestion multi-utilisateurs (propriétaire & collaborateurs)',
      'Support prioritaire 7j/7',
    ],
  },
  {
    id: 'plan-business',
    name: 'Flotte Business',
    slug: 'business',
    min_vehicles: 25,
    max_vehicles: 35,
    price_monthly: 500,
    currency: 'MAD',
    badge: 'Grande flotte',
    is_popular: false,
    is_active: true,
    sort_order: 3,
    features: [
      'De 25 à 35 véhicules actifs au catalogue',
      '0% de commission sur toutes les réservations',
      'Badge Concessionnaire Officiel Vérifié',
      'Export comptable automatisé et facturation proforma',
      'Gestionnaire de compte ClickDrive dédié',
      'Notifications WhatsApp immédiates pour chaque réservation',
    ],
  },
  {
    id: 'plan-unlimited',
    name: 'Concession Premium',
    slug: 'unlimited',
    min_vehicles: 35,
    max_vehicles: 45,
    price_monthly: 600,
    currency: 'MAD',
    badge: 'Flotte étendue',
    is_popular: false,
    is_active: true,
    sort_order: 4,
    features: [
      "De 35 à 45 véhicules actifs au catalogue",
      '0% de commission sur toutes les réservations',
      'Gestion multi-agences et succursales régionales',
      'Accès API pour synchronisation flotte & ERP',
      'Visibilité marketplace maximale garantie',
      'Ligne directe assistance VIP 24h/24',
    ],
  },
];

class SubscriptionService {
  /**
   * Récupère la liste de tous les forfaits disponibles.
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const supabase = (await createAdminClient()) ?? (await createClient());
      if (supabase) {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            name: d.name,
            slug: d.slug,
            min_vehicles: Number(d.min_vehicles || 1),
            max_vehicles: d.max_vehicles !== null && d.max_vehicles !== undefined ? Number(d.max_vehicles) : null,
            price_monthly: Number(d.price_monthly || 0),
            currency: d.currency || 'MAD',
            features: Array.isArray(d.features) ? d.features : JSON.parse(d.features || '[]'),
            badge: d.badge || undefined,
            is_popular: Boolean(d.is_popular),
            is_active: Boolean(d.is_active),
            sort_order: Number(d.sort_order || 0),
          }));
        }
      }
    } catch {
      // Fallback gracieux sur la configuration par défaut
    }

    return DEFAULT_SUBSCRIPTION_PLANS;
  }

  /**
   * Trouver un plan adapté selon un nombre de véhicules.
   */
  findPlanForCount(count: number, plans: SubscriptionPlan[] = DEFAULT_SUBSCRIPTION_PLANS): SubscriptionPlan {
    if (count <= 15) return plans.find((p) => p.slug === 'starter') || plans[0];
    if (count <= 25) return plans.find((p) => p.slug === 'pro') || plans[1] || plans[0];
    if (count <= 35) return plans.find((p) => p.slug === 'business') || plans[2] || plans[0];
    return plans.find((p) => p.slug === 'unlimited') || plans[3] || plans[0];
  }

  /**
   * Récupère l'abonnement et la capacité actuelle d'une concession.
   */
  async getAgencySubscription(agencyId: string): Promise<AgencySubscription> {
    const plans = await this.getSubscriptionPlans();
    const supabase = (await createAdminClient()) ?? (await createClient());

    let vehicleCount = 0;
    let agencyName = 'Mon agence';

    if (supabase) {
      try {
        const [agencyRes, countRes] = await Promise.all([
          supabase.from('agencies').select('name').eq('id', agencyId).maybeSingle(),
          supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId),
        ]);

        if (agencyRes?.data?.name) {
          agencyName = agencyRes.data.name;
        }
        vehicleCount = countRes?.count ?? 0;
      } catch (err) {
        console.warn('[SubscriptionService] Could not fetch agency or vehicle count:', err);
      }
    }

    // Chercher l'abonnement en base de données
    let row: any = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('agency_subscriptions')
          .select('*, plan:subscription_plans(*)')
          .eq('agency_id', agencyId)
          .maybeSingle();

        if (!error && data) {
          row = data;
        }
      } catch {
        // Table pas encore créée ou RPC manquant
      }
    }

    let plan: SubscriptionPlan;
    let status: SubscriptionStatus = 'ACTIVE';
    let billingStart = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    let billingEnd = end.toISOString().slice(0, 10);
    let pricePaid = 0;
    let autoRenew = true;
    let paymentMethod = 'VIREMENT';

    if (row && row.plan) {
      plan = {
        id: row.plan.id,
        name: row.plan.name,
        slug: row.plan.slug,
        min_vehicles: Number(row.plan.min_vehicles || 1),
        max_vehicles: row.plan.max_vehicles !== null ? Number(row.plan.max_vehicles) : null,
        price_monthly: Number(row.plan.price_monthly || 0),
        currency: row.plan.currency || 'MAD',
        features: Array.isArray(row.plan.features) ? row.plan.features : [],
        badge: row.plan.badge || undefined,
        is_popular: Boolean(row.plan.is_popular),
        is_active: Boolean(row.plan.is_active),
        sort_order: Number(row.plan.sort_order || 0),
      };
      status = row.status || 'ACTIVE';
      billingStart = row.billing_cycle_start || billingStart;
      billingEnd = row.billing_cycle_end || billingEnd;
      pricePaid = Number(row.price_paid || plan.price_monthly);
      autoRenew = Boolean(row.auto_renew ?? true);
      paymentMethod = row.payment_method || 'VIREMENT';
    } else {
      // Calcul déduit basé sur la flotte actuelle
      plan = this.findPlanForCount(vehicleCount, plans);
      pricePaid = plan.price_monthly;
    }

    const capacity = plan.max_vehicles;
    const isAtCapacity = capacity !== null && vehicleCount >= capacity;
    const canAddVehicle = capacity === null || vehicleCount < capacity;
    const capacityUsagePct = capacity === null ? 0 : Math.min(100, Math.round((vehicleCount / capacity) * 100));

    // Jours restants dans la période
    const now = new Date();
    const expiry = new Date(billingEnd);
    const diffTime = expiry.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      id: row?.id || `sub-${agencyId}`,
      agency_id: agencyId,
      agency_name: agencyName,
      plan,
      status,
      current_vehicles_count: vehicleCount,
      vehicle_capacity: capacity,
      capacity_usage_pct: capacityUsagePct,
      is_at_capacity: isAtCapacity,
      can_add_vehicle: canAddVehicle,
      price_monthly: pricePaid,
      billing_cycle_start: billingStart,
      billing_cycle_end: billingEnd,
      days_remaining: daysRemaining,
      auto_renew: autoRenew,
      payment_method: paymentMethod,
      created_at: row?.created_at || new Date().toISOString(),
    };
  }

  /**
   * Vérifie si une agence est autorisée à ajouter un véhicule selon sa capacité souscrite.
   */
  async canAgencyAddVehicle(agencyId: string): Promise<{
    allowed: boolean;
    currentCount: number;
    maxVehicles: number | null;
    planName: string;
    reason?: string;
  }> {
    const sub = await this.getAgencySubscription(agencyId);

    if (sub.is_at_capacity) {
      return {
        allowed: false,
        currentCount: sub.current_vehicles_count,
        maxVehicles: sub.vehicle_capacity,
        planName: sub.plan.name,
        reason: `Capacité maximale atteinte (${sub.current_vehicles_count}/${sub.vehicle_capacity} véhicules). Veuillez passer à la formule supérieure pour ajouter ce véhicule.`,
      };
    }

    return {
      allowed: true,
      currentCount: sub.current_vehicles_count,
      maxVehicles: sub.vehicle_capacity,
      planName: sub.plan.name,
    };
  }

  /**
   * Met à jour le forfait d'une agence.
   */
  async updateAgencyPlan(
    agencyId: string,
    planSlug: string
  ): Promise<{ success: boolean; subscription?: AgencySubscription; error?: string }> {
    const plans = await this.getSubscriptionPlans();
    const targetPlan = plans.find((p) => p.slug === planSlug);
    if (!targetPlan) {
      return { success: false, error: 'Forfait introuvable' };
    }

    try {
      const supabase = (await createAdminClient()) ?? (await createClient());
      if (supabase) {
        const start = new Date().toISOString().slice(0, 10);
        const end = new Date();
        end.setMonth(end.getMonth() + 1);

        const { error } = await supabase.from('agency_subscriptions').upsert(
          {
            agency_id: agencyId,
            plan_id: targetPlan.id,
            status: 'ACTIVE',
            price_paid: targetPlan.price_monthly,
            billing_cycle_start: start,
            billing_cycle_end: end.toISOString().slice(0, 10),
            auto_renew: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id' }
        );

        if (error) {
          console.warn('[SubscriptionService] Could not upsert agency subscription to DB:', error.message);
        }
      }
    } catch (err: any) {
      console.warn('[SubscriptionService] Error updating plan:', err);
    }

    const updated = await this.getAgencySubscription(agencyId);
    return { success: true, subscription: updated };
  }

  /**
   * Vue globale pour l'administration ClickDrive.
   */
  async getAllAgencySubscriptions(): Promise<AgencySubscription[]> {
    const supabase = (await createAdminClient()) ?? (await createClient());
    if (!supabase) return [];

    try {
      const { data: agencies, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name', { ascending: true });

      if (error || !agencies) return [];

      const list = await Promise.all(
        agencies.map((a: any) => this.getAgencySubscription(a.id))
      );
      return list;
    } catch (err) {
      console.warn('[SubscriptionService] Failed to load all subscriptions:', err);
      return [];
    }
  }

  /**
   * Statistiques financières d'abonnement (MRR, taux d'occupation de flotte, etc.).
   */
  async getSubscriptionStats(): Promise<SubscriptionStats> {
    const subs = await this.getAllAgencySubscriptions();
    const plans = await this.getSubscriptionPlans();

    let mrr = 0;
    let activeSubscribers = 0;
    let fleetCapacityTotal = 0;

    const distributionMap: Record<string, { count: number; revenue: number; name: string }> = {};
    for (const p of plans) {
      distributionMap[p.slug] = { count: 0, revenue: 0, name: p.name };
    }

    for (const s of subs) {
      if (s.status === 'ACTIVE' || s.status === 'TRIAL') {
        activeSubscribers++;
        mrr += s.price_monthly;
      }
      fleetCapacityTotal += s.current_vehicles_count;

      const slug = s.plan.slug;
      if (!distributionMap[slug]) {
        distributionMap[slug] = { count: 0, revenue: 0, name: s.plan.name };
      }
      distributionMap[slug].count++;
      distributionMap[slug].revenue += s.price_monthly;
    }

    const plansDistribution = Object.entries(distributionMap).map(([slug, data]) => ({
      slug,
      planName: data.name,
      count: data.count,
      revenue: data.revenue,
    }));

    return {
      monthlyRecurringRevenue: mrr,
      activeSubscribers,
      totalAgencies: subs.length,
      fleetCapacityTotal,
      plansDistribution,
    };
  }
}

export const subscriptionService = new SubscriptionService();
