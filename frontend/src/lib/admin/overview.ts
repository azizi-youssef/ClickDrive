/**
 * Vue d'ensemble de l'administration : forme de la réponse et regroupement des statuts, partagés par
 * l'API (calcul en base) et l'écran. Les groupes couvrent tous les statuts de la machine à états.
 */
export const ADMIN_OVERVIEW_GROUPS = {
  pending: ['PENDING', 'REQUESTED', 'UNDER_REVIEW', 'SENT_TO_AGENCY', 'AGENCY_REVIEW', 'ALTERNATIVE_PROPOSED'],
  confirmed: ['CONFIRMED', 'APPROVED', 'READY_FOR_PICKUP', 'ACTIVE'],
  completed: ['COMPLETED'],
  closed: ['CANCELLED', 'REJECTED', 'EXPIRED'],
} as const;

export const RECENT_BOOKINGS_LIMIT = 8;
export const PENDING_AGENCIES_LIMIT = 5;

export type AdminOverviewBooking = {
  id: string;
  booking_ref: string | null;
  reference: string | null;
  customer_name: string | null;
  start_date: string;
  end_date: string;
  total_price: number | null;
  status: string;
  created_at: string;
  vehicle: { brand: string; model: string } | null;
  agency: { name: string } | null;
};

export type AdminOverviewAgency = {
  id: string;
  name: string;
  city: string | null;
  email: string | null;
  status: string;
  verified: boolean;
};

/**
 * Décompte d'éléments en attente. Deux cas où le nombre n'existe pas, à ne jamais lire comme « zéro » :
 * `restricted` (le compte n'a pas le droit de les lire) et `unavailable` (la lecture a échoué).
 */
export type AdminOverviewCount = { count: number; restricted?: boolean; unavailable?: boolean };

export type AdminOverview = {
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    closed: number;
    createdLast30Days: number;
    createdPrevious30Days: number;
  };
  recentBookings: AdminOverviewBooking[];
  /** `restricted` : le compte n'a pas le droit de lire les agences */
  pendingAgencies: { count: number; items: AdminOverviewAgency[]; restricted?: boolean };
  /** Messages de contact au statut « Nouveau » (ni pris en charge, ni traités) : droit `customers.read` */
  contactMessages: AdminOverviewCount;
  /** Demandes de changement de formule en attente de paiement : droit `agencies.read` */
  planRequests: AdminOverviewCount;
  generatedAt: string;
};
