import { createAdminClient, createPublicClient } from '@/lib/supabase/server';
import { requireServiceRoleClient } from '@/lib/supabase/privileged';
import { selectAll } from '@/lib/supabase/select-all';
import {
  SubscriptionPlan,
  AgencySubscription,
  SubscriptionStats,
  SubscriptionStatus,
  type PlanChangeRequest,
  type PlanChangeRequestStatus,
} from '@/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Palier de capacité déduit du nombre de véhicules (même règle que la migration 20261101000100 et le trigger SQL) */
export function capacitySlugForCount(count: number): 'starter' | 'pro' | 'business' | 'unlimited' {
  if (count <= 15) return 'starter';
  if (count <= 25) return 'pro';
  if (count <= 35) return 'business';
  return 'unlimited';
}

type CapacityPlan = { id: string; slug: string; name: string; max_vehicles: number | null };

export type VehicleCapacityCheck = {
  allowed: boolean;
  currentCount: number;
  maxVehicles: number | null;
  planName: string;
  reason?: string;
  /** Vérification impossible (base, configuration) : l'ajout est refusé (fail-closed) */
  unavailable?: boolean;
};

/** Statuts d'abonnement dont la formule fixe la capacité (PAST_DUE : délai de grâce) */
export const CAPACITY_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(['ACTIVE', 'TRIAL', 'PAST_DUE']);

/** Statuts d'abonnement comptés dans le revenu mensuel récurrent */
const BILLED_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(['ACTIVE', 'TRIAL']);

export type CapacitySubscription = {
  status: string | null;
  custom_vehicle_limit: number | null;
  plan: CapacityPlan | null;
};

export type EffectiveCapacity = { plan: CapacityPlan; maxVehicles: number | null; deduced: boolean };

function asLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const limit = Number(value);
  return Number.isFinite(limit) ? limit : null;
}

/**
 * Capacité effective d'une agence — même règle que le trigger SQL enforce_vehicle_capacity() :
 * - abonnement ACTIVE / TRIAL / PAST_DUE : limite de sa formule, ou custom_vehicle_limit s'il est défini ;
 * - sans abonnement, ou abonnement CANCELLED / EXPIRED : palier déduit de la flotte parmi les formules en base ;
 * - aucune formule trouvée : null (l'appelant refuse, fail-closed). max null = illimité.
 */
export function resolveEffectiveCapacity(
  subscription: CapacitySubscription | null,
  vehicleCount: number,
  activePlans: CapacityPlan[]
): EffectiveCapacity | null {
  if (subscription?.plan && CAPACITY_SUBSCRIPTION_STATUSES.has(String(subscription.status))) {
    const custom = asLimit(subscription.custom_vehicle_limit);
    return { plan: subscription.plan, maxVehicles: custom ?? asLimit(subscription.plan.max_vehicles), deduced: false };
  }
  const slug = capacitySlugForCount(vehicleCount);
  const plan = activePlans.find((candidate) => candidate.slug === slug);
  return plan ? { plan, maxVehicles: asLimit(plan.max_vehicles), deduced: true } : null;
}

type SubscriptionRow = {
  id: string;
  agency_id: string;
  status: SubscriptionStatus | null;
  custom_vehicle_limit: number | null;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  price_paid: number | string | null;
  auto_renew: boolean | null;
  payment_method: string | null;
  created_at: string | null;
  plan: Record<string, unknown> | null;
};

