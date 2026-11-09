'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import {
  ArrowLeft,
  Percent,
  CheckCircle2,
  AlertCircle,
  Save,
  Sparkles,
  TrendingUp,
  Check,
} from 'lucide-react';
import type { SubscriptionPlan } from '@/types';

export default function CommissionSettingsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentRate, setCurrentRate] = useState<number>(0.0);
  const [newRateInput, setNewRateInput] = useState<string>('0.0');
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Simulateur de parc
  const [simulatedVehicleCount, setSimulatedVehicleCount] = useState<number>(8);

  const fetchSettings = useCallback(async () => {
    try {
      const [commRes, plansRes] = await Promise.all([
        fetch('/api/settings/commission'),
        fetch('/api/subscriptions/plans'),
      ]);
      const commData = await commRes.json();
      const plansData = await plansRes.json();

      if (commData.success && commData.settings) {
        const rate = Number(commData.settings.commission_rate ?? 0.0);
        setCurrentRate(rate);
        setNewRateInput(rate.toString());
      }
      if (plansData.success && plansData.data) {
        setPlans(plansData.data);
      }
    } catch (err) {
      console.warn('Could not fetch settings:', err);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const parsed = parseFloat(newRateInput);

    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      setFeedback({
        type: 'error',
        message: 'Veuillez saisir un pourcentage valide compris entre 0 et 100 %.',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commission_rate: parsed }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentRate(parsed);
        setFeedback({
          type: 'success',
          message: `Le taux de commission a été mis à jour avec succès à ${parsed.toFixed(2)} %.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Erreur lors de l’enregistrement.',
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: (err instanceof Error ? err.message : '') || 'Erreur réseau.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Trouver le palier correspondant à la simulation
  const recommendedPlan =
    plans.find((p) => {
      if (p.max_vehicles === null) return simulatedVehicleCount >= p.min_vehicles;
      return simulatedVehicleCount >= p.min_vehicles && simulatedVehicleCount <= p.max_vehicles;
    }) || plans[0];

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-10 pb-20">
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
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Finance & Monétisation
          </span>
        </div>

        {/* Titre */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0B1220] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Nouveau Modèle de Monétisation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Abonnements Concessionnaires par Capacité de Flotte
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Les concessions paient un abonnement mensuel calculé sur leur nombre de véhicules. Les réservations clients sont soumises à <strong>0% de commission</strong> (100% conservé par les agences).
          </p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

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
              Modèle Actif : 0% Commission
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
                    <span className="text-3xl font-black text-[#0B1220]">
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

                <div className="pt-3 border-t border-slate-100 text-[11px] font-medium text-slate-400">
                  Blocage automatique dès {plan.max_vehicles ? plan.max_vehicles + 1 : 'N/A'} véh.
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Simulateur de concession */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0B1220]">
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
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nombre de véhicules de la concession
                </label>
                <span className="text-2xl font-black text-[#0B1220]">
                  {simulatedVehicleCount} véhicules
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="50"
                value={simulatedVehicleCount}
                onChange={(e) => setSimulatedVehicleCount(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0B1220]"
              />

              <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
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
                <p className="text-xl font-extrabold text-[#0B1220]">
                  Formule {recommendedPlan.name}
                </p>
                <p className="text-2xl font-black text-slate-900">
                  {formatPrice(recommendedPlan.price_monthly)}
                  <span className="text-xs font-normal text-slate-500"> / mois</span>
                </p>
                <p className="text-xs text-emerald-700 font-semibold">
                  0 DH de commission sur les réservations
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Commission résiduelle / historique */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Commission transactionnelle sur réservations
              </h3>
              <p className="text-xs text-slate-500">
                Fixé à 0.00% dans le modèle abonnement pur. Modifiable uniquement si une formule hybride est souhaitée.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveCommission} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative max-w-xs">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 font-extrabold text-base text-slate-900 outline-none focus:border-[#0B1220] focus:ring-2 focus:ring-[#0B1220]/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                  %
                </span>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-[#0B1220] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Enregistrement...' : 'Mettre à jour le taux'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Actuel : <strong>{currentRate.toFixed(2)}%</strong>. Dans le modèle par abonnement mensuel, la valeur recommandée est <strong>0.00%</strong> afin que les agences perçoivent l'intégralité du tarif de location.
            </p>
          </form>
        </div>

      </div>
    </div>
  );
}
