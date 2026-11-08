'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Zap,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import type { AgencySubscription, SubscriptionPlan } from '@/types';

interface Props {
  agencyId: string;
  subscription: AgencySubscription;
  plans: SubscriptionPlan[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: AgencySubscription) => void;
}

export function AgencySubscriptionModal({
  agencyId,
  subscription,
  plans,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>(subscription.plan.slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSlug = subscription.plan.slug;
  const currentVehicleCount = subscription.current_vehicles_count;

  const handleUpgrade = async () => {
    if (selectedPlanSlug === currentSlug) {
      onClose();
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/agencies/${agencyId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: selectedPlanSlug }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur lors du changement de forfait.');
      }

      onSuccess(json.data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        
        {/* Header */}
        <div className="relative bg-linear-to-r from-[#0B1220] to-[#0A4B9C] px-6 py-6 text-white sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-xs mb-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Abonnement Mensuel Concessionnaire</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Gérez votre capacité de flotte ClickDrive
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
            Abonnement calculé en fonction de la taille de votre parc de véhicules.
            <strong> 0% de commission sur vos réservations</strong> : vous conservez 100% de vos revenus locatifs.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs bg-white/10 rounded-xl px-4 py-2 w-fit">
            <span>
              Flotte actuelle : <strong className="text-white">{currentVehicleCount} véhicule{currentVehicleCount > 1 ? 's' : ''}</strong>
            </span>
            <span className="text-blue-300">•</span>
            <span>
              Forfait actuel : <strong className="text-amber-300">{subscription.plan.name}</strong>
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 sm:mx-8">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Plans Grid */}
        <div className="p-6 sm:p-8 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = plan.slug === currentSlug;
              const isSelected = plan.slug === selectedPlanSlug;
              const isTooSmall = plan.max_vehicles !== null && plan.max_vehicles < currentVehicleCount;

              return (
                <div
                  key={plan.id}
                  onClick={() => {
                    if (!isTooSmall) setSelectedPlanSlug(plan.slug);
                  }}
                  className={cn(
                    'relative flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer',
                    isSelected
                      ? 'border-[#0B1220] bg-blue-50/40 ring-2 ring-[#0B1220] shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs',
                    isTooSmall && 'opacity-50 cursor-not-allowed bg-slate-50'
                  )}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute -top-2.5 left-4">
                      <span className="rounded-full bg-action px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-900 text-base">{plan.name}</h3>
                      {isCurrent && (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5">
                          Actuel
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <span className="text-2xl font-black text-slate-950">
                        {formatPrice(plan.price_monthly)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium"> / mois</span>
                    </div>

                    <div className="rounded-xl bg-slate-100/80 p-2.5 text-xs text-slate-700 font-medium mb-3">
                      Capacité :{' '}
                      <strong className="text-slate-900">
                        {plan.max_vehicles === null
                          ? 'Illimitée (31+)'
                          : `${plan.min_vehicles} à ${plan.max_vehicles} véhicules`}
                      </strong>
                    </div>

                    {/* Features list */}
                    <ul className="space-y-2 text-xs text-slate-600 mb-4">
                      {plan.features.slice(0, 4).map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 leading-tight">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    {isTooSmall ? (
                      <div className="text-[11px] font-medium text-amber-700 text-center py-1.5 bg-amber-50 rounded-lg">
                        Flotte actuelle trop grande ({currentVehicleCount} véh.)
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          'w-full py-2 rounded-xl text-xs font-bold transition',
                          isSelected
                            ? 'bg-[#0B1220] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        )}
                      >
                        {isCurrent ? 'Forfait Actif' : isSelected ? 'Sélectionné' : 'Choisir ce palier'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:px-8">
          <div className="text-xs text-slate-500">
            Facturation mensuelle sans engagement. Prorata calculé au changement de palier.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white transition"
            >
              Fermer
            </button>

            <button
              type="button"
              onClick={handleUpgrade}
              disabled={busy || selectedPlanSlug === currentSlug}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B1220] hover:bg-slate-800 disabled:opacity-40 text-xs font-bold text-white shadow-md shadow-blue-900/15 transition cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validation...</span>
                </>
              ) : (
                <>
                  <span>{selectedPlanSlug === currentSlug ? 'Forfait actuel' : 'Confirmer le changement de palier'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
