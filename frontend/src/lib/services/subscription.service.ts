import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  SubscriptionPlan,
  AgencySubscription,
  SubscriptionStats,
  SubscriptionStatus,
  type PlanChangeRequest,
  type PlanChangeRequestStatus,
} from '@/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLAN_CHANGE_SELECT =
  'id, agency_id, status, amount_due, payment_reference, decision_note, created_at, decided_at, ' +
  'agency:agencies(name), current_plan:subscription_plans!current_plan_id(name), ' +
  'requested_plan:subscription_plans!requested_plan_id(id, slug, name, price_monthly, max_vehicles)';

type PlanChangeRow = {
  id: string;
  agency_id: string;
  status: PlanChangeRequestStatus;
  amount_due: number | string;
  payment_reference: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  agency: { name: string } | null;
  current_plan: { name: string } | null;
  requested_plan: { id: string; slug: string; name: string; price_monthly: number | string; max_vehicles: number | null };
};

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
          console.error('[SubscriptionService] Formule non enregistrée :', error.message);
          return { success: false, error: 'La formule n’a pas pu être enregistrée.' };
        }
      } else {
        return { success: false, error: 'Base de données indisponible.' };
      }
    } catch (err: unknown) {
      console.error('[SubscriptionService] Changement de formule impossible :', err);
      return { success: false, error: 'La formule n’a pas pu être enregistrée.' };
    }

    const updated = await this.getAgencySubscription(agencyId);
    return { success: true, subscription: updated };
  }

  /* ── Demandes de changement de formule (validées après paiement) ───────────── */

  private toPlanChangeRequest(row: PlanChangeRow): PlanChangeRequest {
    return {
      id: row.id,
      agency_id: row.agency_id,
      agency_name: row.agency?.name,
      status: row.status,
      amount_due: Number(row.amount_due) || 0,
      current_plan_name: row.current_plan?.name ?? null,
      requested_plan: {
        id: row.requested_plan.id,
        slug: row.requested_plan.slug,
        name: row.requested_plan.name,
        price_monthly: Number(row.requested_plan.price_monthly) || 0,
        max_vehicles: row.requested_plan.max_vehicles,
      },
      payment_reference: row.payment_reference,
      decision_note: row.decision_note,
      created_at: row.created_at,
      decided_at: row.decided_at,
    };
  }

  /** Demande en attente de paiement d'une agence (une au plus), ou null */
  async getPendingPlanChange(agencyId: string): Promise<PlanChangeRequest | null> {
    const supabase = await createAdminClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('subscription_change_requests')
      .select(PLAN_CHANGE_SELECT)
      .eq('agency_id', agencyId)
      .eq('status', 'PENDING_PAYMENT')
      .maybeSingle();
    if (error) {
      console.error('[SubscriptionService] Lecture de la demande en attente impossible :', error.message);
      return null;
    }
    return data ? this.toPlanChangeRequest(data as unknown as PlanChangeRow) : null;
  }

  /**
   * Une agence demande une autre formule : rien ne change tant que l'administration n'a pas
   * reçu le paiement et validé la demande. Une seule demande en attente par agence.
   */
  async requestPlanChange(
    agencyId: string,
    planSlug: string,
    requestedBy: string
  ): Promise<{ success: true; request: PlanChangeRequest } | { success: false; error: string; conflict?: boolean }> {
    const plans = await this.getSubscriptionPlans();
    const target = plans.find((plan) => plan.slug === planSlug && plan.is_active !== false);
    if (!target) return { success: false, error: 'Formule introuvable.' };

    const current = await this.getAgencySubscription(agencyId);
    if (current.plan.slug === target.slug) return { success: false, error: 'Cette formule est déjà la vôtre.' };
    if (target.max_vehicles !== null && target.max_vehicles < current.current_vehicles_count) {
      return { success: false, error: 'Votre flotte dépasse la capacité de cette formule.' };
    }

    const supabase = await createAdminClient();
    if (!supabase) return { success: false, error: 'Base de données indisponible.' };

    const { data, error } = await supabase
      .from('subscription_change_requests')
      .insert({
        agency_id: agencyId,
        current_plan_id: UUID_PATTERN.test(current.plan.id ?? '') ? current.plan.id : null,
        requested_plan_id: target.id,
        amount_due: target.price_monthly,
        requested_by: requestedBy,
      })
      .select(PLAN_CHANGE_SELECT)
      .single();
    if (error) {
      if (error.code === '23505') {
        return { success: false, conflict: true, error: 'Une demande de changement est déjà en attente de paiement.' };
      }
      console.error('[SubscriptionService] Demande de changement non enregistrée :', error.message);
      return { success: false, error: 'La demande n’a pas pu être enregistrée.' };
    }
    return { success: true, request: this.toPlanChangeRequest(data as unknown as PlanChangeRow) };
  }

  /** L'agence retire sa demande tant qu'elle n'est pas traitée */
  async cancelPlanChange(agencyId: string, requestId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createAdminClient();
    if (!supabase) return { success: false, error: 'Base de données indisponible.' };
    const { data, error } = await supabase
      .from('subscription_change_requests')
      .update({ status: 'CANCELLED', decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('agency_id', agencyId)
      .eq('status', 'PENDING_PAYMENT')
      .select('id')
      .maybeSingle();
    if (error) return { success: false, error: 'La demande n’a pas pu être annulée.' };
    if (!data) return { success: false, error: 'Aucune demande en attente.' };
    return { success: true };
  }

  /** Demandes pour l'administration (en attente d'abord) */
  async listPlanChangeRequests(status?: PlanChangeRequestStatus): Promise<PlanChangeRequest[]> {
    const supabase = await createAdminClient();
    if (!supabase) throw new Error('Base de données indisponible.');
    let query = supabase
      .from('subscription_change_requests')
      .select(PLAN_CHANGE_SELECT)
      .order('created_at', { ascending: false })
      .limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as PlanChangeRow[]).map((row) => this.toPlanChangeRequest(row));
  }

  /**
   * Décision de l'administration. Validation = paiement reçu : la formule demandée est appliquée
   * (nouveau cycle de facturation), puis la demande est close. Refus : la formule actuelle reste.
   */
  async decidePlanChange(
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    adminId: string,
    details: { paymentReference?: string | null; note?: string | null } = {}
  ): Promise<{ success: boolean; error?: string; request?: PlanChangeRequest }> {
    const supabase = await createAdminClient();
    if (!supabase) return { success: false, error: 'Base de données indisponible.' };
    const { data: pending, error: readError } = await supabase
      .from('subscription_change_requests')
      .select(PLAN_CHANGE_SELECT)
      .eq('id', requestId)
      .maybeSingle();
    if (readError) return { success: false, error: 'Lecture de la demande impossible.' };
    if (!pending) return { success: false, error: 'Demande introuvable.' };
    const request = this.toPlanChangeRequest(pending as unknown as PlanChangeRow);
    if (request.status !== 'PENDING_PAYMENT') return { success: false, error: 'Cette demande a déjà été traitée.' };

    if (decision === 'APPROVED') {
      const applied = await this.updateAgencyPlan(request.agency_id, request.requested_plan.slug);
      if (!applied.success) return { success: false, error: applied.error };
    }

    const { data, error } = await supabase
      .from('subscription_change_requests')
      .update({
        status: decision,
        decided_by: adminId,
        decided_at: new Date().toISOString(),
        payment_reference: details.paymentReference?.trim() || null,
        decision_note: details.note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('status', 'PENDING_PAYMENT')
      .select(PLAN_CHANGE_SELECT)
      .maybeSingle();
    if (error || !data) {
      console.error('[SubscriptionService] Décision non enregistrée :', error?.message ?? 'demande déjà traitée');
      return { success: false, error: 'La décision n’a pas pu être enregistrée.' };
    }
    return { success: true, request: this.toPlanChangeRequest(data as unknown as PlanChangeRow) };
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
