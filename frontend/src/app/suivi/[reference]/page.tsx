import type { Metadata } from 'next';
import Link from '@/components/i18n/LocalizedLink';
import { CalendarDays, Download, MapPin, MessageSquare, Search, Star } from 'lucide-react';
import { BookingProgress } from '@/components/booking/BookingProgress';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { verifyBookingLink, signedBookingLink } from '@/lib/auth/booking-access-link';
import { signedBookingPdfPath } from '@/lib/auth/booking-pdf-link';
import { clickdriveWhatsAppUrl } from '@/lib/constants/contact';
import { bookingsService } from '@/lib/services/bookings.service';
import { getTranslations, localizedPageMetadata } from '@/lib/i18n/server';
import { formatDate, formatMoney, interpolate } from '@/lib/i18n/format';
import { locationLabel } from '@/lib/i18n/labels';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('tracking', null, { robots: { index: false, follow: false } });
}

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CONFIRMED = ['APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'COMPLETED'];
const CLOSED_WITHOUT_RENTAL = ['REJECTED', 'EXPIRED', 'CANCELLED'];

function single(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Suivi d'une demande sans compte, par le lien signé reçu par e-mail ou WhatsApp.
 * N'affiche que l'état de la demande et ses grandes lignes : aucune pièce d'identité, aucun contact client.
 */
export default async function BookingTrackingPage({ params, searchParams }: Props) {
  const { reference: rawReference } = await params;
  const query = await searchParams;
  const reference = decodeURIComponent(rawReference).trim().toUpperCase();
  const valid = verifyBookingLink('track', reference, single(query.exp), single(query.sig));
  const booking = valid ? await bookingsService.getBookingByReference(reference, true).catch(() => null) : null;
  const { locale, t } = await getTranslations();
  const c = t.tracking.tracking;
  // « sam. 12 juillet » dans la langue de la page (date sans heure : même jour partout)
  const formatDay = (value: string) =>
    /^\d{4}-\d{2}-\d{2}/.test(value)
      ? new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
          new Date(`${value.slice(0, 10)}T00:00:00Z`)
        )
      : formatDate(value, locale);

  if (!booking) {
    return (
      <div className="bg-[#F8FAFC] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-[#0B1220]">{c.invalidTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {c.invalidText}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0B1220] px-5 text-sm font-bold text-white hover:bg-slate-800">
              {c.signIn}
            </Link>
            <a
              href={clickdriveWhatsAppUrl(interpolate(c.supportMessage, { reference }))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              {c.askSupport}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const ref = booking.reference || booking.booking_ref || reference;
  const vehicleLabel = booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : c.vehicle;
  const firstName = (booking.customer_name ?? '').trim().split(/\s+/)[0] ?? '';
  const isConfirmed = CONFIRMED.includes(booking.status);
  const agencyDigits = (booking.agency?.whatsapp || booking.agency?.phone || '').replace(/\D/g, '');
  const contactUrl =
    isConfirmed && agencyDigits.length >= 8
      ? `https://wa.me/${agencyDigits}?text=${encodeURIComponent(interpolate(c.agencyMessage, { reference: ref, vehicle: vehicleLabel }))}`
      : clickdriveWhatsAppUrl(interpolate(c.clickdriveMessage, { reference: ref, vehicle: vehicleLabel }));
  const reviewLink = booking.status === 'COMPLETED' ? signedBookingLink('review', ref) : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-10 pb-20 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-600">{ref}</span>
                <StatusBadge status={booking.status} size="sm" locale={locale} />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#0B1220] sm:text-3xl">{vehicleLabel}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {firstName ? interpolate(c.introNamed, { name: firstName }) : c.intro} <strong>{booking.agency?.name ?? c.theAgency}</strong>.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a
                href={signedBookingPdfPath(ref)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 hover:border-slate-400"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {isConfirmed ? c.voucherConfirmed : c.voucherRequest}
              </a>
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0B1220] px-4 text-xs font-bold text-white hover:bg-slate-800"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {isConfirmed && agencyDigits.length >= 8 ? c.contactAgency : c.support}
              </a>
            </div>
          </div>

          <div className="pt-6">
            <BookingProgress status={booking.status} locale={locale} headingId="tracking-progress" />
          </div>
        </div>

        <section aria-labelledby="tracking-details" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 id="tracking-details" className="text-sm font-bold text-[#0B1220]">
            {c.yourRequest}
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="flex gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.period}</dt>
                <dd className="mt-1 text-sm font-bold capitalize text-[#0B1220]">
                  {formatDay(booking.start_date)} → {formatDay(booking.end_date)}
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.pickup}</dt>
                <dd className="mt-1 text-sm font-bold text-[#0B1220]">{booking.pickup_location ? locationLabel(t, booking.pickup_location) : c.atAgency}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.estimatedTotal}</dt>
              <dd className="mt-1 text-sm font-bold text-[#0B1220]">{formatMoney(booking.total_price, locale)}</dd>
              <dd className="text-xs text-slate-500">{c.payAtHandover}</dd>
            </div>
          </dl>
        </section>

        {(CLOSED_WITHOUT_RENTAL.includes(booking.status) || reviewLink) && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {CLOSED_WITHOUT_RENTAL.includes(booking.status) && (
              <Link
                href={`/search?startDate=${booking.start_date.slice(0, 10)}&endDate=${booking.end_date.slice(0, 10)}`}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-action px-5 text-sm font-bold text-white hover:bg-action-hover"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {c.sameDates}
              </Link>
            )}
            {reviewLink && (
              <Link
                href={reviewLink}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B1220] px-5 text-sm font-bold text-white hover:bg-slate-800"
              >
                <Star className="h-4 w-4" aria-hidden="true" />
                {c.leaveReview}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
