'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { ArrowLeft, Sparkles, TrendingUp, Check } from 'lucide-react';
import type { SubscriptionPlan } from '@/types';

/**
 * Abonnements des agences : seule source de revenus de ClickDrive. Aucune commission n'est prélevée
 * sur les locations (pas de taux à régler).
 */
export default function SubscriptionSettingsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  // Simulateur de parc
  const [simulatedVehicleCount, setSimulatedVehicleCount] = useState<number>(8);

  const fetchPlans = useCallback(async () => {
    try {
      const plansRes = await fetch('/api/subscriptions/plans');
      const plansData = await plansRes.json();
      if (plansData.success && plansData.data) {
        setPlans(plansData.data);
      }
    } catch (err) {
      console.warn('Could not fetch subscription plans:', err);
    }
  }, []);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  // Trouver le palier correspondant à la simulation
  const recommendedPlan =
    plans.find((p) => {
      if (p.max_vehicles === null) return simulatedVehicleCount >= p.min_vehicles;
      return simulatedVehicleCount >= p.min_vehicles && simulatedVehicleCount <= p.max_vehicles;
    }) || plans[0];

  return (
    <div className="bg-slate-50 min-h-screen py-10 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation retour */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour aux paramètres</span>
          </Link>
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Finance & Monétisation
          </span>
        </div>

        {/* Titre */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-ink text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Nouveau Modèle de Monétisation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Abonnements Concessionnaires par Capacité de Flotte
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Les agences paient un abonnement mensuel calculé sur leur nombre de véhicules. Le montant des locations leur revient entièrement.
          </p>
        </div>

        {/* Section 1: Grille des Paliers d'Abonnement */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Grille tarifaire des abonnements</h2>
              <p className="text-xs text-slate-500">
                Paliers appliqués automatiquement aux concessions selon le nombre de véhicules enregistrés.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1">
              Modèle actif : abonnement mensuel
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs hover:border-slate-300 hover:shadow-md transition"
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-6">
                    <span className="rounded-full bg-action px-3 py-0.5 text-[11px] font-bold text-white shadow-xs">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{plan.name}</h3>
                  <div className="mt-2 mb-3">
                    <span className="text-3xl font-black text-ink">
                      {formatPrice(plan.price_monthly)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500"> / mois</span>
                  </div>

                  <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-2.5 text-xs text-blue-900 font-semibold mb-4">
                    {plan.max_vehicles === null
                      ? 'Capacité illimitée (31+ véh.)'
                      : `De ${plan.min_vehicles} à ${plan.max_vehicles} véhicules`}
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 mb-6">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] font-medium text-slate-500">
                  Blocage automatique dès {plan.max_vehicles ? plan.max_vehicles + 1 : 'N/A'} véh.
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Simulateur de concession */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-ink">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Simulateur de palier selon la flotte de l'agence
              </h3>
              <p className="text-xs text-slate-500">
                Ajustez le curseur pour voir le palier recommandé et le coût mensuel correspondant.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <label htmlFor="simulated-vehicle-count" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nombre de véhicules de la concession
                </label>
                <span className="text-2xl font-black text-ink">
                  {simulatedVehicleCount} véhicules
                </span>
              </div>

              <input
                id="simulated-vehicle-count"
                type="range"
                min="1"
                max="50"
                value={simulatedVehicleCount}
                onChange={(e) => setSimulatedVehicleCount(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-ink"
              />

              <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                <span>1 véh. (Starter)</span>
                <span>15 véh. (Pro)</span>
                <span>30 véh. (Business)</span>
                <span>50+ (Illimité)</span>
              </div>
            </div>

            {recommendedPlan && (
              <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/60 to-white p-5 shadow-xs text-center space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Palier Assigné Automatiquement
                </span>
                <p className="text-xl font-extrabold text-ink">
                  Formule {recommendedPlan.name}
                </p>
                <p className="text-2xl font-black text-slate-900">
                  {formatPrice(recommendedPlan.price_monthly)}
                  <span className="text-xs font-normal text-slate-500"> / mois</span>
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
