import type { UserRole, AgencyStatus, BookingStatus } from '@clickdrive/shared';
import type { MotorcycleCategory, MotorcycleLicense, VehicleType } from '@/lib/vehicles/kind';

export type { UserRole, AgencyStatus, BookingStatus };
export type { MotorcycleCategory, MotorcycleLicense, VehicleType };

/** Taxonomie officielle ClickDrive — à utiliser partout (formulaire agence, filtres, validation) */
export type VehicleCategory =
  | 'Économique'
  | 'Compacte'
  | 'Berline'
  | 'SUV'
  | 'Luxe'
  | 'Utilitaire'
  | '7 places'
  | 'Automatique'
  | 'Citadine'
  | MotorcycleCategory;

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  'Économique',
  'Compacte',
  'Berline',
  'SUV',
  'Luxe',
  'Utilitaire',
  '7 places',
  'Automatique',
  'Citadine',
];

export type TransmissionType = 'MANUAL' | 'AUTOMATIC';
export type FuelType = 'DIESEL' | 'GASOLINE' | 'HYBRID' | 'ELECTRIC';
export type VehicleStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'BLOCKED';

export type CommissionStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DUE'
  | 'PAID'
  | 'CANCELLED';

export type DeliveryType =
  | 'AGENCY_PICKUP'
  | 'AIRPORT'
  | 'HOTEL'
  | 'ADDRESS';

export type BookingEventType =
  | 'REQUEST_CREATED'
  | 'CUSTOMER_CONFIRMED'
  | 'PDF_GENERATED'
  | 'SENT_TO_AGENCY'
  | 'AGENCY_VIEWED'
  | 'AGENCY_ACCEPTED'
  | 'AGENCY_REJECTED'
  | 'ALTERNATIVE_PROPOSED'
  | 'CLIENT_NOTIFIED'
  | 'PICKUP_READY'
  | 'RENTAL_STARTED'
  | 'RENTAL_COMPLETED'
  | 'COMMISSION_CONFIRMED'
  | 'COMMISSION_PAID'
  | 'BOOKING_CANCELLED';

export interface BookingEvent {
  id: string;
  booking_id: string;
  actor_id?: string;
  actor_role: 'CUSTOMER' | 'AGENCY_OWNER' | 'AGENCY_MANAGER' | 'AGENCY_STAFF' | 'SUPER_ADMIN' | 'SYSTEM';
  event_type: BookingEventType | string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PlatformSettings {
  id: string;
  commission_rate: number; // e.g. 15.00
  currency: string;
  payment_fee: number;
  cancellation_fee: number;
  created_at?: string;
  updated_at: string;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  logo_url: string;
  banner_url?: string;
  status: AgencyStatus;
  verified: boolean;
  rating: number;
  review_count: number;
  created_at: string;
  /** Nombre de véhicules (agrégation API admin) */
  vehicle_count?: number | null;
}

export interface Vehicle {
  id: string;
  agency_id: string;
  agency?: Agency;
  unit_number: string;
  license_plate: string;
  brand: string;
  model: string;
  slug: string;
  year: number;
  /** Voiture ou moto ; absent avant la migration 20261106000100 (voir vehicleTypeOf) */
  vehicle_type?: VehicleType;
  category: VehicleCategory;
  transmission: TransmissionType;
  fuel: FuelType;
  seats: number;
  doors: number;
  air_conditioning: boolean;
  mileage: number;
  daily_price: number; // in MAD (DH)
  weekly_price?: number;
  monthly_price?: number;
  deposit: number;
  min_rental_days: number;
  status: VehicleStatus;
  published: boolean;
  featured: boolean;
  images: string[];
  features: string[];
  created_at: string;
  /** Date ISO (YYYY-MM-DD) à laquelle le véhicule RENTED redevient disponible */
  available_from?: string;
  /** Livraison à domicile / hôtel disponible */
  delivery_available?: boolean;
  /** Kilométrage illimité inclus */
  unlimited_mileage?: boolean;
  /** Âge minimum du conducteur (ex : 21) */
  min_driver_age?: number;
  /** Motos : cylindrée en cm³ */
  engine_cc?: number | null;
  /** Motos : permis exigé par l'agence */
  license_required?: MotorcycleLicense | null;
}

export interface Booking {
  id: string;
  reference?: string; // e.g. CD-2026-001842
  booking_ref?: string; // alias rétrocompatible
  vehicle_id: string;
  vehicle?: Vehicle;
  agency_id: string;
  agency?: Agency;
  customer_id?: string;
  
  // Informations client
  first_name?: string;
  last_name?: string;
  customer_name: string;
  cin?: string;
  customer_email: string;
  customer_phone: string;
  customer_country?: string;
  birth_date?: string;
  license_number?: string;
  license_expiry?: string;

  // Dates et lieux
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  pickup_time: string;
  dropoff_time: string;
  pickup_location: string;
  dropoff_location: string;
  total_days: number;
  
  // Options
  delivery_type?: DeliveryType;
  flight_number?: string;
  flight_arrival_time?: string;
  child_seat?: boolean;
  additional_driver?: boolean;
  customer_notes?: string;
  agency_notes?: string;
  notes?: string;

  // Calculs financiers
  daily_price: number;
  subtotal?: number;
  total_price: number;
  commission_rate: number; // ex: 15.00
  commission_amount: number; // ex: 270
  agency_amount: number; // ex: 1530
  deposit_amount: number;

  // Statuts
  status: BookingStatus;
  agency_status?: 'PENDING' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'ALTERNATIVE_PROPOSED';
  commission_status?: CommissionStatus;
  rejection_reason?: string;
  alternative_vehicle_id?: string;
  alternative_vehicle?: Vehicle;

  // Documents
  pdf_url?: string;

  // Timestamps
  requested_at?: string;
  reviewed_at?: string;
  confirmed_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at?: string;

  // Événements timeline
  events?: BookingEvent[];
}

export interface Review {
  id: string;
  vehicle_id: string;
  agency_id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  transmission?: string;
  fuel?: string;
  minPrice?: number;
  maxPrice?: number;
  agencyId?: string;
  brand?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: 'starter' | 'pro' | 'business' | 'unlimited' | string;
  min_vehicles: number;
  max_vehicles: number | null; // null = illimité
  price_monthly: number; // en MAD
  currency: string;
  features: string[];
  badge?: string;
  is_popular?: boolean;
  is_active: boolean;
  sort_order: number;
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

export interface AgencySubscription {
  id: string;
  agency_id: string;
  agency_name?: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_vehicles_count: number;
  vehicle_capacity: number | null; // null = illimité
  capacity_usage_pct: number;
  is_at_capacity: boolean;
  can_add_vehicle: boolean;
  price_monthly: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  days_remaining: number;
  auto_renew: boolean;
  payment_method?: string;
  created_at: string;
}

export interface SubscriptionStats {
  monthlyRecurringRevenue: number; // MRR
  activeSubscribers: number;
  totalAgencies: number;
  fleetCapacityTotal: number;
  plansDistribution: {
    planName: string;
    slug: string;
    count: number;
    revenue: number;
  }[];
}
