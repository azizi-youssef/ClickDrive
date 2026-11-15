import { createAdminClient, createClient } from '@/lib/supabase/server';
import { MOTORCYCLE_CATEGORIES } from '@/lib/vehicles/kind';
import type { AdminStats, AgencyStats } from '@/lib/api/stats.api';
import {
  parseAdminAnalyticsReport,
  parseAgencyAnalyticsReport,
  type AdminAnalyticsReport,
  type AgencyAnalyticsReport,
} from '@/lib/analytics/report';

/** Période refusée par la base (bornes inversées ou plus de 3 ans) : erreur de saisie, pas de serveur */
export class AnalyticsRangeError extends Error {
  constructor() {
    super('La période demandée est invalide (3 ans au plus).');
    this.name = 'AnalyticsRangeError';
  }
}

function requireSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !url.startsWith('http')) {
    throw new Error(
      'Supabase non configuré. Définissez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Réponse de statistiques invalide.');
  }
  return value as Record<string, unknown>;
}

function numeric(value: unknown): number {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error('Valeur de statistique invalide.');
  return result;
}

function isRecordShape(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type AgencyDashboardRange = { from?: string; to?: string };

export type AgencyAgendaEntry = {
  reference: string;
  customerName: string;
  startDate?: string;
  endDate?: string;
  pickupTime?: string | null;
  dropoffTime?: string | null;
  pickupLocation?: string | null;
  vehicleLabel: string;
  status: string;
};

export type AgencyActivityEntry = {
  reference: string;
  customerName: string;
  status: string;
  totalPrice: number;
  createdAt: string | null;
};

export type AgencyDashboardAgenda = {
  upcomingPickups: AgencyAgendaEntry[];
  upcomingReturns: AgencyAgendaEntry[];
  recentActivity: AgencyActivityEntry[];
};

export type AgencyDashboardStats = {
  totalVehicles: number;
  availableVehicles: number;
  reservedVehicles: number;
  rentedVehicles: number;
  maintenanceVehicles: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  grossRevenue: number;
  platformCommission: number;
  agencyNet: number;
  occupancyRate: number;
};

export class StatsService {
  async getAdminStats(): Promise<AdminStats> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Service de statistiques indisponible.');

    const { data, error } = await supabase.rpc('admin_platform_statistics');
    if (error) {
      console.error('[StatsService] Platform statistics failed:', error.message);
      throw new Error('Impossible de charger les statistiques de la plateforme.');
    }
    const result = asRecord(data);

    // Répartition voitures / motos (route réservée à l'administration, client serveur uniquement)
    let totalMotorcycles: number | undefined;
    const admin = await createAdminClient();
    if (admin) {
      const { count, error: motoError } = await admin
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .in('category', [...MOTORCYCLE_CATEGORIES]);
      if (!motoError) totalMotorcycles = count ?? 0;
    }

    return {
      totalAgencies: numeric(result.totalAgencies),
      verifiedAgencies: numeric(result.verifiedAgencies),
      pendingAgencies: numeric(result.pendingAgencies),
      totalVehicles: numeric(result.totalVehicles),
      totalMotorcycles,
      totalBookings: numeric(result.totalBookings),
      totalVolume: numeric(result.totalVolume),
      platformCommission: numeric(result.platformCommission),
      agencyNet: numeric(result.agencyNet),
    };
  }

  async getAgencyStats(agencyId: string): Promise<AgencyStats> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Service de statistiques indisponible.');

    const { data, error } = await supabase.rpc('agency_report_statistics', {
      p_agency_id: agencyId,
    });
    if (error) {
      console.error('[StatsService] Agency statistics failed:', error.message);
      throw new Error('Impossible de charger les indicateurs de cette agence.');
    }
    const result = asRecord(data);
    return {
      totalVehicles: numeric(result.totalVehicles),
      availableVehicles: numeric(result.availableVehicles),
      currentlyRented: numeric(result.currentlyRented),
      pendingBookings: numeric(result.pendingBookings),
      confirmedBookings: numeric(result.confirmedBookings),
      totalRevenue: numeric(result.totalRevenue),
      platformCommission: numeric(result.platformCommission),
      netRevenue: numeric(result.netRevenue),
      occupancyRate: numeric(result.occupancyRate),
    };
  }

  /**
   * Statistiques du dashboard agence, filtrables par periode.
   * Le calcul est fait en base (agregats) : aucune table n'est ramenee au serveur.
   */
  async getAgencyDashboardStats(
    agencyId: string,
    range?: AgencyDashboardRange
  ): Promise<AgencyDashboardStats> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Service de statistiques indisponible.');

    const { data, error } = await supabase.rpc('agency_dashboard_statistics', {
      p_agency_id: agencyId,
      p_from: range?.from ?? null,
      p_to: range?.to ?? null,
    });
    if (error) {
      console.error('[StatsService] Agency dashboard statistics failed:', error.message);
      throw new Error("Impossible de charger les indicateurs de l'agence.");
    }
    const result = asRecord(data);
    return {
      totalVehicles: numeric(result.totalVehicles),
      availableVehicles: numeric(result.availableVehicles),
      reservedVehicles: numeric(result.reservedVehicles),
      rentedVehicles: numeric(result.rentedVehicles),
      maintenanceVehicles: numeric(result.maintenanceVehicles),
      pendingBookings: numeric(result.pendingBookings),
      confirmedBookings: numeric(result.confirmedBookings),
      completedBookings: numeric(result.completedBookings),
      cancelledBookings: numeric(result.cancelledBookings),
      grossRevenue: numeric(result.grossRevenue),
      platformCommission: numeric(result.platformCommission),
      agencyNet: numeric(result.agencyNet),
      occupancyRate: numeric(result.occupancyRate),
    };
  }

  /**
   * Statistiques détaillées de l'agence (entonnoir, délais, occupation, tendances, répartitions) :
   * agrégats calculés par agency_analytics_report(), qui revérifie reports.read sur l'agence.
   */
  async getAgencyAnalytics(agencyId: string, range?: AgencyDashboardRange): Promise<AgencyAnalyticsReport> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Service de statistiques indisponible.');

    const { data, error } = await supabase.rpc('agency_analytics_report', {
      p_agency_id: agencyId,
      p_from: range?.from ?? null,
      p_to: range?.to ?? null,
    });
    if (error) {
      if (error.code === '22023') throw new AnalyticsRangeError();
      console.error('[StatsService] Agency analytics failed:', error.message);
      throw new Error("Impossible de charger les statistiques de l'agence.");
    }
    return parseAgencyAnalyticsReport(data);
  }

  /**
   * Statistiques de la plateforme : admin_analytics_report() (reports.read plateforme, donc SUPER_ADMIN),
   * appelée avec la session de l'utilisateur pour que la base revérifie le droit.
   */
  async getAdminAnalytics(range?: AgencyDashboardRange): Promise<AdminAnalyticsReport> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Service de statistiques indisponible.');

    const { data, error } = await supabase.rpc('admin_analytics_report', {
      p_from: range?.from ?? null,
      p_to: range?.to ?? null,
    });
    if (error) {
      if (error.code === '22023') throw new AnalyticsRangeError();
      console.error('[StatsService] Platform analytics failed:', error.message);
      throw new Error('Impossible de charger les statistiques de la plateforme.');
    }
    return parseAdminAnalyticsReport(data);
  }

  /** Enlevements / retours a venir et activite recente de l'agence. */
  async getAgencyAgenda(agencyId: string): Promise<AgencyDashboardAgenda> {
    requireSupabase();
    const supabase = await createClient();
    if (!supabase) throw new Error('Service de statistiques indisponible.');

    const { data, error } = await supabase.rpc('agency_dashboard_agenda', {
      p_agency_id: agencyId,
    });
    if (error) {
      console.error('[StatsService] Agency agenda failed:', error.message);
      throw new Error("Impossible de charger l'agenda de l'agence.");
    }
    const result = asRecord(data);

    const toEntries = (value: unknown): AgencyAgendaEntry[] => {
      if (!Array.isArray(value)) return [];
      return value.flatMap((entry) => {
        if (!isRecordShape(entry)) return [];
        const row = entry as Record<string, unknown>;
        return [{
          reference: String(row.reference ?? ''),
          customerName: String(row.customerName ?? 'Client'),
          startDate: typeof row.startDate === 'string' ? row.startDate : undefined,
          endDate: typeof row.endDate === 'string' ? row.endDate : undefined,
          pickupTime: typeof row.pickupTime === 'string' ? row.pickupTime : null,
          dropoffTime: typeof row.dropoffTime === 'string' ? row.dropoffTime : null,
          pickupLocation: typeof row.pickupLocation === 'string' ? row.pickupLocation : null,
          vehicleLabel: String(row.vehicleLabel ?? 'Véhicule'),
          status: String(row.status ?? ''),
        }];
      });
    };

    const activity = Array.isArray(result.recentActivity)
      ? result.recentActivity.flatMap((entry) => {
          if (!isRecordShape(entry)) return [];
          const row = entry as Record<string, unknown>;
          return [{
            reference: String(row.reference ?? ''),
            customerName: String(row.customerName ?? 'Client'),
            status: String(row.status ?? ''),
            totalPrice: numeric(row.totalPrice ?? 0),
            createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
          }];
        })
      : [];

    return {
      upcomingPickups: toEntries(result.upcomingPickups),
      upcomingReturns: toEntries(result.upcomingReturns),
      recentActivity: activity,
    };
  }
}

export const statsService = new StatsService();
