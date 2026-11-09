'use client';

import React from 'react';
import {
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgencySubscription } from '@/types';

interface Props {
  subscription: AgencySubscription | null;
  loading?: boolean;
  onOpenUpgradeModal: () => void;
}

export function FleetCapacityCard({ subscription, loading, onOpenUpgradeModal }: Props) {
  if (loading || !subscription) {
    return (
      <div className="h-28 w-full animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
    );
  }

  const { plan, vehicle_capacity, is_at_capacity } = subscription;
  const isUnlimited = vehicle_capacity === null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5 sm:p-6 transition-all',
        is_at_capacity
          ? 'border-red-200 bg-linear-to-br from-red-50/70 via-white to-amber-50/40 shadow-xs'
          : 'border-blue-100 bg-linear-to-br from-blue-50/60 via-white to-slate-50/50 shadow-xs'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Left info */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0B1220] px-3 py-1 text-xs font-bold text-white shadow-xs">
              <Sparkles className="h-3 w-3 text-amber-300" />
              Forfait {plan.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              0% de commission ClickDrive
            </span>
            {is_at_capacity && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5" />
                Capacité atteinte
              </span>
            )}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Capacité du parc
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isUnlimited ? (
                'Votre concession bénéficie d’un quota illimité de véhicules actifs.'
              ) : is_at_capacity ? (
                <span className="text-red-700 font-semibold">
                  Limite atteinte ! Vous ne pouvez plus ajouter de véhicule sans passer au palier supérieur.
                </span>
              ) : (
                'Votre formule dispose encore de capacité disponible pour de nouveaux véhicules.'
              )}
            </p>
          </div>
        </div>

        {/* Right action & progress */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:min-w-85">
          
          {/* Upgrade button */}
          <button
            type="button"
            onClick={onOpenUpgradeModal}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer',
              is_at_capacity
                ? 'bg-action hover:bg-red-700 text-white'
                : 'bg-white hover:bg-slate-50 text-[#0B1220] border border-blue-200'
            )}
          >
            <span>{is_at_capacity ? 'Augmenter ma capacité' : "Changer de forfait"}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>

        </div>

      </div>
    </div>
  );
}
