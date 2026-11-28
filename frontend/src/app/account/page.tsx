'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { useSearchParams } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useLocalizedRouter } from '@/lib/i18n/useLocalizedRouter';
import type { Booking } from '@/types';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useRealtimeRefresh } from '@/lib/supabase/realtime';
import {
  Calendar,
  Settings,
  Car,
  MapPin,
  CheckCircle2,
  LogOut,
  Sparkles,
  Loader2,
  Star,
  ArrowLeft,
  ArrowRight,
  Download,
  Clock,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchClientAuthProfile, signOutEverywhere, type ClientAuthProfile } from '@/lib/auth/client';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { loginUrl } from '@/lib/auth/login-portals';
import { ReviewModal } from '@/components/shared/ReviewModal';
import { AccountProfileSettings } from '@/components/shared/AccountProfileSettings';
import { Magnet } from '@/components/ui/react-bits';
import { calculateRentalDays } from '@/lib/utils/pricing';

const ACTIVE_STATUSES = new Set([
  'REQUESTED',
  'UNDER_REVIEW',
  'SENT_TO_AGENCY',
  'AGENCY_REVIEW',
  'ALTERNATIVE_PROPOSED',
  'APPROVED',
  'READY_FOR_PICKUP',
  'ACTIVE',
  'PENDING',
]);
const COMPLETED_STATUSES = new Set(['COMPLETED']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'REJECTED']);

