'use client';

import React from 'react';
import Link from '@/components/i18n/LocalizedLink';
import Image from 'next/image';
import { Vehicle } from '@/types';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Badge } from '@/components/ui/Badge';
import { Star, ArrowRight, Sparkles, Building2 } from 'lucide-react';

interface SameModelAlternativesProps {
  currentVehicle: Vehicle;
  alternatives: Vehicle[];
}

export function SameModelAlternatives({
  currentVehicle,
  alternatives,
}: SameModelAlternativesProps) {
  if (alternatives.length === 0) return null;

  return (
    <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-5 sm:p-6 my-8 shadow-sm">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#0B1220] text-white flex items-center justify-center shrink-0 shadow-sm">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Autres offres similaires à Nador
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-accent-text">
              {alternatives.length} offre{alternatives.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Vous cherchez un <strong>{currentVehicle.brand} {currentVehicle.model}</strong> ? Les disponibilités de ces offres dépendent des dates choisies et doivent être vérifiées sur chaque fiche véhicule.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alternatives.map((alt) => {
          const diff = alt.daily_price - currentVehicle.daily_price;
          const isCheaper = diff < 0;

          return (
            <div
              key={alt.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Agency Header */}
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-[#0B1220]" />
                    <span className="font-semibold text-slate-800 truncate">
                      {alt.agency?.name}
                    </span>
                  </div>
                  {alt.agency?.verified && (
                    <Badge variant="verified" icon>Vérifiée</Badge>
                  )}
                </div>

                {/* Car Preview with Image */}
                <div className="flex gap-3 items-center mb-3">
                  <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    <Image
                      src={alt.images[0] || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80'}
                      alt={alt.model}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {alt.brand} {alt.model}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Année {alt.year} • {alt.transmission === 'AUTOMATIC' ? 'Automatique' : 'Manuelle'}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-amber-600 font-bold mt-0.5">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{alt.agency?.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price comparison & CTA */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-1">
                <div>
                  <PriceDisplay price={alt.daily_price} size="sm" />
                  {diff !== 0 && (
                    <span
                      className={`block text-[11px] font-semibold ${
                        isCheaper ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    >
                      {isCheaper ? `${Math.abs(diff)} DH moins cher` : `+${diff} DH`}
                    </span>
                  )}
                </div>

                <Link
                  href={`/cars/${alt.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B1220] hover:bg-slate-800 text-white shadow-sm transition-colors"
                >
                  <span>Voir cette offre</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
