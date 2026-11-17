'use client';

import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Cpu, Map as MapIcon, MapPinned, Route, Settings, ShieldAlert, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { signOutEverywhere } from '@/lib/auth/client';
import { workspaceUrl } from '@/lib/agency/workspace-url';
import { AGENCY_SIDEBAR_COLLAPSED_KEY, useCollapsedPreference } from '@/lib/ui/use-collapsed-preference';
import { cn } from '@/lib/utils';
import { AGENCY_SECTIONS, Sidebar, TRACKING_SECTION, type AgencySection } from '@/components/agency/shell/Sidebar';
import { Topbar } from '@/components/agency/shell/Topbar';
import { TrackingAccessProvider, type TrackingAccessValue } from './TrackingAccess';

const TABS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: '/agency/tracking', label: 'Carte', icon: MapIcon, exact: true },
  { href: '/agency/tracking/history', label: 'Trajets', icon: Route },
  { href: '/agency/tracking/alerts', label: 'Alertes', icon: Bell },
  { href: '/agency/tracking/geofences', label: 'Zones', icon: MapPinned },
  { href: '/agency/tracking/devices', label: 'Boîtiers', icon: Cpu },
  { href: '/agency/tracking/settings', label: 'Paramètres', icon: Settings },
];

const SECTIONS: AgencySection[] = [...AGENCY_SECTIONS.map((section) => ({ ...section })), { ...TRACKING_SECTION }];

function isActive(pathname: string, tab: (typeof TABS)[number]): boolean {
  if (tab.exact) return pathname === tab.href || pathname.startsWith('/agency/tracking/vehicles');
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/**
 * Cadre commun des écrans de suivi : mêmes barre latérale et barre supérieure que l'espace agence,
 * navigation entre les sous-pages du suivi, bandeau d'accès de support. Les permissions reçues servent
 * uniquement à l'affichage ; toute action est revérifiée par l'API et la base.
 */
export function TrackingShell({
  agency,
  profile,
  access,
  children,
}: {
  agency: { name: string; logoUrl: string | null; verified: boolean };
  profile: { displayName: string; avatarUrl: string | null };
  access: TrackingAccessValue;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  // Même préférence « Réduire » que le tableau de bord agence
  const [sidebarCollapsed, toggleSidebar] = useCollapsedPreference(AGENCY_SIDEBAR_COLLAPSED_KEY);

  const navigate = useCallback(
    (id: string) => router.push(id === 'tracking' ? '/agency/tracking' : workspaceUrl(id)),
    [router]
  );

  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutEverywhere(createClient());
      router.replace('/');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }, [router, signingOut]);

  const current = TABS.find((tab) => isActive(pathname, tab)) ?? TABS[0]!;

  return (
    <TrackingAccessProvider value={access}>
      <div className="flex min-h-screen bg-canvas text-ink">
        <a href="#tracking-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">
          Aller au contenu
        </a>
        <Sidebar
          sections={SECTIONS}
          active="tracking"
          onNavigate={navigate}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
          agencyName={agency.name}
          verified={agency.verified}
          logoUrl={agency.logoUrl}
          onSignOut={() => void signOut()}
          signingOut={signingOut}
        />
        <div className="min-w-0 flex-1">
          <Topbar
            agencyName={agency.name}
            userLabel={profile.displayName}
            avatarUrl={agency.logoUrl || profile.avatarUrl}
            crumbs={[{ label: 'Suivi GPS', href: '/agency/tracking' }, ...(current.href === '/agency/tracking' ? [] : [{ label: current.label }])]}
            notifications={[]}
            onRefresh={() => router.refresh()}
            refreshing={false}
            onSignOut={() => void signOut()}
            signingOut={signingOut}
            onNavigate={navigate}
            sections={SECTIONS}
            activeSection="tracking"
          />

          <main id="tracking-content" className="mx-auto max-w-400 space-y-5 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
            <div>
              <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-accent-text">{agency.name}</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-[32px]">Suivi GPS</h1>
            </div>

            {access.supportMode && (
              <p role="status" className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                Accès de support plateforme : lecture seule, motivé et journalisé. L’agence peut y mettre fin à tout moment.
              </p>
            )}

            <nav aria-label="Sections du suivi GPS" className="-mx-1 overflow-x-auto px-1">
              <ul className="flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = tab === current;
                  return (
                    <li key={tab.href}>
                      <Link
                        href={tab.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand',
                          active ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        {tab.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {children}
          </main>
        </div>
      </div>
    </TrackingAccessProvider>
  );
}