function toSubscriptionPlan(raw: Record<string, unknown>): SubscriptionPlan {
  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    min_vehicles: Number(raw.min_vehicles || 1),
    max_vehicles: asLimit(raw.max_vehicles),
    price_monthly: Number(raw.price_monthly || 0),
    currency: String(raw.currency || 'MAD'),
    features: Array.isArray(raw.features) ? (raw.features as string[]) : [],
    badge: (raw.badge as string | undefined) || undefined,
    is_popular: Boolean(raw.is_popular),
    is_active: Boolean(raw.is_active),
    sort_order: Number(raw.sort_order || 0),
  };
}

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
      // Grille publique : client anon soumis à la RLS (formules actives), aucun droit élevé
      const supabase = createPublicClient();
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
    } catch (error) {
      console.error('[SubscriptionService] Formules illisibles en base :', error instanceof Error ? error.message : error);
    }

    // Affichage seulement : identifiants non-UUID, refusés par toute écriture (updateAgencyPlan, requestPlanChange)
    console.warn('[SubscriptionService] Grille par défaut affichée : formules indisponibles en base.');
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
   * Abonnement affiché d'une agence, à partir de données déjà lues (aucune requête) :
   * même règle de capacité que le contrôle d'ajout et le trigger SQL.
   */
  private buildAgencySubscription(input: {
    agencyId: string;
    agencyName: string;
    agencyActive: boolean;
    row: SubscriptionRow | null;
    vehicleCount: number;
    plans: SubscriptionPlan[];
  }): AgencySubscription {
    const { agencyId, agencyName, agencyActive, row, vehicleCount, plans } = input;
    const subscribedPlan = row?.plan ? toSubscriptionPlan(row.plan) : null;
    const validSubscription = Boolean(subscribedPlan && CAPACITY_SUBSCRIPTION_STATUSES.has(String(row?.status)));

    const plan = validSubscription && subscribedPlan ? subscribedPlan : subscribedPlan ?? this.findPlanForCount(vehicleCount, plans);
    const capacity = validSubscription
      ? asLimit(row?.custom_vehicle_limit) ?? plan.max_vehicles
      : this.findPlanForCount(vehicleCount, plans).max_vehicles;

    const today = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    const billingEnd = row?.billing_cycle_end || end.toISOString().slice(0, 10);
    const daysRemaining = Math.max(0, Math.ceil((new Date(billingEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    return {
      id: row?.id || `sub-${agencyId}`,
      agency_id: agencyId,
      agency_name: agencyName,
      plan,
      status: (row?.status as SubscriptionStatus) || 'ACTIVE',
      current_vehicles_count: vehicleCount,
      vehicle_capacity: capacity,
      capacity_usage_pct: capacity === null ? 0 : Math.min(100, Math.round((vehicleCount / Math.max(1, capacity)) * 100)),
      is_at_capacity: capacity !== null && vehicleCount >= capacity,
      can_add_vehicle: capacity === null || vehicleCount < capacity,
      price_monthly: row ? Number(row.price_paid || plan.price_monthly) : plan.price_monthly,
      billing_cycle_start: row?.billing_cycle_start || today,
      billing_cycle_end: billingEnd,
      days_remaining: daysRemaining,
      auto_renew: Boolean(row?.auto_renew ?? true),
      payment_method: row?.payment_method || 'VIREMENT',
      created_at: row?.created_at || new Date().toISOString(),
      // Formule déduite de la flotte (aucun abonnement valide) : jamais comptée comme revenu
      is_deduced: !validSubscription,
      agency_active: agencyActive,
    };
  }

  /**
   * Récupère l'abonnement et la capacité actuelle d'une concession.
   * Les véhicules archivés ne comptent pas. Toute erreur de lecture est levée (jamais un compte à 0 silencieux).
   */
  async getAgencySubscription(agencyId: string): Promise<AgencySubscription> {
    const plans = await this.getSubscriptionPlans();
    // Service-role explicite : les routes appelantes ont vérifié la permission sur l'agence (ou la plateforme)
    const supabase = await requireServiceRoleClient('subscription.read');

    const [agencyRes, countRes, subscriptionRes] = await Promise.all([
      supabase.from('agencies').select('name, status, archived_at').eq('id', agencyId).maybeSingle(),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).is('archived_at', null),
      supabase.from('agency_subscriptions').select('*, plan:subscription_plans(*)').eq('agency_id', agencyId).maybeSingle(),
    ]);
    const failure = agencyRes.error ?? countRes.error ?? subscriptionRes.error;
    if (failure) throw new Error(`Abonnement illisible : ${failure.message}`);

    const agency = agencyRes.data as { name: string; status: string; archived_at: string | null } | null;
    return this.buildAgencySubscription({
      agencyId,
      agencyName: agency?.name ?? 'Mon agence',
      agencyActive: agency?.status === 'ACTIVE' && !agency.archived_at,
      row: (subscriptionRes.data as unknown as SubscriptionRow | null) ?? null,
      vehicleCount: countRes.count ?? 0,
      plans,
    });
  }

  /**
   * Contrôle de capacité avant l'ajout d'un véhicule. Fail-closed : toute erreur de lecture, configuration
   * absente ou formule introuvable refuse l'ajout (`unavailable`). Lecture service-role justifiée : le quota
   * se calcule sur toute la flotte de l'agence, quel que soit le droit de lecture de l'appelant (la route a
   * vérifié vehicles.manage). Le trigger SQL enforce_vehicle_capacity() applique la même règle de façon atomique.
   */
  async canAgencyAddVehicle(agencyId: string): Promise<VehicleCapacityCheck> {
    const UNVERIFIABLE =
      'La capacité de votre formule ne peut pas être vérifiée pour le moment. Réessayez dans quelques instants.';
    const unavailable = (): VehicleCapacityCheck => ({
      allowed: false,
      unavailable: true,
      currentCount: 0,
      maxVehicles: null,
      planName: '',
      reason: UNVERIFIABLE,
    });

    if (!UUID_PATTERN.test(agencyId)) return unavailable();

    let supabase: Awaited<ReturnType<typeof requireServiceRoleClient>>;
    try {
      supabase = await requireServiceRoleClient('subscription.capacity');
    } catch {
      return unavailable();
    }

    try {
      const [subscriptionRes, countRes, plansRes] = await Promise.all([
        supabase
          .from('agency_subscriptions')
          .select('status, custom_vehicle_limit, plan:subscription_plans(id, slug, name, max_vehicles)')
          .eq('agency_id', agencyId)
          .maybeSingle(),
        supabase
          .from('vehicles')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .is('archived_at', null),
        supabase.from('subscription_plans').select('id, slug, name, max_vehicles').eq('is_active', true),
      ]);

      if (subscriptionRes.error || countRes.error || plansRes.error || typeof countRes.count !== 'number') {
        console.error(
          '[SubscriptionService] Capacity check failed:',
          subscriptionRes.error?.message ?? countRes.error?.message ?? plansRes.error?.message ?? 'nombre de véhicules absent'
        );
        return unavailable();
      }

      const subscription = subscriptionRes.data as
        | { status: string | null; custom_vehicle_limit: number | null; plan?: CapacityPlan | CapacityPlan[] | null }
        | null;
      const rawPlan = subscription?.plan ?? null;
      const currentCount = countRes.count;
      const effective = resolveEffectiveCapacity(
        subscription
          ? {
              status: subscription.status,
              custom_vehicle_limit: subscription.custom_vehicle_limit,
              plan: Array.isArray(rawPlan) ? rawPlan[0] ?? null : rawPlan,
            }
          : null,
        currentCount,
        (plansRes.data ?? []) as CapacityPlan[]
      );
      if (!effective) {
        console.error('[SubscriptionService] Capacity check failed: no matching plan in database for agency', agencyId);
        return unavailable();
      }

      const { plan, maxVehicles } = effective;
      if (maxVehicles !== null && currentCount >= maxVehicles) {
        return {
          allowed: false,
          currentCount,
          maxVehicles,
          planName: plan.name,
          reason: `Capacité maximale atteinte (${currentCount}/${maxVehicles} véhicules). Veuillez passer à la formule supérieure pour ajouter ce véhicule.`,
        };
      }
      return { allowed: true, currentCount, maxVehicles, planName: plan.name };
    } catch (error) {
      console.error('[SubscriptionService] Capacity check threw:', error instanceof Error ? error.message : error);
      return unavailable();
    }
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
    // Jamais d'écriture à partir de la grille par défaut (identifiants fictifs)
    if (!UUID_PATTERN.test(targetPlan.id)) {
      return { success: false, error: 'Les formules sont momentanément indisponibles.' };
    }

    try {
      // Service-role explicite : appelé par l'administration (permission plateforme vérifiée par la route)
      const supabase = await requireServiceRoleClient('subscription.update_plan');
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
    if (!UUID_PATTERN.test(target.id)) return { success: false, error: 'Les formules sont momentanément indisponibles.' };

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
    if (!UUID_PATTERN.test(requestId)) return { success: false, error: 'Demande introuvable.' };
    // Service-role explicite : la route a vérifié la permission d'administration plateforme
    const supabase = await requireServiceRoleClient('subscription.decide_plan_change');

    // Une seule transaction (admin_decide_plan_change) : verrou de la demande, formule appliquée et demande
    // close ensemble. Deux décisions simultanées ne peuvent plus diverger.
    const { data: outcome, error } = await supabase.rpc('admin_decide_plan_change', {
      p_request_id: requestId,
      p_decision: decision,
      p_admin_id: adminId,
      p_payment_reference: details.paymentReference ?? null,
      p_note: details.note ?? null,
    });
    if (error) {
      console.error('[SubscriptionService] Décision non enregistrée :', error.code, error.message);
      return { success: false, error: 'La décision n’a pas pu être enregistrée.' };
    }

    const result = (outcome ?? {}) as { ok?: boolean; code?: string; vehicles?: number; max_vehicles?: number };
    if (!result.ok) {
      const messages: Record<string, string> = {
        not_found: 'Demande introuvable.',
        already_decided: 'Cette demande a déjà été traitée.',
        plan_unavailable: 'La formule demandée n’est plus disponible.',
        fleet_exceeds_plan: `La flotte actuelle (${result.vehicles ?? '?'} véhicules) dépasse la capacité de la formule demandée (${result.max_vehicles ?? '?'}).`,
      };
      return { success: false, error: messages[result.code ?? ''] ?? 'La décision n’a pas pu être enregistrée.' };
    }

    const { data } = await supabase.from('subscription_change_requests').select(PLAN_CHANGE_SELECT).eq('id', requestId).maybeSingle();
    return { success: true, request: data ? this.toPlanChangeRequest(data as unknown as PlanChangeRow) : undefined };
  }

  /**
   * Vue globale pour l'administration ClickDrive : 4 requêtes au total (et non ~4 par agence).
   * Agences archivées exclues ; véhicules archivés non comptés. Une erreur de lecture est levée.
   */
  async getAllAgencySubscriptions(): Promise<AgencySubscription[]> {
    // Vue plateforme : service-role explicite (la route vérifie la permission d'administration)
    const supabase = await requireServiceRoleClient('subscription.list_all');

    const [plans, agenciesRes, subscriptionsRes, vehicles] = await Promise.all([
      this.getSubscriptionPlans(),
      supabase.from('agencies').select('id, name, status, archived_at').is('archived_at', null).order('name', { ascending: true }),
      supabase.from('agency_subscriptions').select('*, plan:subscription_plans(*)'),
      selectAll<{ id: string; agency_id: string }>((from, to) =>
        supabase.from('vehicles').select('id, agency_id').is('archived_at', null).order('id').range(from, to)
      ),
    ]);
    const failure = agenciesRes.error ?? subscriptionsRes.error;
    if (failure) throw new Error(`Abonnements illisibles : ${failure.message}`);

    const vehicleCounts = new Map<string, number>();
    for (const vehicle of vehicles) vehicleCounts.set(vehicle.agency_id, (vehicleCounts.get(vehicle.agency_id) ?? 0) + 1);
    const rows = new Map(
      ((subscriptionsRes.data ?? []) as unknown as SubscriptionRow[]).map((row) => [row.agency_id, row] as const)
    );

    return ((agenciesRes.data ?? []) as { id: string; name: string; status: string; archived_at: string | null }[]).map(
      (agency) =>
        this.buildAgencySubscription({
          agencyId: agency.id,
          agencyName: agency.name,
          agencyActive: agency.status === 'ACTIVE' && !agency.archived_at,
          row: rows.get(agency.id) ?? null,
          vehicleCount: vehicleCounts.get(agency.id) ?? 0,
          plans,
        })
    );
  }

  /**
   * Statistiques financières d'abonnement. Revenu mensuel récurrent : seuls les abonnements réels
   * ACTIVE ou TRIAL d'agences actives (une formule déduite de la flotte n'est pas un revenu).
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
      fleetCapacityTotal += s.current_vehicles_count;
      const billed = !s.is_deduced && s.agency_active !== false && BILLED_SUBSCRIPTION_STATUSES.has(s.status);
      if (!billed) continue;

      activeSubscribers++;
      mrr += s.price_monthly;
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
