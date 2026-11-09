'use client';

import React, { use, useEffect, useState } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { Booking } from '@/types';
import {
  Calendar,
  Download,
  Building2,
  AlertCircle,
  MessageSquare,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { MeetingPointBadge } from '@/components/booking/MeetingPointBadge';
import { BookingProgress } from '@/components/booking/BookingProgress';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { clickdriveWhatsAppUrl } from '@/lib/constants/contact';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface BookingDetailPageProps {
  params: Promise<{ reference: string }>;
}

export default function BookingDetailPage({ params }: BookingDetailPageProps) {
  const { reference: referenceParam } = use(params);
  const { t, locale, fmt, plural, date, money } = useTranslation();
  const c = t.account.detail;
  const tracking = t.tracking.tracking;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(referenceParam)}`);
        const data = await res.json();
        if (data.success && data.booking) {
          setBooking(data.booking);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchBooking();
  }, [referenceParam]);

  if (loading) {
    return (
      <div className="bg-[#F8FAFC] min-h-screen py-16 flex items-center justify-center">
        <div className="text-center space-y-3" role="status">
          <div className="w-10 h-10 border-3 border-[#0B1220] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">{c.loading}</p>
        </div>
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="bg-[#F8FAFC] min-h-screen py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">{c.notFoundTitle}</h2>
          <p className="text-xs text-slate-500">{fmt(c.notFoundText, { reference: referenceParam })}</p>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B1220] text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {c.backToAccount}
          </Link>
        </div>
      </div>
    );
  }

  const reference = booking.reference || booking.booking_ref || '';
  const vehicleName = `${booking.vehicle?.brand ?? ''} ${booking.vehicle?.model ?? ''}`.trim() || tracking.vehicle;
  const isConfirmed = ['APPROVED', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'COMPLETED'].includes(booking.status);
  const conciergeUrl = clickdriveWhatsAppUrl(fmt(tracking.clickdriveMessage, { reference, vehicle: vehicleName }));
  const whatsappText = fmt(tracking.agencyMessage, { reference, vehicle: vehicleName });
  // Pas de numéro de repli inventé : sans numéro d'agence, on oriente vers le support ClickDrive
  const agencyDigits = (booking.agency?.whatsapp || booking.agency?.phone || '').replace(/[^0-9]/g, '');
  const agencyWhatsappUrl = agencyDigits.length >= 8 ? `https://wa.me/${agencyDigits}?text=${encodeURIComponent(whatsappText)}` : null;
  const contactAgency = isConfirmed && agencyWhatsappUrl;
  const totalDays = Number(booking.total_days) || 0;
  const days = plural(totalDays, c.days);

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-10 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Navigation retour */}
        <div className="flex items-center justify-between">
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{c.backToBookings}</span>
          </Link>

          <span className="text-xs text-slate-400 font-mono">{reference}</span>
        </div>

        {/* Statut */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800">
                  {c.file}
                </span>
                <StatusBadge status={booking.status} locale={locale} size="sm" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">{vehicleName}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {fmt(c.offeredBy, { agency: booking.agency?.name ?? tracking.theAgency })} • {c.reference} :{' '}
                <span className="font-mono text-slate-800 font-bold">{reference}</span>
              </p>
            </div>

            {/* Actions PDF & Contact */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
              <a
                href={`/api/bookings/${encodeURIComponent(reference)}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <Download className="w-4 h-4 text-[#0B1220]" />
                <span>{isConfirmed ? tracking.voucherConfirmed : tracking.voucherRequest}</span>
              </a>

              <a
                href={contactAgency ? agencyWhatsappUrl : conciergeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`min-h-11 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${
                  contactAgency
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-[#0B1220] hover:bg-slate-800 text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>{contactAgency ? tracking.contactAgency : tracking.support}</span>
              </a>
            </div>
          </div>

          {/* Suivi de la demande : statuts réels, de l'envoi à la restitution */}
          <div className="pt-6">
            <BookingProgress status={booking.status} locale={locale} headingId="booking-progress" />
          </div>
        </div>

        {/* Détails en 2 colonnes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Colonne principale (dates, point de rendez-vous, conducteur) */}
          <div className="md:col-span-2 space-y-6">

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0B1220]" />
                <span>{c.terms}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">{c.pickup}</span>
                  <p className="font-bold text-slate-900">
                    {fmt(c.dateAt, { date: date(booking.start_date, 'medium'), time: booking.pickup_time || '10:00' })}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1">{booking.pickup_location}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">{c.return}</span>
                  <p className="font-bold text-slate-900">
                    {fmt(c.dateAt, { date: date(booking.end_date, 'medium'), time: booking.dropoff_time || '10:00' })}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1">{booking.dropoff_location}</p>
                </div>
              </div>

              {/* Point de rendez-vous avec consignes */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">{c.meetingPoint}</span>
                <MeetingPointBadge location={booking.pickup_location} showInstructions={true} />
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-slate-500">{c.duration}</span>
                <span className="font-bold text-slate-900">{days}</span>
              </div>
            </div>

            {/* Conducteur */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                {c.driver}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-slate-700">
                <div>
                  <span className="text-[11px] text-slate-400 block">{c.fullName}</span>
                  <span className="font-semibold">{booking.customer_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{c.phone}</span>
                  <span className="font-semibold" dir="ltr">{booking.customer_phone}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{c.idNumber}</span>
                  <span className="font-semibold text-slate-900">{booking.cin || c.onSite}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{c.license}</span>
                  <span className="font-semibold">{booking.license_number || c.onSite}</span>
                </div>
              </div>
            </div>

            {/* Rôle de ClickDrive */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-0.5">{c.legalTitle}</strong>
                {c.legalText}
              </div>
            </div>
          </div>

          {/* Colonne latérale (prix et agence) */}
          <div className="space-y-6">

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                {c.pricing}
              </h3>

              <div className="flex justify-between text-slate-600">
                <span>{c.dailyPrice}</span>
                <span className="font-semibold text-slate-900">{money(Number(booking.daily_price) || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{fmt(c.durationDays, { days })}</span>
                <span className="font-semibold text-slate-900">{money(Number(booking.total_price) || 0)}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-extrabold text-[#0B1220]">
                <span>{c.total}</span>
                <span>{money(Number(booking.total_price) || 0)}</span>
              </div>

              <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>{c.deposit}</span>
                  <span className="font-bold text-slate-800">{money(Number(booking.deposit_amount) || 0)}</span>
                </div>
                <div className="flex justify-between gap-3 text-slate-400 text-[11px]">
                  <span>{c.payment}</span>
                  <span className="text-end">{c.paymentValue}</span>
                </div>
              </div>
            </div>

            {booking.agency && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 text-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#0B1220]" />
                  <span>{c.agency}</span>
                </h3>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{booking.agency.name}</h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {[booking.agency.address, booking.agency.city].filter(Boolean).join(', ')}
                  </p>
                </div>

                {isConfirmed ? (
                  <>
                    <div className="space-y-1 pt-1 text-slate-600 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                      <p className="text-[11px] text-emerald-800 font-semibold mb-1">{c.confirmedByAgency}</p>
                      {booking.agency.phone && (
                        <p>
                          {c.phone} : <strong className="text-slate-900" dir="ltr">{booking.agency.phone}</strong>
                        </p>
                      )}
                      {booking.agency.whatsapp && (
                        <p>
                          {c.whatsapp} : <strong className="text-slate-900" dir="ltr">{booking.agency.whatsapp}</strong>
                        </p>
                      )}
                    </div>

                    {agencyWhatsappUrl && (
                      <a
                        href={agencyWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full min-h-11 py-2.5 px-3 rounded-xl bg-success-soft text-success font-bold flex items-center justify-center gap-2 hover:bg-[#D1FADF] transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" aria-hidden="true" />
                        <span>{c.contactForKeys}</span>
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                      {c.pendingText}
                    </div>

                    <a
                      href={conciergeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-[#0B1220] text-white font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-[#E63946]" />
                      <span>{c.supportFollowUp}</span>
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
