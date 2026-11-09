import type { Metadata } from 'next';
import Link from '@/components/i18n/LocalizedLink';
import { ReviewInvitationForm } from '@/components/reviews/ReviewInvitationForm';
import { verifyBookingLink } from '@/lib/auth/booking-access-link';
import { createAdminClient } from '@/lib/supabase/server';
import { getTranslations, localizedPageMetadata } from '@/lib/i18n/server';
import { interpolate } from '@/lib/i18n/format';
import { I18nScope } from '@/components/i18n/I18nScope';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('review', null, { robots: { index: false, follow: false } });
}

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type BookingRow = {
  id: string;
  status: string;
  vehicle: { brand: string; model: string } | null;
  agency: { name: string } | null;
};

function Notice({ title, text, cta }: { title: string; text: string; cta: string }) {
  return (
    <div className="text-center">
      <h1 className="text-xl font-extrabold text-[#0B1220]">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      <Link href="/search" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#0B1220] px-5 text-sm font-bold text-white hover:bg-slate-800">
        {cta}
      </Link>
    </div>
  );
}

/** Avis vérifié depuis le lien signé envoyé après la restitution (client avec ou sans compte) */
export default async function ReviewInvitationPage({ params, searchParams }: Props) {
  const { reference: raw } = await params;
  const query = await searchParams;
  const reference = decodeURIComponent(raw).trim().toUpperCase();
  const exp = typeof query.exp === 'string' ? query.exp : '';
  const sig = typeof query.sig === 'string' ? query.sig : '';
  const valid = verifyBookingLink('review', reference, exp, sig);

  let booking: BookingRow | null = null;
  let alreadyReviewed = false;
  if (valid && /^[A-Z0-9-]{6,40}$/.test(reference)) {
    const supabase = await createAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from('bookings')
        .select('id, status, vehicle:vehicles(brand, model), agency:agencies(name)')
        .or(`reference.eq.${reference},booking_ref.eq.${reference}`)
        .maybeSingle();
      booking = (data as unknown as BookingRow) ?? null;
      if (booking) {
        const { count } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('booking_id', booking.id);
        alreadyReviewed = (count ?? 0) > 0;
      }
    }
  }

  const { t } = await getTranslations();
  const r = t.tracking.review;
  const vehicle = booking?.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : r.yourVehicle;

  return (
    <div className="bg-[#F8FAFC] px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {!valid || !booking ? (
          <Notice title={r.invalidTitle} text={r.invalidText} cta={r.seeVehicles} />
        ) : booking.status !== 'COMPLETED' ? (
          <Notice title={r.notFinishedTitle} text={r.notFinishedText} cta={r.seeVehicles} />
        ) : alreadyReviewed ? (
          <Notice title={r.alreadyTitle} text={r.alreadyText} cta={r.seeVehicles} />
        ) : (
          <>
            <p className="font-mono text-xs font-bold text-slate-500">{reference}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#0B1220]">{r.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {interpolate(r.intro, { vehicle, agency: booking.agency?.name ?? r.partnerAgency })}
            </p>
            <div className="mt-6">
              <I18nScope namespaces={['tracking']}>
                <ReviewInvitationForm
                  reference={reference}
                  exp={exp}
                  sig={sig}
                  googleReviewUrl={process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL?.trim() || null}
                />
              </I18nScope>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
