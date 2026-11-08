
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  DollarSign,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

import { AdminShell } from '@/components/admin/AdminShell';
import { AccountProfileSettings } from '@/components/shared/AccountProfileSettings';

export const metadata: Metadata = {
  title: 'Paramètres',
  description: 'Configurez les paramètres et les règles de fonctionnement de la plateforme ClickDrive.',
};

type SettingSection = {
  href: string;
  label: string;
  description: string;
  icon: typeof DollarSign;
  accent: string;
  iconBackground: string;
  category: string;
  access?: string;
};

const SETTING_SECTIONS: SettingSection[] = [
  {
    href: '/admin/settings/commission',
    icon: DollarSign,
    label: 'Abonnements & Monétisation',
    description:
      'Gérez les forfaits mensuels basés sur la capacité en véhicules et les règles de monétisation ClickDrive.',
    accent: 'text-[#0B1220]',
    iconBackground: 'bg-blue-50',
    category: 'Finance',
    access: 'SUPER_ADMIN',
  },
  {
    href: '/admin/permissions',
    icon: ShieldCheck,
    label: 'Permissions & accès',
    description:
      'Gérez les rôles, les autorisations et les accès aux fonctionnalités de votre espace administrateur.',
    accent: 'text-[#0B1220]',
    iconBackground: 'bg-blue-50',
    category: 'Sécurité',
  },
  {
    href: '/admin/notifications',
    icon: Bell,
    label: 'Notifications',
    description:
      'Personnalisez les modèles de messages et les règles de notification destinés aux utilisateurs.',
    accent: 'text-violet-600',
    iconBackground: 'bg-violet-50',
    category: 'Communication',
  },
];

export default function AdminSettingsPage() {
  return (
    <AdminShell
      title="Paramètres plateforme"
      subtitle="Centralisez la configuration et la gestion de ClickDrive."
    >
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <AccountProfileSettings />

        {/* Page introduction */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-blue-50 blur-3xl"
          />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B1220] text-white shadow-sm">
                <Settings2 className="h-6 w-6" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0B1220]">
                    Administration
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-500">
                    Configuration générale
                  </span>
                </div>

                <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  Gérez votre plateforme
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Retrouvez au même endroit les paramètres financiers,
                  les permissions administratives et les notifications
                  de votre marketplace.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 sm:self-center">
              <CheckCircle2
                className="h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
              <span className="text-xs font-semibold text-emerald-700">
                Espace de configuration
              </span>
            </div>
          </div>
        </section>

        {/* Section heading */}
        <section aria-labelledby="settings-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="settings-heading"
                className="text-lg font-bold text-slate-950"
              >
                Tous les paramètres
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Sélectionnez une rubrique pour consulter ou modifier sa configuration.
              </p>
            </div>

            <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
              {SETTING_SECTIONS.length} rubriques
            </span>
          </div>

          {/* Settings cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SETTING_SECTIONS.map((section) => {
              const Icon = section.icon;

              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className="group flex min-h-62.5 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1220] focus-visible:ring-offset-2 sm:p-6"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${section.iconBackground} transition-transform duration-200 group-hover:scale-105`}
                    >
                      <Icon
                        className={`h-6 w-6 ${section.accent}`}
                        aria-hidden="true"
                      />
                    </div>

                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {section.category}
                    </span>
                  </div>

                  {/* Card content */}
                  <div className="mt-5 flex-1">
                    <h3 className="text-base font-bold text-slate-900 transition-colors group-hover:text-[#0B1220]">
                      {section.label}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {section.description}
                    </p>
                  </div>

                  {/* Card footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    {section.access ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Accès {section.access}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">
                        Configuration
                      </span>
                    )}

                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all group-hover:bg-[#0B1220] group-hover:text-white">
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Security note */}
        <section className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <SlidersHorizontal
            className="mt-0.5 h-5 w-5 shrink-0 text-[#0B1220]"
            aria-hidden="true"
          />

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              À propos de la configuration
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Les modifications des paramètres sensibles doivent être
              protégées par des contrôles d&apos;accès côté serveur.
              Les changements financiers doivent également être validés
              et journalisés pour garantir leur traçabilité.
            </p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
