'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import type { AgencySubscription, SubscriptionPlan } from '@/types';
import { FleetCapacityCard } from './FleetCapacityCard';
import { AgencySubscriptionModal } from './AgencySubscriptionModal';
import { clickdriveWhatsAppUrl } from '@/lib/constants/contact';

interface Props {
  agencyId: string;
}

export function AgencySubscriptionPanel({ agencyId }: Props) {
  const [subscription, setSubscription] = useState<AgencySubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, plansRes] = await Promise.all([
        fetch(`/api/agencies/${agencyId}/subscription`),
        fetch('/api/subscriptions/plans'),
      ]);

      const subJson = await subRes.json();
      const plansJson = await plansRes.json();

      if (!subRes.ok || !subJson.success) {
        throw new Error(subJson.error || "Impossible de charger l'abonnement.");
      }

      setSubscription(subJson.data);
      if (plansJson.success && Array.isArray(plansJson.data)) {
        setPlans(plansJson.data);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des informations de forfait.');
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#02306B]" />
          <span className="text-sm font-medium">Chargement de votre forfait…</span>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
        <p className="mt-2 text-sm font-semibold text-red-900">{error || 'Erreur inconnue'}</p>
        <button
          type="button"
          onClick={() => void loadData()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </button>
      </div>
    );
  }

  const { plan } = subscription;

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-accent-text" />
            Abonnement & Capacité Flotte
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gérez votre capacité de véhicules et profitez de <strong>0% de commission</strong> sur toutes vos réservations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#02306B] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#064181] transition focus-visible:outline-2 focus-visible:outline-[#02306B]"
        >
          <Sparkles className="h-4 w-4 text-amber-300" />
          Changer de formule / Capacité
        </button>
      </div>

      {/* Carte d'état de capacité */}
      <FleetCapacityCard
        subscription={subscription}
        onOpenUpgradeModal={() => setModalOpen(true)}
      />

      {/* Informations sur l'abonnement actif */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Formule actuelle</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xl font-black text-slate-900">{plan.name}</span>
            {plan.badge && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-[#02306B]">
                {plan.badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {plan.max_vehicles ? `Jusqu'à ${plan.max_vehicles} véhicules` : 'Véhicules illimités'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Tarif mensuel</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900">{formatPrice(plan.price_monthly)}</span>
            <span className="text-xs text-slate-500">/ mois</span>
          </div>
          <p className="mt-1 text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            0% commission prélevée
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Prochain renouvellement</span>
          <div className="mt-2 text-xl font-black text-slate-900">
            {new Date(subscription.billing_cycle_end).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {subscription.days_remaining > 0
              ? `Dans ${subscription.days_remaining} jour${subscription.days_remaining > 1 ? 's' : ''}`
              : 'Renouvellement en cours'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Statut du compte</span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
                subscription.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : subscription.status === 'TRIAL'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {subscription.status === 'ACTIVE'
                ? 'Actif'
                : subscription.status === 'TRIAL'
                  ? 'Période d’essai'
                  : subscription.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Renouvellement automatique actif</p>
        </div>
      </div>

      {/* Rassurance Modèle 0% commission */}
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50/80 via-white to-teal-50/40 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                100% de vos gains locatifs vous reviennent
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                ClickDrive fonctionne avec un forfait mensuel fixe calculé selon la capacité de votre flotte.
                Aucune commission n’est prélevée sur le montant payé par les clients : vous encaissez directement la totalité de vos locations.
              </p>
            </div>
          </div>
          <a
            href={clickdriveWhatsAppUrl('Bonjour, je souhaite des informations sur les abonnements ClickDrive')}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
            Support agences WhatsApp
          </a>
        </div>
      </div>

      {/* Grille comparative des formules disponibles */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Toutes les formules d’abonnement ClickDrive
          </h3>
          <p className="text-xs text-slate-500">
            Faites évoluer votre capacité en temps réel selon la croissance de votre parc automobile.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = p.slug === plan.slug;
            return (
              <div
                key={p.id}
                className={cn(
                  'relative flex flex-col justify-between rounded-2xl border p-5 transition-all',
                  isCurrent
                    ? 'border-[#02306B] bg-blue-50/30 ring-2 ring-[#02306B]/20 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                {isCurrent && (
                  <span className="absolute -top-3 right-4 rounded-full bg-[#02306B] px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                    Formule actuelle
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900">{p.name}</span>
                    {p.badge && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {p.badge}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">{formatPrice(p.price_monthly)}</span>
                    <span className="text-xs text-slate-500">/ mois</span>
                  </div>

                  <p className="mt-1 text-xs font-semibold text-[#02306B]">
                    {p.max_vehicles ? `Jusqu'à ${p.max_vehicles} véhicules` : 'Véhicules illimités'}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {p.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-400 cursor-default"
                    >
                      Formule en cours
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setModalOpen(true)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#02306B] transition"
                    >
                      Choisir cette formule
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de changement de forfait */}
      <AgencySubscriptionModal
        agencyId={agencyId}
        subscription={subscription}
        plans={plans}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={(updated) => {
          setSubscription(updated);
        }}
      />
    </div>
  );
}
