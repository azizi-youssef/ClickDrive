'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { SubscriptionPlan } from '@/types';

const ONBOARDING = [
  { title: 'Votre demande', text: 'Le formulaire ci-dessus, en deux minutes.' },
  { title: 'Vérification', text: 'Registre de commerce, assurance et flotte vérifiés avant toute mise en ligne.' },
  { title: 'Mise en ligne accompagnée', text: 'Notre équipe crée votre espace et vous aide à publier vos premiers véhicules et leurs photos.' },
  { title: 'Premières demandes', text: 'Vous recevez les demandes par e-mail et WhatsApp et répondez depuis votre espace.' },
];

/** Formules réelles (base de données) et étapes de mise en ligne d'une agence partenaire */
export function PartnerPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/subscriptions/plans')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active) setPlans(json?.success && Array.isArray(json.data) ? (json.data as SubscriptionPlan[]) : []);
      })
      .catch(() => active && setPlans([]));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="partner-plans" className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#E63946]">Tarifs</span>
        <h2 id="partner-plans" className="mt-2 text-2xl font-extrabold tracking-tight text-[#0B1220] sm:text-3xl">
          Un abonnement mensuel selon la taille de votre flotte, 0 % de commission
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Vous encaissez directement vos locations. Sans engagement : vous changez de formule quand votre flotte évolue.
        </p>

        {plans === null ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Chargement des formules">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
            ))}
          </div>
        ) : plans.length > 0 ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <li key={plan.id} className="flex flex-col rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-bold text-[#0B1220]">{plan.name}</p>
                <p className="mt-2">
                  <span className="text-2xl font-black text-[#0B1220]">{formatPrice(plan.price_monthly)}</span>
                  <span className="text-xs font-semibold text-slate-500"> / mois</span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {plan.max_vehicles === null ? `${plan.min_vehicles} véhicules et plus` : `De ${plan.min_vehicles} à ${plan.max_vehicles} véhicules`}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                  {plan.features.slice(0, 3).map((feature) => (
                    <li key={feature} className="flex gap-1.5">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-slate-600">Les tarifs vous sont communiqués par notre équipe après votre demande.</p>
        )}

        <h3 className="mt-12 text-lg font-extrabold text-[#0B1220]">Votre mise en ligne, étape par étape</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ONBOARDING.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B1220] text-sm font-bold text-white">{index + 1}</span>
              <span>
                <span className="block text-sm font-bold text-[#0B1220]">{step.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
