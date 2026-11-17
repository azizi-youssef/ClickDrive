'use client';

import { createClient } from '@/lib/supabase/client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { canPerformAgencyBookingAction } from '@clickdrive/shared/booking-state-machine';
import { signOutEverywhere } from '@/lib/auth/client';
import { canManageAgencyBookings, canManageAgencyFleet } from '@/lib/auth/portals';
import { Sidebar, TRACKING_SECTION, type AgencySection } from '@/components/agency/shell/Sidebar';
import { Topbar } from '@/components/agency/shell/Topbar';
import { Toast } from '@/components/agency/shell/Feedback';
import { ConfirmDialog } from '@/components/agency/shell/Dialog';
import { DateRangeInputs, FilterChips } from '@/components/agency/shell/Controls';
import { RANGE_PRESETS, eyebrow, heading, input as inputClass, resolveRange, type RangePreset } from '@/lib/design/tokens';
import { cn } from '@/lib/utils';
import {
  OverviewPanel,
  type AgendaResource,
  type OverviewResource,
} from '@/components/agency/overview/OverviewPanel';
import {
  BookingsPanel,
  STATUS_FILTERS,
  type AgencyBookingRow,
  type BookingQuery,
  type BookingsPage,
} from '@/components/agency/bookings/BookingsPanel';
import type { BookingAction } from '@/components/agency/bookings/BookingDetailModal';
import {
  BookingDetailModal,
  type BookingDetail,
} from '@/components/agency/bookings/BookingDetailModal';
import { AgencyFleetPanel } from '@/components/agency/fleet/AgencyFleetPanel';
import { VehicleFormModal } from '@/components/agency/fleet/VehicleFormModal';
import { AgencyCalendarPanel } from '@/components/agency/calendar/AgencyCalendarPanel';
import { AgencyRentalsPanel } from '@/components/agency/rentals/AgencyRentalsPanel';
import { AgencyFinancesPanel } from '@/components/agency/finances/AgencyFinancesPanel';
import { AgencyAnalyticsPanel } from '@/components/agency/analytics/AgencyAnalyticsPanel';
import { AgencyCustomersPanel } from '@/components/agency/customers/AgencyCustomersPanel';
import { AgencySettingsPanel } from '@/components/agency/settings/AgencySettingsPanel';
import AgencyAccessPanel from '@/components/agency/AgencyAccessPanel';
import { FleetCapacityCard } from '@/components/agency/subscription/FleetCapacityCard';
import { AgencySubscriptionPanel } from '@/components/agency/subscription/AgencySubscriptionPanel';
import type { AgencySubscription } from '@/types';
import type { UserRole } from '@clickdrive/shared/roles';
import { AGENCY_SECTIONS } from '@/components/agency/shell/Sidebar';
import { sectionFromUrl, statusFromUrl, workspaceUrl } from '@/lib/agency/workspace-url';
import { TO_PROCESS_FILTER } from '@/lib/bookings/agency-queue';
import { useRealtimeRefresh, type RealtimeTable } from '@/lib/supabase/realtime';
import { AGENCY_SIDEBAR_COLLAPSED_KEY, useCollapsedPreference } from '@/lib/ui/use-collapsed-preference';

export type AgencyIdentity = {
  id: string;
  name: string;
  verified: boolean;
  logoUrl: string | null;
};

export type AgencyProfile = {
  role: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type Notice = { id: number; kind: 'success' | 'error'; message: string };

type Alternative = { id: string; brand: string; model: string; daily_price: number };

const PAGE_SIZE = 15;

/** Tables écoutées pour la cloche « demandes à traiter » (constante : aucun réabonnement à chaque rendu) */
const PENDING_REALTIME_TABLES: RealtimeTable[] = ['bookings'];

const SECTION_IDS = new Set<string>(AGENCY_SECTIONS.map((entry) => entry.id));
const STATUS_VALUES = new Set<string>(STATUS_FILTERS.map((entry) => entry.value));

function bookingRefOf(booking: { booking_ref?: string | null; reference?: string | null; id: string }): string {
  return booking.booking_ref ?? booking.reference ?? booking.id;
}

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => ({}));
  const record =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new Error(
      typeof record.error === 'string' ? record.error : `Erreur HTTP ${response.status}`
    );
  }
  return body;
}

