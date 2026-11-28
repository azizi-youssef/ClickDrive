import { apiFetch } from './client';

export interface AdminStats {
  totalAgencies: number;
  verifiedAgencies: number;
  pendingAgencies: number;
  totalVehicles: number;
  /** Dont motos (absent si le décompte n'a pas pu être fait) */
  totalMotorcycles?: number;
  totalBookings: number;
  totalVolume: number;
}

export interface AgencyStats {
  totalVehicles: number;
  availableVehicles: number;
  currentlyRented: number;
  pendingBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  occupancyRate: number;
}

/**
 * Récupère les statistiques de la plateforme pour l'administration
 */
export async function getAdminStats() {
  return apiFetch<AdminStats>('/api/stats/admin');
}

/**
 * Récupère les statistiques d'une agence spécifique
 */
export async function getAgencyStats(agencyId: string) {
  return apiFetch<AgencyStats>(`/api/stats/agency/${agencyId}`);
}
