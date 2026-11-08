'use client';
import { brandLogo } from '@/lib/brand/logo';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, Home, LogOut, RefreshCw, Settings, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/design/tokens';
import { MobileNav } from './MobileNav';

export type TopbarCrumb = { label: string; href?: string };

function initialsOf(label: string): string {
  const joined = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return joined || 'CD';
}

/** Menu contextuel accessible : fermeture au clic extérieur et via Échap. */
function Popover({
  open,
  onClose,
  onToggle,
  label,
  align = 'right',
  width = 'w-80',
  trigger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onToggle?: () => void;
  label: string;
  align?: 'left' | 'right';
  width?: string;
  trigger: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
  }) => ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      {trigger({
        onClick: onToggle ?? (() => (open ? onClose() : undefined)),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.14)]',
            width,
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function Topbar({
  agencyName,
  userLabel,
  avatarUrl,
  crumbs,
  notifications,
  onRefresh,
  refreshing,
  onSignOut,
  signingOut = false,
  onNavigate,
  sections,
  activeSection,
  pendingCount = 0,
}: {
  agencyName: string;
  userLabel: string;
  avatarUrl: string | null;
  crumbs: TopbarCrumb[];
  notifications: { id: string; label: string; tone: 'alert' | 'info' }[];
  onRefresh: () => void;
  refreshing: boolean;
  onSignOut: () => void;
  signingOut?: boolean;
  onNavigate: (id: string) => void;
  sections: { id: string; label: string; icon: typeof Bell }[];
  activeSection: string;
  /** Demandes à traiter, affichées sur la navigation mobile */
  pendingCount?: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const alertCount = notifications.filter((n) => n.tone === 'alert').length;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <nav aria-label="Fil d'Ariane" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            <li className="hidden shrink-0 sm:block">
              <Link href="/agency" className="text-[#64748B] transition-colors hover:text-[#0F172A]">
                {agencyName}
              </Link>
            </li>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li key={crumb.label} className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden="true" className="hidden shrink-0 text-slate-300 sm:inline">/</span>
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="truncate text-[#64748B] transition-colors hover:text-[#0F172A]">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? 'page' : undefined} className="truncate font-semibold text-[#0F172A]">
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Actualiser les données"
          aria-busy={refreshing}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 outline-none transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#E63946] disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>

        <Popover
          open={bellOpen}
          onClose={() => setBellOpen(false)}
          onToggle={() => setBellOpen((prev) => !prev)}
          label="Notifications"
          width="w-80"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={`Notifications${alertCount ? ` (${alertCount})` : ''}`}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 outline-none transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#E63946]"
            >
              <Bell aria-hidden="true" className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold text-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          )}
        >
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            Notifications
          </p>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#64748B]">Aucune action en attente.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setBellOpen(false);
                      onNavigate('bookings');
                    }}
                    className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        notification.tone === 'alert' ? 'bg-[#E63946]' : 'bg-slate-300'
                      )}
                    />
                    <span className="min-w-0 flex-1 text-sm text-[#0F172A]">{notification.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover>

        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onToggle={() => setMenuOpen((prev) => !prev)}
          label="Compte"
          width="w-64"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 py-1.5 pl-1.5 pr-2.5 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#E63946]"
            >
              <div className="relative h-7 w-7 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandLogo.src} alt="" className="h-full w-full object-contain p-0.5" />
                )}
              </div>
              <span className="hidden max-w-32 truncate text-sm font-medium text-slate-700 sm:block">
                {userLabel}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                  menuOpen && 'rotate-180 text-slate-700'
                )}
              />
            </button>
          )}
        >
          <div className="border-b border-slate-100 px-3 pb-2.5 pt-2 flex items-center gap-2.5">
            <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogo.src} alt="" className="h-full w-full object-contain p-0.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#0F172A]">{userLabel}</p>
              <p className="truncate text-xs text-[#64748B]">{agencyName}</p>
            </div>
          </div>

          <div className="py-1">
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              <UserRound aria-hidden="true" className="h-4 w-4 text-slate-400" />
              <span>Mon profil & photo</span>
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onNavigate('settings');
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 text-left"
            >
              <Settings aria-hidden="true" className="h-4 w-4 text-slate-400" />
              <span>Paramètres de l&apos;agence</span>
            </button>
            <Link
              href="/"
              target="_blank"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Home aria-hidden="true" className="h-4 w-4 text-slate-400" />
              <span>Voir le site ClickDrive</span>
            </Link>
          </div>

          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onSignOut();
              }}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
            >
              <LogOut aria-hidden="true" className="h-4 w-4 text-red-500" />
              <span>{signingOut ? 'Déconnexion en cours…' : 'Se déconnecter'}</span>
            </button>
          </div>
        </Popover>
      </div>

      <MobileNav sections={sections} activeSection={activeSection} onNavigate={onNavigate} pendingCount={pendingCount} />
    </header>
  );
}
