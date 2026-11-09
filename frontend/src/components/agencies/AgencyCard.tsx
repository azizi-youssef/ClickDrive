'use client';

import React from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { Agency } from '@/types';
import { MapPin, MessageCircle, Star, BadgeCheck, Car, ArrowRight, Sparkles } from 'lucide-react';
import { AgencyLogo } from '@/components/agencies/AgencyLogo';
import { AgencyBanner } from '@/components/agencies/AgencyBanner';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatDecimal } from '@/lib/i18n/format';

interface AgencyCardProps {
  agency: Agency;
  carCount?: number;
}

export function AgencyCard({ agency, carCount }: AgencyCardProps) {
  // N'ajoute la ville que si l'adresse ne la mentionne pas déjà
  const address = agency.address?.trim() ?? '';
  const city = agency.city?.trim() ?? '';
  const location =
    address && city && !address.toLocaleLowerCase('fr').includes(city.toLocaleLowerCase('fr'))
      ? `${address}, ${city}`
      : address || city;
  const hasReviews = (agency.review_count ?? 0) > 0 && agency.rating > 0;
  const { t, locale, fmt, plural } = useTranslation();
  const c = t.agencies.card;
  const hasWhatsApp = (agency.whatsapp ?? '').replace(/\D/g, '').length >= 8;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-[translate,scale,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_24px_48px_-28px_rgba(11,18,32,0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* Bannière + logo */}
      <div className="relative h-36 w-full overflow-hidden bg-ink">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <AgencyBanner name={agency.name} bannerUrl={agency.banner_url} />
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-transparent" aria-hidden="true" />

        {agency.verified && (
          <span className="absolute inset-e-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm backdrop-blur">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            {c.verified}
          </span>
        )}

        <div className="absolute -bottom-7 inset-s-5 h-16 w-16 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
          <AgencyLogo slug={agency.slug} name={agency.name} logoUrl={agency.logo_url} className="h-full w-full object-cover" />
        </div>
      </div>

      {/* Contenu */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-10">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-lg font-extrabold leading-tight tracking-tight text-ink">
            {/* Lien étiré : toute la carte est cliquable */}
            <Link
              href={`/agencies/${agency.slug}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand"
            >
              {agency.name}
            </Link>
          </h3>
          {hasReviews ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700"
              aria-label={fmt(c.ratingAria, { rating: formatDecimal(agency.rating, locale), count: agency.review_count })}
            >
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {formatDecimal(agency.rating, locale)}
              <span className="font-medium text-amber-700/70">({agency.review_count})</span>
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-canvas px-2 py-1 text-[11px] font-bold text-slate-600">
              <Sparkles className="h-3 w-3 text-accent-text" aria-hidden="true" />
              {c.newAgency}
            </span>
          )}
        </div>

        {location && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="line-clamp-1">{location}</span>
          </p>
        )}

        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
          {agency.description?.trim() || c.defaultDescription}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {carCount !== undefined && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink">
              <Car className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {carCount === 0 ? c.fleetSoon : plural(carCount, c.vehicles)}
            </span>
          )}
          {hasWhatsApp && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              WhatsApp
            </span>
          )}
        </div>

        <div className="mt-auto pt-5">
          <span
            aria-hidden="true"
            className="flex min-h-11 items-center justify-between rounded-xl bg-ink px-4 text-sm font-bold text-white transition-colors group-hover:bg-action"
          >
            {c.seeFleet}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180" />
          </span>
        </div>
      </div>
    </article>
  );
}
