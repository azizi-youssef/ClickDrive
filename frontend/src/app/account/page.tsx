'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { useSearchParams } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useLocalizedRouter } from '@/lib/i18n/useLocalizedRouter';
import { Booking } from '@/types';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { signOutEverywhere } from '@/lib/auth/client';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { loginUrl } from '@/lib/auth/login-portals';
import { ReviewModal } from '@/components/shared/ReviewModal';
import { AccountProfileSettings } from '@/components/shared/AccountProfileSettings';
import { Magnet, GsapReveal } from '@/components/ui/react-bits';

export default function AccountPage() {
  const { t, locale, href, plural, money } = useTranslation();
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

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : c.guest);

  const displayEmail = user?.email || c.notSignedIn;
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const signedInWithGoogle = user?.app_metadata?.provider === 'google';
  const emailVerified = Boolean(user?.email_confirmed_at);

  const tabs = [
    { id: 'bookings', label: c.tabs.bookings, icon: Calendar, count: bookings.length },
    { id: 'profile', label: c.tabs.profile, icon: Settings },
  ] as const;

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-16">
      {/* Profile Header */}
      <div className="bg-linear-to-br from-[#0B1220] via-[#0F172A] to-[#1E293B] text-white pt-10 pb-20 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-16 h-16 rounded-2xl border-2 border-white/30 object-cover shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    {displayName}
                  </h1>
                  {signedInWithGoogle && (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      {c.google}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  {displayEmail}
                </p>

                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-300">
                  {emailVerified && (
                    <>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {c.verified}
                      </span>
                      <span>·</span>
                    </>
                  )}
                  <span>{plural(bookings.length, c.bookingCount)}</span>
                </div>
              </div>
            </div>

            {user ? (
              <div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50"
                >
                  {signingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <LogOut className="w-3.5 h-3.5 text-rose-400" />}
                  {signingOut ? t.navbar.signingOut : t.navbar.signOut}
                </button>
              </div>
            ) : null}
          </div>
          {signOutError && <p role="alert" className="mt-4 text-sm text-red-300">{signOutError}</p>}
        </div>
      </div>

      {/* Main Content with overlap card */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
        {/* Banner if not authenticated */}
        {!user && !loadingUser && (
          <div className="mb-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E63946]/10 text-accent-text flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{c.signInTitle}</p>
                <p className="text-[11px] text-slate-500">{c.signInText}</p>
              </div>
            </div>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
              <Link
                href={loginUrl('client', { redirect: href('/account') })}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {c.emailLogin}
              </Link>
              <GoogleSignInButton variant="light" next={href('/account')} label={c.googleLogin} />
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/5 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => router.replace(`/account?tab=${tab.id}`, { scroll: false })}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors',
                    activeTab === tab.id
                      ? 'border-[#E63946] text-accent-text'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {'count' in tab && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-5 sm:p-6">
            {/* TAB: My Bookings */}
            {activeTab === 'bookings' && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-900">{c.historyTitle}</h2>

                {loadingBookings ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-accent-text" />
                    <span className="text-xs">{c.loading}</span>
                  </div>
                ) : bookings.length > 0 ? (
                  <GsapReveal stagger={0.06} className="space-y-3">
                    {bookings.map((booking) => {
                      const reference = booking.reference || booking.booking_ref || '';
                      return (
                        <div
                          key={booking.id}
                          className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#0B1220] flex items-center justify-center shrink-0">
                              <Car className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {booking.vehicle?.brand} {booking.vehicle?.model}
                                </span>
                                {/* Statut traduit et coloré selon la machine à états (jamais « loué » pour une demande) */}
                                <StatusBadge status={booking.status} locale={locale} size="sm" />
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span className="font-mono font-semibold text-slate-700">{reference}</span>
                                <span>·</span>
                                <MapPin className="w-3 h-3" />
                                <span>{booking.agency?.name}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 justify-between sm:justify-end sm:border-s sm:border-slate-200 sm:ps-4">
                            <div className="text-start sm:text-end">
                              <span className="text-[11px] text-slate-400 block">{c.estimatedTotal}</span>
                              <span className="text-sm font-extrabold text-slate-900">
                                {money(Number(booking.total_price) || 0)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <a
                                href={`/api/bookings/${encodeURIComponent(reference)}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                                title={c.pdf}
                              >
                                PDF
                              </a>
                              {/* Bouton avis — uniquement pour les locations terminées */}
                              {booking.status === 'COMPLETED' && !reviewedBookingIds.has(booking.id) && (
                                <button
                                  type="button"
                                  id={`review-btn-${booking.id}`}
                                  onClick={() => setReviewBooking(booking)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition"
                                  title={c.reviewAction}
                                >
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  {c.review}
                                </button>
                              )}
                              {booking.status === 'COMPLETED' && reviewedBookingIds.has(booking.id) && (
                                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {c.reviewed}
                                </span>
                              )}
                              <Link
                                href={`/account/bookings/${encodeURIComponent(reference)}`}
                                className="px-3 py-1.5 rounded-lg bg-[#0B1220] text-white text-xs font-bold hover:bg-slate-800 transition shadow-2xs"
                              >
                                {c.track}
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </GsapReveal>
                ) : (
                  <div className="text-center py-12 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 text-slate-500 flex items-center justify-center mx-auto shadow-2xs">
                      <Car className="w-6 h-6 text-accent-text" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0B1220]">{c.emptyTitle}</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{c.emptyText}</p>
                    </div>
                    <div className="pt-2 flex justify-center">
                      <Magnet strength={0.2}>
                        <Link
                          href="/search"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-bold shadow-xs hover:shadow-[0_4px_16px_rgba(230,57,70,0.3)] transition-all"
                        >
                          {c.explore}
                        </Link>
                      </Magnet>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Profile — nom et photo enregistrés dans le compte (même formulaire que les espaces pro) */}
            {activeTab === 'profile' &&
              (user ? (
                <AccountProfileSettings />
              ) : (
                <p className="text-sm text-slate-500">{c.profileSignIn}</p>
              ))}
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <Link href="/search" className="inline-flex items-center gap-1.5 text-slate-700 font-semibold hover:text-accent-text transition">
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
            {c.backToSearch}
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