export default function AccountPage() {
  const { t, locale, href, plural, money, date } = useTranslation();
  const c = t.account.page;
  const router = useLocalizedRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'profile' ? 'profile' : 'bookings';
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  // Avis : quelle réservation est en cours de notation
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  // Photo de profil qui n'a pas pu se charger : on affiche l'initiale à la place (jamais d'image cassée)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  // Profil du compte (/api/auth/me), comme le menu : photo et nom choisis dans « Mon profil », sinon ceux du compte Google
  const [authProfile, setAuthProfile] = useState<ClientAuthProfile | null>(null);
  // Filtre rapide sur le statut des réservations
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !isSupabaseConfigured()) {
      setLoadingUser(false);
      return;
    }

    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUser(data?.user ?? null);
      setLoadingUser(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Rechargé quand le compte change et après chaque enregistrement de « Mon profil »
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const loadProfile = () => {
      fetchClientAuthProfile()
        .then((profile) => {
          if (active) setAuthProfile(profile);
        })
        .catch(() => {
          /* profil indisponible : le nom et la photo du compte Google restent affichés */
        });
    };
    loadProfile();
    window.addEventListener('clickdrive:profile-updated', loadProfile);
    return () => {
      active = false;
      window.removeEventListener('clickdrive:profile-updated', loadProfile);
    };
  }, [userId]);

  const loadBookings = useCallback(async (isInitial = false) => {
    if (!user) {
      setBookings([]);
      return;
    }
    if (isInitial) setLoadingBookings(true);
    try {
      const res = await fetch('/api/bookings', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.bookings)) {
        setBookings(data.bookings);
      }
    } catch (err) {
      console.error('[AccountPage] Error loading bookings:', err);
    } finally {
      if (isInitial) setLoadingBookings(false);
    }
  }, [user]);

  useEffect(() => {
    void loadBookings(true);
  }, [loadBookings]);

  // Rafraîchissement automatique en direct des réservations du client
  useRealtimeRefresh({
    tables: ['bookings', 'vehicles'],
    onRefresh: () => loadBookings(false),
    enabled: Boolean(user),
    pollingIntervalMs: 20_000,
  });

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOutEverywhere(createClient());
      setUser(null);
      setBookings([]);
    } catch {
      setSignOutError(t.navbar.signOutError);
    } finally {
      setSigningOut(false);
    }
  };

  // Profil du compte connecté seulement (jamais celui d'une session précédente)
  const profile = user && authProfile?.id === user.id ? authProfile : null;

  const displayName =
    profile?.displayName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : c.guest);

  const displayEmail = user?.email || c.notSignedIn;
  const metadataAvatar: unknown = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const googleAvatar = typeof metadataAvatar === 'string' && metadataAvatar.trim() ? metadataAvatar.trim() : null;
  const avatarUrl = profile ? profile.avatarUrl : googleAvatar;
  const signedInWithGoogle = user?.app_metadata?.provider === 'google';
  const emailVerified = Boolean(user?.email_confirmed_at);

  // Statistiques calculées pour l'en-tête client
  const activeBookingsCount = useMemo(
    () => bookings.filter((b) => ACTIVE_STATUSES.has(b.status)).length,
    [bookings]
  );
  const completedBookingsCount = useMemo(
    () => bookings.filter((b) => COMPLETED_STATUSES.has(b.status)).length,
    [bookings]
  );
  const cancelledBookingsCount = useMemo(
    () => bookings.filter((b) => CANCELLED_STATUSES.has(b.status)).length,
    [bookings]
  );

  // Réservations filtrées
  const filteredBookings = useMemo(() => {
    if (statusFilter === 'active') return bookings.filter((b) => ACTIVE_STATUSES.has(b.status));
    if (statusFilter === 'completed') return bookings.filter((b) => COMPLETED_STATUSES.has(b.status));
    if (statusFilter === 'cancelled') return bookings.filter((b) => CANCELLED_STATUSES.has(b.status));
    return bookings;
  }, [bookings, statusFilter]);

  const tabs = [
    { id: 'bookings', label: c.tabs.bookings, icon: Calendar, count: bookings.length },
    { id: 'profile', label: c.tabs.profile, icon: Settings },
  ] as const;

  // Libellés des filtres multilingues
  const filterLabels = {
    fr: { all: 'Toutes', active: 'En cours', completed: 'Terminées', cancelled: 'Annulées' },
    en: { all: 'All', active: 'In progress', completed: 'Completed', cancelled: 'Cancelled' },
    es: { all: 'Todas', active: 'En curso', completed: 'Completadas', cancelled: 'Canceladas' },
    de: { all: 'Alle', active: 'Aktiv', completed: 'Abgeschlossen', cancelled: 'Storniert' },
    nl: { all: 'Alle', active: 'Lopend', completed: 'Afgerond', cancelled: 'Geannuleerd' },
    ar: { all: 'الكل', active: 'جارية', completed: 'مكتملة', cancelled: 'ملغاة' },
  }[locale] || { all: 'Toutes', active: 'En cours', completed: 'Terminées', cancelled: 'Annulées' };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20 text-slate-900">
      {/* ================================================================
          1. PROFILE HEADER — Obsidian luxury styling with ambient background
      ================================================================= */}
      <div
        className="relative overflow-hidden bg-[#0B1220] bg-cover bg-center text-white pt-10 pb-20 border-b border-white/10"
        style={{ backgroundImage: "url('/account.jpg')" }}
      >
        {/* Luxury gradient overlays for high legibility */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-r from-[#05080D]/92 via-[#05080D]/80 to-[#05080D]/65 rtl:bg-linear-to-l"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-[#0B1220] via-transparent to-transparent"
        />

        {/* Subtle automotive radial glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 end-0 h-96 w-96 rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 start-0 h-80 w-80 rounded-full bg-white/5 blur-3xl"
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              {avatarUrl && avatarUrl !== failedAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setFailedAvatarUrl(avatarUrl)}
                  className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white/25 bg-white/10 object-cover shadow-xl"
                />
              ) : (
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-white/20 bg-white/10 text-2xl sm:text-3xl font-extrabold text-white shadow-xl backdrop-blur-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white truncate">
                    {displayName}
                  </h1>
                  {signedInWithGoogle && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                      {c.google}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium truncate">
                  {displayEmail}
                </p>

                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-300">
                  {emailVerified && (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      {c.verified}
                    </span>
                  )}
                  {emailVerified && <span className="text-slate-600">·</span>}
                  <span className="font-semibold text-slate-300">
                    {plural(bookings.length, c.bookingCount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Logout */}
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-200 transition-all hover:text-white disabled:opacity-50 min-h-11 shadow-sm"
                >
                  {signingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  ) : (
                    <LogOut className="w-4 h-4 text-rose-400 rtl:rotate-180" aria-hidden="true" />
                  )}
                  {signingOut ? t.navbar.signingOut : t.navbar.signOut}
                </button>
              ) : null}
            </div>
          </div>

          {/* KPI Summary strip when user has bookings */}
          {user && bookings.length > 0 && (
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 text-center sm:text-start">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 sm:px-4">
                <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  {filterLabels.all}
                </span>
                <span className="mt-0.5 text-lg sm:text-xl font-extrabold text-white">
                  {bookings.length}
                </span>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 sm:px-4">
                <span className="block text-[11px] font-medium text-amber-300 uppercase tracking-wider">
                  {filterLabels.active}
                </span>
                <span className="mt-0.5 text-lg sm:text-xl font-extrabold text-white">
                  {activeBookingsCount}
                </span>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 sm:px-4">
                <span className="block text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
                  {filterLabels.completed}
                </span>
                <span className="mt-0.5 text-lg sm:text-xl font-extrabold text-white">
                  {completedBookingsCount}
                </span>
              </div>
            </div>
          )}

          {signOutError && (
            <p role="alert" className="mt-4 rounded-xl bg-rose-500/20 border border-rose-500/30 px-4 py-2 text-sm text-rose-200">
              {signOutError}
            </p>
          )}
        </div>
      </div>

      {/* ================================================================
          2. MAIN CONTENT AREA
      ================================================================= */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        {/* Banner if not authenticated */}
        {!user && !loadingUser && (
          <div className="mb-6 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand/10 text-accent-text flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{c.signInTitle}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.signInText}</p>
              </div>
            </div>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2.5 shrink-0">
              <Link
                href={loginUrl('client', { redirect: href('/account') })}
                className="inline-flex min-h-11 items-center justify-center px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                {c.emailLogin}
              </Link>
              <GoogleSignInButton variant="light" next={href('/account')} label={c.googleLogin} />
            </div>
          </div>
        )}

        {/* Content Card with Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          {/* Segmented Tabs */}
          <div className="flex items-center border-b border-slate-200 bg-slate-50/50 px-4 sm:px-6 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => router.replace(`/account?tab=${tab.id}`, { scroll: false })}
                  className={cn(
                    'relative flex items-center gap-2.5 px-4 sm:px-6 py-4 text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-12',
                    isActive
                      ? 'text-ink border-b-2 border-brand'
                      : 'text-slate-500 hover:text-slate-800 border-b-2 border-transparent'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-brand' : 'text-slate-400')} aria-hidden="true" />
                  <span>{tab.label}</span>
                  {'count' in tab && tab.count > 0 && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums',
                        isActive ? 'bg-ink text-white' : 'bg-slate-200/80 text-slate-600'
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-5 sm:p-7">
            {/* ==========================================================
                TAB 1: MY BOOKINGS
            =========================================================== */}
            {activeTab === 'bookings' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {c.historyTitle}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {plural(bookings.length, c.bookingCount)}
                    </p>
                  </div>

                  {/* Filter chips when user has bookings */}
                  {bookings.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtres de réservation">
                      <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-bold transition min-h-9 shadow-2xs',
                          statusFilter === 'all'
                            ? 'bg-ink text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        {filterLabels.all} ({bookings.length})
                      </button>
                      {activeBookingsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter('active')}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-bold transition min-h-9 shadow-2xs',
                            statusFilter === 'active'
                              ? 'bg-ink text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {filterLabels.active} ({activeBookingsCount})
                        </button>
                      )}
                      {completedBookingsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter('completed')}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-bold transition min-h-9 shadow-2xs',
                            statusFilter === 'completed'
                              ? 'bg-ink text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {filterLabels.completed} ({completedBookingsCount})
                        </button>
                      )}
                      {cancelledBookingsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter('cancelled')}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-bold transition min-h-9 shadow-2xs',
                            statusFilter === 'cancelled'
                              ? 'bg-ink text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {filterLabels.cancelled} ({cancelledBookingsCount})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {loadingBookings ? (
                  /* Loading Skeletons */
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
                      >
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="h-20 w-28 rounded-xl bg-slate-200 shrink-0" />
                          <div className="space-y-2 flex-1">
                            <div className="h-4 w-40 rounded bg-slate-200" />
                            <div className="h-3 w-48 rounded bg-slate-100" />
                            <div className="h-3 w-28 rounded bg-slate-100" />
                          </div>
                        </div>
                        <div className="h-9 w-28 rounded-xl bg-slate-200 self-end sm:self-center" />
                      </div>
                    ))}
                  </div>
                ) : filteredBookings.length > 0 ? (
                  <div className="space-y-4">
                    {filteredBookings.map((booking) => {
                      const reference = booking.reference || booking.booking_ref || '';
                      const vehicleTitle = booking.vehicle
                        ? `${booking.vehicle.brand} ${booking.vehicle.model}`
                        : c.vehicle;
                      const vehicleImg = booking.vehicle?.images?.[0];
                      const totalDays =
                        Number(booking.total_days) ||
                        (booking.start_date && booking.end_date
                          ? calculateRentalDays(booking.start_date, booking.end_date)
                          : 0);

                      return (
                        <div
                          key={booking.id}
                          className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 transition-all hover:border-slate-300 hover:shadow-card flex flex-col gap-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Left: Thumbnail & Core info */}
                            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
                              {vehicleImg ? (
                                <div className="relative h-20 w-28 sm:h-22 sm:w-32 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={vehicleImg}
                                    alt={vehicleTitle}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-20 w-20 sm:h-22 sm:w-24 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-400">
                                  <Car className="h-8 w-8 text-slate-400" aria-hidden="true" />
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight truncate">
                                    {vehicleTitle}
                                  </span>
                                  <StatusBadge status={booking.status} locale={locale} size="sm" />
                                </div>

                                {/* Reference and agency */}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                    {reference}
                                  </span>
                                  {booking.agency?.name && (
                                    <>
                                      <span>·</span>
                                      <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                        {booking.agency.name}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Dates & Duration */}
                                {booking.start_date && (
                                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600 font-medium">
                                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                                      <Calendar className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
                                      <span>
                                        {date(booking.start_date, 'medium')}
                                        {booking.end_date && ` → ${date(booking.end_date, 'medium')}`}
                                      </span>
                                    </span>
                                    {totalDays > 0 && (
                                      <span className="rounded-full bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                                        {plural(totalDays, t.account.detail.days)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Price & Quick Action Group */}
                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-slate-100 pt-3 sm:border-t-0 sm:border-s sm:border-slate-200 sm:ps-5 sm:pt-0 shrink-0">
                              <div className="text-start sm:text-end">
                                <span className="text-[11px] font-medium text-slate-500 block">
                                  {c.estimatedTotal}
                                </span>
                                <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                  {money(Number(booking.total_price) || 0)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <a
                                  href={`/api/bookings/${encodeURIComponent(reference)}/pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-2xs"
                                  title={c.pdf}
                                >
                                  <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                                  <span>PDF</span>
                                </a>

                                {/* Review button — only for completed bookings */}
                                {booking.status === 'COMPLETED' && !reviewedBookingIds.has(booking.id) && (
                                  <button
                                    type="button"
                                    id={`review-btn-${booking.id}`}
                                    onClick={() => setReviewBooking(booking)}
                                    className="inline-flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition shadow-2xs"
                                    title={c.reviewAction}
                                  >
                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                                    <span>{c.review}</span>
                                  </button>
                                )}
                                {booking.status === 'COMPLETED' && reviewedBookingIds.has(booking.id) && (
                                  <span className="inline-flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>{c.reviewed}</span>
                                  </span>
                                )}

                                <Link
                                  href={`/account/bookings/${encodeURIComponent(reference)}`}
                                  className="inline-flex min-h-10 items-center gap-1.5 px-4 py-2 rounded-xl bg-ink text-white text-xs font-bold hover:bg-slate-800 transition shadow-2xs"
                                >
                                  <span>{c.track}</span>
                                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty State */
                  <div className="text-center py-16 bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 p-8 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center mx-auto shadow-sm">
                      <Car className="w-7 h-7 text-accent-text" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900">{c.emptyTitle}</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                        {c.emptyText}
                      </p>
                    </div>
                    <div className="pt-2 flex justify-center">
                      <Magnet strength={0.2}>
                        <Link
                          href="/search"
                          className="inline-flex min-h-11 items-center gap-2 px-6 py-2.5 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-bold shadow-action transition-all"
                        >
                          <Search className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{c.explore}</span>
                        </Link>
                      </Magnet>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==========================================================
                TAB 2: PROFILE
            =========================================================== */}
            {activeTab === 'profile' &&
              (user ? (
                <AccountProfileSettings />
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 p-6">
                  <p className="text-sm font-semibold text-slate-600">{c.profileSignIn}</p>
                  <Link
                    href={loginUrl('client', { redirect: href('/account?tab=profile') })}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                  >
                    {c.emailLogin}
                  </Link>
                </div>
              ))}
          </div>
        </div>

        {/* Back to catalog navigation */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 text-slate-700 font-semibold hover:text-accent-text transition"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            <span>{c.backToSearch}</span>
          </Link>
        </div>
      </div>

      {/* Modal d'avis — s'ouvre sur les locations terminées */}
      {reviewBooking && (
        <ReviewModal
          bookingId={reviewBooking.id}
          bookingRef={reviewBooking.reference || reviewBooking.booking_ref || reviewBooking.id}
          vehicleName={
            reviewBooking.vehicle
              ? `${reviewBooking.vehicle.brand} ${reviewBooking.vehicle.model}`
              : c.vehicle
          }
          agencyName={reviewBooking.agency?.name || ''}
          vehicleImage={reviewBooking.vehicle?.images?.[0] ?? null}
          onClose={() => setReviewBooking(null)}
          onSuccess={() => {
            setReviewedBookingIds((prev) => new Set(prev).add(reviewBooking.id));
            setReviewBooking(null);
          }}
        />
      )}
    </div>
  );
}
