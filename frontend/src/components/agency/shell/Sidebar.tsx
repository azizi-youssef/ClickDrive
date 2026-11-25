'use client';
import { AgencyLogoMark } from '@/components/agencies/AgencyLogoMark';
import { BrandSymbol } from '@/components/shared/BrandLogo';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Car,
  PlusCircle,
  CalendarDays,
  ClipboardList,
  KeyRound,
  Users,
  CircleDollarSign,
  ShieldCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  LogOut,
  Sparkles,
  Motorbike,
  Satellite,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { eyebrowMuted } from '@/lib/design/tokens';

export type AgencySection = {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  badge?: 'alert';
};

/**
 * Suivi GPS : écran dédié (/agency/tracking), hors des sections de l'espace agence. Ajouté à la navigation
 * seulement pour les comptes disposant de tracking.read (vérifié côté serveur).
 */
export const TRACKING_SECTION: AgencySection = { id: 'tracking', label: 'Suivi GPS', icon: Satellite };

export const AGENCY_SECTIONS: readonly {
  id:
    | 'overview'
    | 'fleet'
    | 'fleet_motos'
    | 'add_vehicle'
    | 'calendar'
    | 'bookings'
    | 'rentals'
    | 'customers'
    | 'subscription'
    | 'finances'
    | 'analytics'
    | 'access'
    | 'settings';
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'bookings', label: 'Réservations', icon: ClipboardList },
  { id: 'rentals', label: 'Départs et retours', icon: KeyRound },
  { id: 'calendar', label: 'Calendrier et disponibilités', icon: CalendarDays },
  { id: 'fleet', label: 'Voitures', icon: Car },
  { id: 'fleet_motos', label: 'Motos', icon: Motorbike },
  { id: 'add_vehicle', label: 'Ajouter un véhicule', icon: PlusCircle },
  { id: 'subscription', label: 'Forfait et capacité', icon: Sparkles },
  { id: 'customers', label: 'Clients', icon: Users },
  { id: 'finances', label: 'Revenus locatifs', icon: CircleDollarSign },
  { id: 'analytics', label: 'Statistiques', icon: BarChart3 },
  { id: 'access', label: 'Équipe et permissions', icon: ShieldCheck },
  { id: 'settings', label: 'Paramètres agence', icon: Settings },
] as const;

/**
 * Regroupement visuel de la navigation (les sections absentes selon le rôle sont ignorées).
 * Une section qui n'est dans aucun groupe n'apparaît pas : toute nouvelle section doit être ajoutée ici.
 */
export const SECTION_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Pilotage', ids: ['overview', 'bookings', 'rentals', 'calendar', 'analytics'] },
  { title: 'Flotte', ids: ['fleet', 'fleet_motos', 'tracking', 'add_vehicle', 'subscription'] },
  { title: 'Agence', ids: ['customers', 'finances', 'access', 'settings'] },
];

export function Sidebar({
  sections,
  active,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  agencyName,
  verified,
  logoUrl,
  onSignOut,
  signingOut = false,
}: {
  sections: AgencySection[];
  active: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  agencyName: string;
  verified: boolean;
  logoUrl?: string | null;
  onSignOut?: () => void;
  signingOut?: boolean;
}) {
  return (
    <aside
      aria-label="Navigation du portail agence"
      className={cn(
        'hidden shrink-0 flex-col border-r border-white/10 bg-ink transition-[width] duration-fast lg:sticky lg:top-0 lg:flex lg:h-screen',
        collapsed ? 'w-19' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        {/* Logo de l'agence : même tuile uniforme que les cartes publiques (fond du fichier prolongé, dessin
            entier) au lieu d'un recadrage object-cover qui coupait les logos larges. Sans logo : symbole
            ClickDrive filtré en blanc, sans pastille, comme dans le pied de page. */}
        <div
          aria-hidden="true"
          className={cn(
            'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl',
            logoUrl && 'border border-white/20 bg-white shadow-xs'
          )}
        >
          {logoUrl ? (
            <AgencyLogoMark slug="" name={agencyName} logoUrl={logoUrl} size={36} />
          ) : (
            <BrandSymbol tone="white" size={30} />
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{agencyName}</p>
            <p className="text-[11px] text-slate-400">
              {verified ? 'Agence vérifiée' : 'Vérification en attente'}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECTION_GROUPS.map((group, groupIndex) => {
          const items = group.ids
            .map((id) => sections.find((section) => section.id === id))
            .filter((section): section is AgencySection => Boolean(section));
          if (items.length === 0) return null;
          return (
            <div key={group.title} className={cn(groupIndex > 0 && 'mt-5')}>
              {collapsed ? (
                groupIndex > 0 && <div className="mx-3 mb-3 h-px bg-white/10" aria-hidden="true" />
              ) : (
                <p className={cn('mb-1.5 px-3', eyebrowMuted)}>{group.title}</p>
              )}
              <ul className="space-y-0.5">
                {items.map((section) => {
                  const Icon = section.icon;
                  const isActive = active === section.id;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(section.id)}
                        aria-current={isActive ? 'page' : undefined}
                        title={collapsed ? section.label : undefined}
                        className={cn(
                          'relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand',
                          isActive ? 'bg-white font-bold text-ink shadow-sm' : 'font-medium text-slate-400 hover:bg-white/5 hover:text-white',
                          collapsed && 'justify-center px-0'
                        )}
                      >
                        <Icon aria-hidden="true" className={cn('h-4.5 w-4.5 shrink-0', isActive && 'text-accent-text')} />
                        {!collapsed && (
                          <>
                            <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
                            {typeof section.count === 'number' && section.count > 0 && (
                              <span
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                                  section.badge === 'alert'
                                    ? 'bg-action text-white'
                                    : isActive
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-white/10 text-slate-300'
                                )}
                              >
                                {section.count}
                              </span>
                            )}
                            {section.badge === 'alert' && typeof section.count !== 'number' && (
                              <span aria-label="Action requise" className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                            )}
                          </>
                        )}
                        {collapsed && section.badge === 'alert' && (
                          <span aria-label="Action requise" className="absolute end-2.5 top-2 h-2 w-2 rounded-full bg-brand" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-brand',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? "Retour à l'accueil" : undefined}
        >
          <Home aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>Retour à l&apos;accueil</span>}
        </Link>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-50',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? 'Déconnexion' : undefined}
          >
            <LogOut aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && <span>{signingOut ? 'Déconnexion…' : 'Déconnexion'}</span>}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Déplier le menu' : undefined}
          title={collapsed ? 'Déplier le menu' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-brand',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="h-4.5 w-4.5" />
          ) : (
            <>
              <PanelLeftClose aria-hidden="true" className="h-4.5 w-4.5" />
              <span>Réduire</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