function canActOnBookings(role: string | undefined): boolean {
  return role ? canManageAgencyBookings(role as UserRole) : false;
}

function canEditFleet(role: string | undefined): boolean {
  return role ? canManageAgencyFleet(role as UserRole) : false;
}

export function AgencyWorkspace({
  agency,
  profile,
  canViewTracking = false,
}: {
  agency: AgencyIdentity;
  profile: AgencyProfile | null;
  /** tracking.read, vérifié côté serveur : affiche l'entrée « Suivi GPS » (l'API et la base revérifient) */
  canViewTracking?: boolean;
}) {
  const router = useRouter();
  // La section et la réservation ouverte viennent de l'adresse : source unique, Précédent compris
  const searchParams = useSearchParams();
  const bookingParam = searchParams.get('booking');
  const sectionParam = searchParams.get('section');
  const section = sectionFromUrl(sectionParam, bookingParam, SECTION_IDS);
  // Le filtre de statut des réservations est dans l'adresse : le lien « À traiter » du tableau de bord, le
  // rechargement, le partage et « Précédent » retrouvent la même liste
  const statusFilter = statusFromUrl(searchParams.get('status'), STATUS_VALUES);
  const urlFilters = useMemo(() => (statusFilter ? { status: statusFilter } : undefined), [statusFilter]);
  /** Change de section : nouvelle entrée d'historique, sans rechargement serveur */
  const setSection = useCallback((next: string) => {
    // Le suivi GPS est un écran à part entière (carte plein écran, sous-pages) : navigation classique
    if (next === 'tracking') {
      router.push('/agency/tracking');
      return;
    }
    window.history.pushState(null, '', workspaceUrl(next));
  }, [router]);
  // « Réduire » de la barre latérale : préférence mémorisée dans le navigateur (partagée avec le Suivi GPS)
  const [sidebarCollapsed, toggleSidebar] = useCollapsedPreference(AGENCY_SIDEBAR_COLLAPSED_KEY);
  const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
  const [rangeInput, setRangeInput] = useState(() => resolveRange('30d'));
  // Mobile : les dates personnalisées ne s'affichent que sur demande (sélecteur « Dates personnalisées… »)
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  const [stats, setStats] = useState<OverviewResource>({ loading: true, error: null, data: null });
  // Nombre de voitures et de motos (navigation et vue d'ensemble)
  const [fleetTypeCounts, setFleetTypeCounts] = useState<{ CAR: number; MOTORCYCLE: number } | null>(null);
  const [agenda, setAgenda] = useState<AgendaResource>({ loading: true, error: null, data: null });

  const [bookings, setBookings] = useState<BookingsPage | null>(null);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  // Recherche, tri et type vivent ici (ils survivent à un changement de section) ; le statut vient de l'adresse
  const [filters, setFilters] = useState<Omit<BookingQuery, 'status'>>({ q: '', sort: 'created_at' });
  const query = useMemo<BookingQuery>(() => ({ ...filters, status: statusFilter }), [filters, statusFilter]);
  // La page appartient à un filtre : si l'adresse change de statut (Précédent), on revient à la page 1
  const [pageState, setPageState] = useState({ page: 1, status: statusFilter });
  const bookingsPage = pageState.status === statusFilter ? pageState.page : 1;
  // Demandes à traiter, comptées par le serveur sans limite de période (voir loadPending)
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);

  const [selected, setSelected] = useState<BookingDetail | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<readonly Alternative[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  const [pendingAction, setPendingAction] = useState<{
    action: BookingAction;
    reference: string;
    reason: string;
    alternativeVehicleId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  const overviewAbort = useRef<AbortController | null>(null);
  const bookingsAbort = useRef<AbortController | null>(null);
  const noticeId = useRef(0);
  const mounted = useRef(true);

  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(
    () => agency.logoUrl || profile?.avatarUrl || null
  );

  const [subscription, setSubscription] = useState<AgencySubscription | null>(null);
  // Au premier rendu la lecture va partir : le cadre d'attente (et non un vide) occupe déjà la place
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState(false);

  const loadSubscription = useCallback(async () => {
    setSubscriptionLoading(true);
    try {
      const res = await fetch(`/api/agencies/${encodeURIComponent(agency.id)}/subscription`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSubscription(json.data ?? null);
        setSubscriptionError(false);
      } else {
        setSubscriptionError(true);
      }
    } catch {
      // La carte de capacité le dit et propose de réessayer ; le reste du tableau de bord reste utilisable
      setSubscriptionError(true);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [agency.id]);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    const handleUpdate = () => {
      fetch('/api/auth/me', { cache: 'no-store' })
        .then((res) => res.json())
        .then((body) => {
          if (body?.success && body?.user) {
            const logo = body.user.agencyLogoUrl || body.user.avatarUrl;
            if (logo) setCurrentLogoUrl(logo);
          }
        })
        .catch(() => {});
    };
    window.addEventListener('clickdrive:profile-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('clickdrive:profile-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      overviewAbort.current?.abort();
      bookingsAbort.current?.abort();
    };
  }, []);

  const notify = useCallback((kind: Notice['kind'], message: string) => {
    if (!mounted.current) return;
    setNotices((previous) => [...previous.slice(-2), { id: ++noticeId.current, kind, message }]);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutEverywhere(createClient());
      router.replace('/');
      router.refresh();
    } catch (error: unknown) {
      notify(
        'error',
        error instanceof Error ? error.message : 'La déconnexion a échoué. Réessayez.'
      );
      setSigningOut(false);
    }
  }, [notify, router, signingOut]);

  /** Indicateurs et agenda : agregats calculés en base, aucune table ramenée au client. */
  const loadOverview = useCallback(
    async (range: { from?: string; to?: string }) => {
      overviewAbort.current?.abort();
      const controller = new AbortController();
      overviewAbort.current = controller;

      setStats({ loading: true, error: null, data: null });
      setAgenda({ loading: true, error: null, data: null });

      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      const suffix = params.toString() ? `?${params.toString()}` : '';

      try {
        const json = await readJson(
          await fetch(
            `/api/stats/agency/${encodeURIComponent(agency.id)}/dashboard${suffix}`,
            { cache: 'no-store', credentials: 'same-origin', signal: controller.signal }
          )
        );
        if (controller.signal.aborted) return;
        const payload = (json as { data?: { stats: unknown; agenda: unknown } }).data;
        if (!payload) throw new Error('Reponse de statistiques incomplete.');
        setStats({ loading: false, error: null, data: payload.stats as OverviewResource extends { data: infer D } ? D : never });
        setAgenda({ loading: false, error: null, data: payload.agenda as AgendaResource extends { data: infer A } ? A : never });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Impossible de charger les indicateurs.";
        setStats({ loading: false, error: message, data: null });
        setAgenda({ loading: false, error: message, data: null });
      }
    },
    [agency.id]
  );

  /** Une page de reservations : pagination, recherche et tri sont faits par le serveur. */
  const loadBookings = useCallback(
    async (nextQuery: BookingQuery, page: number) => {
      bookingsAbort.current?.abort();
      const controller = new AbortController();
      bookingsAbort.current = controller;

      setBookingsLoading(true);
      setBookingsError(null);

      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (nextQuery.q) params.set('q', nextQuery.q);
      if (nextQuery.status) params.set('status', nextQuery.status);
      if (nextQuery.sort) params.set('sort', nextQuery.sort);
      if (nextQuery.type) params.set('type', nextQuery.type);

      try {
        const json = await readJson(
          await fetch(
            `/api/agencies/${encodeURIComponent(agency.id)}/bookings?${params.toString()}`,
            { cache: 'no-store', credentials: 'same-origin', signal: controller.signal }
          )
        );
        if (controller.signal.aborted) return;
        const payload = json as { data: AgencyBookingRow[]; meta: BookingsPage['meta'] };
        setBookings({ data: payload.data ?? [], meta: payload.meta });
      } catch (error) {
        if (controller.signal.aborted) return;
        setBookingsError(
          error instanceof Error ? error.message : 'Impossible de charger les réservations.'
        );
        setBookings(null);
      } finally {
        if (!controller.signal.aborted) setBookingsLoading(false);
      }
    },
    [agency.id]
  );

  // Les effets ne dependent que des criteres : evite les requetes en boucle.
  useEffect(() => {
    void loadOverview(resolveRange(rangePreset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangePreset]);

  useEffect(() => {
    void loadBookings(query, bookingsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, bookingsPage]);

  /**
   * Demandes à traiter : décompte du serveur (toute la file, quelle que soit la période affichée). L'indicateur
   * des statistiques ne compte que les demandes créées dans la période choisie : une demande ancienne qui
   * attend toujours une réponse disparaissait du badge, de la cloche et de l'alerte avec « Aujourd'hui ».
   */
  const fetchPendingTotal = useCallback(async (): Promise<number | null> => {
    try {
      const json = await readJson(
        await fetch(
          `/api/agencies/${encodeURIComponent(agency.id)}/bookings?status=${TO_PROCESS_FILTER}&pageSize=1`,
          { cache: 'no-store', credentials: 'same-origin' }
        )
      );
      const total = (json as { meta?: { total?: unknown } }).meta?.total;
      return typeof total === 'number' ? total : null;
    } catch {
      // Garde la valeur précédente ; à défaut, l'indicateur de la période sert de repli
      return null;
    }
  }, [agency.id]);

  /** Relecture après une action ou une actualisation */
  const loadPending = useCallback(async () => {
    const total = await fetchPendingTotal();
    if (total !== null && mounted.current) setPendingTotal(total);
  }, [fetchPendingTotal]);

  useEffect(() => {
    let active = true;
    void fetchPendingTotal().then((total) => {
      if (active && total !== null) setPendingTotal(total);
    });
    return () => {
      active = false;
    };
  }, [fetchPendingTotal]);

  /**
   * Nouvelle demande d'un client : la cloche et le badge « à traiter » se mettent à jour sans actualiser
   * la page (Supabase Realtime sur bookings, retour sur l'onglet, relecture toutes les 60 s en secours).
   */
  useRealtimeRefresh({ tables: PENDING_REALTIME_TABLES, onRefresh: loadPending, pollingIntervalMs: 60_000 });

  const onQueryChange = useCallback(
    (next: BookingQuery) => {
      setPageState({ page: 1, status: next.status });
      setFilters({ q: next.q, sort: next.sort, type: next.type });
      if (next.status !== statusFilter) {
        // Un changement de filtre ne crée pas d'entrée d'historique ; le dossier ouvert reste dans l'adresse
        window.history.replaceState(null, '', workspaceUrl('bookings', bookingParam, { status: next.status }));
      }
    },
    [bookingParam, statusFilter]
  );

  const onPageChange = useCallback(
    (page: number) => setPageState({ page: Math.max(1, page), status: statusFilter }),
    [statusFilter]
  );

  /** Ouvre les réservations déjà filtrées sur les demandes à traiter (KPI, alerte et cloche) */
  const openPendingBookings = useCallback(() => {
    window.history.pushState(null, '', workspaceUrl('bookings', null, { status: TO_PROCESS_FILTER }));
  }, []);

  /** Référence du dossier déjà ouvert pour l'adresse courante (évite de le relire) */
  const deepLinkHandled = useRef<string | null>(null);
  /** La fiche ouverte depuis la liste a sa propre entrée d'historique : « Retour » (geste Android) la referme */
  const detailHistoryEntry = useRef(false);

  /** Charge le dossier complet (lieux, horaires, historique) avant affichage. */
  const openDetail = useCallback(async (booking: AgencyBookingRow) => {
    const reference = bookingRefOf(booking);
    // Le dossier ouvert a son adresse. Ouvert depuis la liste : nouvelle entrée d'historique, que « Retour »
    // referme sans quitter la section. Rechargé ou déjà dans l'adresse (lien direct) : entrée remplacée.
    deepLinkHandled.current = reference;
    const url = workspaceUrl(section, reference, urlFilters);
    if (new URLSearchParams(window.location.search).get('booking')) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
      detailHistoryEntry.current = true;
    }
    setSelected(booking as BookingDetail);
    setDetail(null);
    setDetailError(null);
    setLoadingDetail(true);

    try {
      const json = await readJson(
        await fetch(`/api/bookings/${encodeURIComponent(reference)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
      );
      const payload = (json as { booking?: BookingDetail }).booking;
      setDetail(payload ?? (booking as BookingDetail));
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : 'Details du dossier indisponibles ; informations partielles affichees.'
      );
      setDetail(booking as BookingDetail);
    } finally {
      setLoadingDetail(false);
    }
  }, [section, urlFilters]);

  /** Ferme le dossier et retire sa référence de l'adresse (le filtre de statut reste) */
  const closeDetail = useCallback(() => {
    setSelected(null);
    setPendingAction(null);
    if (detailHistoryEntry.current) {
      // Retire l'entrée ajoutée à l'ouverture : l'adresse redevient celle d'avant (filtre compris)
      detailHistoryEntry.current = false;
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', workspaceUrl(section, null, urlFilters));
  }, [section, urlFilters]);

  // « Retour » pendant que le dossier est ouvert (bouton du navigateur, geste Android) : le dossier se ferme
  useEffect(() => {
    if (!selected) return;
    const onPopState = () => {
      if (new URLSearchParams(window.location.search).get('booking')) return;
      detailHistoryEntry.current = false;
      setSelected(null);
      setPendingAction(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selected]);

  /**
   * Lien direct vers un dossier (notification e-mail ou WhatsApp, lien partagé) : le dossier est
   * relu par l'API, qui vérifie qu'il appartient bien à l'agence connectée.
   */
  useEffect(() => {
    if (!bookingParam) {
      deepLinkHandled.current = null;
      return;
    }
    if (deepLinkHandled.current === bookingParam) return;
    deepLinkHandled.current = bookingParam;
    let active = true;
    fetch(`/api/bookings/${encodeURIComponent(bookingParam)}`, { cache: 'no-store', credentials: 'same-origin' })
      .then(readJson)
      .then((json) => {
        const booking = (json as { booking?: BookingDetail }).booking;
        if (!active) return;
        if (!booking) throw new Error('missing');
        setDetailError(null);
        setSelected(booking);
        setDetail(booking);
      })
      .catch(() => {
        if (!active) return;
        notify('error', `Réservation ${bookingParam} introuvable ou non rattachée à votre agence.`);
        window.history.replaceState(null, '', workspaceUrl('bookings'));
      });
    return () => {
      active = false;
    };
  }, [bookingParam, notify]);

  /** Vehicules de remplacement candidats : meme agence, periode demandee. */
  const loadAlternatives = useCallback(
    async (booking: BookingDetail) => {
      setLoadingAlternatives(true);
      try {
        const json = await readJson(
          await fetch(
            `/api/vehicles?agencyId=${encodeURIComponent(agency.id)}&startDate=${encodeURIComponent(booking.start_date)}&endDate=${encodeURIComponent(booking.end_date)}`,
            { cache: 'no-store', credentials: 'same-origin' }
          )
        );
        const rows = (json as { data?: Alternative[] }).data ?? [];
        setAlternatives(rows.filter((row) => row.id !== booking.vehicle_id));
      } catch {
        setAlternatives([]);
      } finally {
        setLoadingAlternatives(false);
      }
    },
    [agency.id]
  );

  useEffect(() => {
    if (!selected) {
      setAlternatives([]);
      return;
    }
    if (!canPerformAgencyBookingAction(selected.status, 'propose_alternative')) return;
    void loadAlternatives(selected);
  }, [selected, loadAlternatives]);

  /**
   * Toute transition passe par l'API, qui applique la machine a etats partagee
   * et journalise l'evenement. Le client ne decide jamais du statut cible.
   */
  const runAction = useCallback(
    async (
      reference: string,
      action: BookingAction,
      payload: { reason?: string; alternativeVehicleId?: string }
    ) => {
      setBusy(true);
      try {
        const json = await readJson(
          await fetch(`/api/bookings/${encodeURIComponent(reference)}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action, ...payload }),
          })
        );
        const ok = (json as { success?: boolean }).success === true;
        notify(
          ok ? 'success' : 'error',
          ok
            ? 'Demande mise a jour. Le client est informe.'
            : "L'action n'a pas pu être appliquée."
        );
        if (ok) {
          closeDetail();
          await loadBookings(query, bookingsPage);
          await loadOverview(resolveRange(rangePreset));
          await loadPending();
        }
      } catch (error) {
        notify('error', error instanceof Error ? error.message : 'Action impossible.');
      } finally {
        setBusy(false);
      }
    },
    [bookingsPage, closeDetail, loadBookings, loadOverview, loadPending, notify, query, rangePreset]
  );

  const downloadPdf = useCallback(
    async (booking: BookingDetail) => {
      const reference = booking.booking_ref ?? booking.reference ?? booking.id;
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(reference)}/pdf`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) {
          throw new Error(`Telechargement impossible (HTTP ${response.status}).`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `reservation-${reference.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify('success', 'Fiche PDF telechargee.');
      } catch (error) {
        notify('error', error instanceof Error ? error.message : 'Telechargement impossible.');
      }
    },
    [notify]
  );

  // Rafraîchi à chaque changement de section (ajout, suppression ou modification de véhicule)
  useEffect(() => {
    let active = true;
    fetch(`/api/agencies/${agency.id}/vehicles?pageSize=1`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (active && json?.success && json.meta?.typeCounts) setFleetTypeCounts(json.meta.typeCounts);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [agency.id, section]);

  // Compteur serveur de toute la file ; repli sur l'indicateur de la période tant qu'il n'est pas arrivé
  const pending = pendingTotal ?? stats.data?.pendingBookings ?? 0;

  const sections: AgencySection[] = AGENCY_SECTIONS.map((sec) => {
    if (sec.id === 'bookings') {
      return {
        ...sec,
        count: pending,
        badge: pending > 0 ? 'alert' : undefined,
      };
    }
    if (sec.id === 'fleet') {
      return { ...sec, count: fleetTypeCounts?.CAR ?? stats.data?.totalVehicles };
    }
    if (sec.id === 'fleet_motos') {
      return { ...sec, count: fleetTypeCounts?.MOTORCYCLE };
    }
    return { ...sec };
  });

  if (canViewTracking) sections.push({ ...TRACKING_SECTION });

  const currentLabel = sections.find((entry) => entry.id === section)?.label ?? 'Agence';
  const canBookings = canActOnBookings(profile?.role);

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <a
        href="#agency-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        Aller au contenu
      </a>

      <Sidebar
        sections={sections}
        active={section}
        onNavigate={setSection}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        agencyName={agency.name}
        verified={agency.verified}
        logoUrl={currentLogoUrl}
        onSignOut={() => void handleSignOut()}
        signingOut={signingOut}
      />

      <div className="min-w-0 flex-1">
        <Topbar
          agencyName={agency.name}
          userLabel={profile?.displayName ?? agency.name}
          avatarUrl={currentLogoUrl}
          crumbs={[{ label: currentLabel }]}
          notifications={
            pending > 0
              ? [
                  {
                    id: 'pending',
                    tone: 'alert',
                    label: `${pending} demande${pending > 1 ? 's' : ''} de réservation à traiter`,
                  },
                ]
              : []
          }
          onRefresh={() => {
            void loadOverview(resolveRange(rangePreset));
            void loadBookings(query, bookingsPage);
            void loadPending();
          }}
          onOpenPending={openPendingBookings}
          refreshing={stats.loading || bookingsLoading}
          onSignOut={() => void handleSignOut()}
          signingOut={signingOut}
          onNavigate={setSection}
          sections={sections}
          activeSection={section}
          pendingCount={pending}
        />

        <main
          id="agency-content"
          className="mx-auto max-w-350 space-y-6 px-4 pt-4 pb-28 sm:px-6 sm:pt-6 lg:px-10 lg:py-8"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              {/* Sur mobile, le nom de l'agence est dans l'en-tête : il n'est pas répété ici */}
              <p className={cn(eyebrow, 'hidden truncate text-accent-text sm:block')}>{agency.name}</p>
              <h1 className={cn('sm:mt-1', heading.page)}>
                {currentLabel}
              </h1>
              {/* Sur mobile, la place va aux données : la date du jour est sur le téléphone */}
              <p className="mt-1 hidden text-sm capitalize text-slate-500 sm:block">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {section === 'overview' && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {/* Mobile : un seul sélecteur au lieu de six boutons sur deux lignes et de deux champs de date */}
                <div className="sm:hidden">
                  <label htmlFor="overview-period" className="sr-only">
                    Période des indicateurs
                  </label>
                  <select
                    id="overview-period"
                    value={customRangeOpen ? 'custom' : rangePreset}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === 'custom') {
                        setCustomRangeOpen(true);
                        return;
                      }
                      const preset = value as RangePreset;
                      setCustomRangeOpen(false);
                      setRangeInput(resolveRange(preset));
                      // Même préréglage qu'avant les dates personnalisées : l'effet ne se relancerait pas
                      if (preset === rangePreset) void loadOverview(resolveRange(preset));
                      else setRangePreset(preset);
                    }}
                    className={cn(inputClass, 'min-h-11')}
                  >
                    {RANGE_PRESETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value="custom">Dates personnalisées…</option>
                  </select>
                </div>
                <div className="hidden sm:block">
                  <FilterChips
                    options={RANGE_PRESETS}
                    value={rangePreset}
                    onChange={(value) => {
                      setCustomRangeOpen(false);
                      setRangePreset(value);
                      setRangeInput(resolveRange(value));
                    }}
                    label="Période des indicateurs"
                  />
                </div>
                <div className={cn(customRangeOpen ? 'block' : 'hidden', 'sm:block')}>
                  <DateRangeInputs
                    value={{ from: rangeInput.from ?? '', to: rangeInput.to ?? '' }}
                    onChange={(next) => {
                      setRangeInput(next);
                      void loadOverview({ from: next.from || undefined, to: next.to || undefined });
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <section aria-label="Notifications" className="space-y-2">
            {notices.map((notice) => (
              <p
                key={notice.id}
                role={notice.kind === 'error' ? 'alert' : 'status'}
                className={
                  notice.kind === 'success'
                    ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
                    : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900'
                }
              >
                {notice.message}
              </p>
            ))}
          </section>

          {section === 'overview' && (
            // Mobile et tablette : alertes et indicateurs d'abord, la carte du forfait ensuite
            <div className="flex flex-col gap-6">
              <div className="order-2 lg:order-none">
                <FleetCapacityCard
                  subscription={subscription}
                  loading={subscriptionLoading}
                  error={subscriptionError}
                  onRetry={() => void loadSubscription()}
                  onOpenUpgradeModal={() => setSection('subscription')}
                />
              </div>
              <div className="order-1 lg:order-none">
                <OverviewPanel
                  stats={stats}
                  agenda={agenda}
                  onRetry={() => void loadOverview(resolveRange(rangePreset))}
                  onOpenBookings={() => setSection('bookings')}
                  pendingNow={pending}
                  onOpenPending={openPendingBookings}
                  onOpenFleet={() => setSection('fleet')}
                  onOpenMotos={() => setSection('fleet_motos')}
                  fleetTypeCounts={fleetTypeCounts}
                  onOpenCalendar={() => setSection('calendar')}
                  onOpenSubscription={() => setSection('subscription')}
                  onAddVehicle={canEditFleet(profile?.role) ? () => setSection('add_vehicle') : undefined}
                />
              </div>
            </div>
          )}

          {section === 'bookings' && (
            <BookingsPanel
              page={bookings}
              loading={bookingsLoading}
              error={bookingsError}
              query={query}
              onQueryChange={onQueryChange}
              onPageChange={onPageChange}
              onRetry={() => void loadBookings(query, bookingsPage)}
              onOpenDetail={(booking) => void openDetail(booking)}
              canAct={canBookings}
              busy={busy}
            />
          )}

          {(section === 'fleet' || section === 'fleet_motos') && (
            <div className="space-y-6">
              <AgencyFleetPanel
                key={section}
                agencyId={agency.id}
                vehicleType={section === 'fleet_motos' ? 'MOTORCYCLE' : 'CAR'}
                canManage={canEditFleet(profile?.role)}
                onNotify={notify}
              />
            </div>
          )}

          {section === 'subscription' && (
            <AgencySubscriptionPanel agencyId={agency.id} />
          )}

          {section === 'add_vehicle' && (
            <div className="space-y-4">
              <VehicleFormModal
                agencyId={agency.id}
                onClose={() => setSection('fleet')}
                onSuccess={() => setSection('fleet')}
              />
            </div>
          )}

          {section === 'calendar' && (
            <AgencyCalendarPanel
              agencyId={agency.id}
              canManage={canEditFleet(profile?.role)}
              onNotify={notify}
            />
          )}

          {section === 'rentals' && (
            <AgencyRentalsPanel
              agencyId={agency.id}
              canManage={canBookings}
            />
          )}

          {section === 'customers' && (
            <AgencyCustomersPanel
              agencyId={agency.id}
            />
          )}

          {section === 'finances' && (
            <AgencyFinancesPanel
              agencyId={agency.id}
            />
          )}

          {section === 'analytics' && (
            <AgencyAnalyticsPanel agencyId={agency.id} agencyName={agency.name} />
          )}

          {section === 'access' && (
            <AgencyAccessPanel
              agencyId={agency.id}
              agencyName={agency.name}
              profile={profile as any}
            />
          )}

          {section === 'settings' && (
            <AgencySettingsPanel
              agencyId={agency.id}
              canManage={canEditFleet(profile?.role)}
            />
          )}
        </main>
      </div>

      {selected && (
        <BookingDetailModal
          booking={selected}
          detail={detail}
          loadingDetail={loadingDetail}
          detailError={detailError}
          canAct={canBookings}
          busy={busy}
          alternatives={alternatives}
          loadingAlternatives={loadingAlternatives}
          onClose={closeDetail}
          onReload={() => void openDetail(selected)}
          onAction={(action, payload) => {
            const reference = bookingRefOf(selected);
            if (action === 'approve') {
              void runAction(reference, action, payload);
              return;
            }
            // Refus et alternative passent par une confirmation explicite.
            setPendingAction({
              action,
              reference,
              reason: payload.reason ?? '',
              alternativeVehicleId: payload.alternativeVehicleId ?? '',
            });
          }}
          onDownloadPdf={() => void downloadPdf(selected)}
        />
      )}

      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.action === 'reject'
              ? 'Refuser cette demande ?'
              : 'Proposer un véhicule alternatif ?'
          }
          message={
            pendingAction.action === 'reject'
              ? 'Le client sera informé du refus et du motif saisi. Cette action est journalisée.'
              : "Le client recevra une proposition de remplacement qu'il pourra accepter ou refuser."
          }
          confirmLabel={
            pendingAction.action === 'reject' ? 'Confirmer le refus' : 'Envoyer la proposition'
          }
          destructive={pendingAction.action === 'reject'}
          busy={busy}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            void runAction(pendingAction.reference, pendingAction.action, {
              reason: pendingAction.reason || undefined,
              alternativeVehicleId: pendingAction.alternativeVehicleId || undefined,
            });
          }}
        />
      )}

      {notices.length > 0 && (
        <Toast
          kind={notices[notices.length - 1]!.kind}
          message={notices[notices.length - 1]!.message}
          onDismiss={() => setNotices([])}
        />
      )}
    </div>
  );
}
