'use client';

import React, { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { brandLogo } from '@/lib/brand/logo';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Car,
  Motorbike,
  Users,
  BarChart3,
  Shield,
  Bell,
  Settings,
  ScrollText,
  Activity,
  ChevronDown,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchClientAuthProfile, type ClientAuthProfile } from '@/lib/auth/client';
import { contactBadgeDescription, contactBadgeLabel } from '@/lib/admin/contact-alerts';
import { ContactAlertToast } from '@/components/admin/messages/ContactAlerts';
import { useContactAlerts } from '@/components/admin/messages/contact-alerts-store';

const MESSAGES_HREF = '/admin/messages';

/* ── Navigation items ──────────────────────────────────────────────── */
type NavItemDef = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV_GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: 'Opérations',
    items: [
      { href: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
      { href: '/admin/bookings', label: 'Réservations', icon: CalendarDays },
      { href: '/admin/agencies', label: 'Agences', icon: Building2 },
      { href: '/admin/fleet', label: 'Voitures', icon: Car, exact: true },
      { href: '/admin/fleet/motos', label: 'Motos', icon: Motorbike },
      { href: '/admin/customers', label: 'Clients', icon: Users },
      { href: MESSAGES_HREF, label: 'Messages', icon: Inbox },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/finance', label: 'Abonnements & MRR', icon: Sparkles },
      { href: '/admin/analytics', label: 'Statistiques', icon: BarChart3 },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/admin/permissions', label: 'Permissions', icon: Shield },
      { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      { href: '/admin/settings', label: 'Paramètres', icon: Settings },
      { href: '/admin/audit', label: 'Journal d’audit', icon: ScrollText },
      { href: '/admin/health', label: 'État du système', icon: Activity },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  SUPPORT: 'Support',
};

function useIsActive() {
  const pathname = usePathname();
  return (item: NavItemDef) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/* ── Préférence « sidebar réduite » (persistée, sans flash d'hydratation) ── */
const COLLAPSE_KEY = 'clickdrive:admin-sidebar-collapsed';
const COLLAPSE_EVENT = 'clickdrive:admin-sidebar';

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeCollapsed(callback: () => void) {
  window.addEventListener(COLLAPSE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, readCollapsed() ? '0' : '1');
    } catch {
      /* stockage indisponible : la préférence n'est simplement pas mémorisée */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }, []);
  return [collapsed, toggle] as const;
}

/* ── Logo ──────────────────────────────────────────────────────────── */
function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/admin"
      aria-label="ClickDrive Admin — vue d'ensemble"
      className="flex items-center gap-2.5 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#E63946]/60"
    >
      <div
        className={cn(
          'relative shrink-0 rounded-md bg-white p-1',
          collapsed ? 'h-8 w-8' : 'h-10 w-32'
        )}
      >
        <Image
          src={brandLogo}
          alt="ClickDrive"
          fill
          sizes={collapsed ? '32px' : '128px'}
          className="object-contain object-left p-1"
          priority
        />
      </div>
      {!collapsed && (
        <span className="rounded-md bg-action px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wider text-white">
          Admin
        </span>
      )}
    </Link>
  );
}

/* ── Nav list (sidebar & drawer) ───────────────────────────────────── */
function NavGroups({
  collapsed = false,
  onNavigate,
  messageCount = 0,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Messages de contact non traités, affichés sur l'entrée « Messages » */
  messageCount?: number;
}) {
  const isActive = useIsActive();
  return (
    <nav aria-label="Navigation administration" className="flex-1 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.label} className={cn(groupIndex > 0 && 'mt-5')}>
          {collapsed ? (
            groupIndex > 0 && <div className="mx-3 mb-3 h-px bg-white/10" aria-hidden="true" />
          ) : (
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{group.label}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              const badge = item.href === MESSAGES_HREF ? messageCount : 0;
              const label = badge > 0 ? `${item.label} (${contactBadgeDescription(badge)})` : item.label;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed || badge > 0 ? label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#E63946]',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-white font-bold text-[#0B1220] shadow-sm'
                        : 'font-medium text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <Icon aria-hidden="true" className={cn('h-4.5 w-4.5 shrink-0', active && 'text-accent-text')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {badge > 0 &&
                      (collapsed ? (
                        <span aria-hidden="true" className="absolute end-3 top-2 h-2.5 w-2.5 rounded-full bg-[#E63946] ring-2 ring-[#0B1220]" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="ms-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#E63946] px-1.5 text-[11px] font-bold leading-none text-white"
                        >
                          {contactBadgeLabel(badge)}
                        </span>
                      ))}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const footerLink =
  'flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-slate-400 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[#E63946]/60 disabled:opacity-50';

/* ── Sidebar ───────────────────────────────────────────────────────── */
export function AdminSidebar({
  collapsed,
  onToggle,
  onLogout,
  loggingOut,
  messageCount = 0,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  messageCount?: number;
}) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col bg-[#0B1220] text-white transition-[width] duration-300 ease-in-out motion-reduce:transition-none lg:flex',
        collapsed ? 'w-18' : 'w-64'
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-white/10', collapsed ? 'justify-center px-3' : 'justify-between ps-5 pe-3')}>
        <SidebarLogo collapsed={collapsed} />
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Réduire la barre latérale"
            title="Réduire"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[#E63946]/60"
          >
            <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <NavGroups collapsed={collapsed} messageCount={messageCount} />

      <div className={cn('space-y-0.5 border-t border-white/10 p-3')}>
        {collapsed && (
          <button type="button" onClick={onToggle} aria-label="Étendre la barre latérale" title="Étendre" className={cn(footerLink, 'justify-center px-0')}>
            <PanelLeftOpen aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
          </button>
        )}
        <Link
          href="/"
          target="_blank"
          title={collapsed ? 'Voir le site' : undefined}
          aria-label={collapsed ? 'Voir le site (nouvel onglet)' : undefined}
          className={cn(footerLink, collapsed && 'justify-center px-0')}
        >
          <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Voir le site</span>}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          title={collapsed ? 'Se déconnecter' : undefined}
          aria-label={collapsed ? 'Se déconnecter' : undefined}
          className={cn(footerLink, collapsed && 'justify-center px-0')}
        >
          <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</span>}
        </button>
      </div>
    </aside>
  );
}

/* ── Mobile drawer ─────────────────────────────────────────────────── */
export function AdminMobileDrawer({
  open,
  onClose,
  onLogout,
  loggingOut,
  messageCount = 0,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  messageCount?: number;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden">
      <div className="fixed inset-0 z-40 bg-[#0B1220]/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu administration"
        className="fixed inset-y-0 start-0 z-50 flex w-[min(20rem,86vw)] flex-col bg-[#0B1220] text-white shadow-2xl"
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 ps-5 pe-3">
          <SidebarLogo collapsed={false} />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[#E63946]/60"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <NavGroups onNavigate={onClose} messageCount={messageCount} />

        <div className="space-y-0.5 border-t border-white/10 p-3">
          <Link href="/" target="_blank" onClick={onClose} className={footerLink}>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            Voir le site
          </Link>
          <button type="button" onClick={onLogout} disabled={loggingOut} className={footerLink}>
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ── Avatar ────────────────────────────────────────────────────────── */
function Avatar({ profile, size }: { profile: ClientAuthProfile | null; size: 'sm' | 'md' }) {
  const custom = profile?.avatarUrl || profile?.agencyLogoUrl;
  const initials = (profile?.displayName || 'A')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0B1220] font-bold text-white',
        size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm'
      )}
    >
      {custom ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar utilisateur (URL distante)
        <img src={custom} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/* ── Top bar ───────────────────────────────────────────────────────── */
export function AdminTopBar({
  title,
  subtitle,
  actions,
  onMobileMenu,
  onLogout,
  loggingOut,
  messageCount = 0,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onMobileMenu: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  messageCount?: number;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<ClientAuthProfile | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(() => {
    fetchClientAuthProfile()
      .then((profile) => {
        if (profile) setUserProfile(profile);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    loadProfile();
    const handleUpdate = () => loadProfile();
    window.addEventListener('clickdrive:profile-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('clickdrive:profile-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  const displayName = userProfile?.displayName || 'Administrateur';
  const email = userProfile?.email || '';
  const roleLabel = userProfile ? ROLE_LABEL[userProfile.role] ?? userProfile.role : '';

  const menuLink =
    'flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-[#F5F6F8] focus-visible:bg-[#F5F6F8]';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:h-18 lg:px-8">
      <button
        type="button"
        onClick={onMobileMenu}
        aria-label={messageCount > 0 ? `Ouvrir le menu (${contactBadgeDescription(messageCount)})` : 'Ouvrir le menu'}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 outline-none transition-colors hover:bg-[#F5F6F8] focus-visible:ring-2 focus-visible:ring-[#0B1220]/30 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        {/* Le menu latéral est replié sur mobile : le point signale les messages non traités */}
        {messageCount > 0 && (
          <span aria-hidden="true" className="absolute -end-1 -top-1 h-3 w-3 rounded-full bg-[#E63946] ring-2 ring-white" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-extrabold tracking-tight text-[#0B1220] sm:text-lg">{title}</h1>
        {subtitle && <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</p>}
      </div>

      {actions && <div className="hidden items-center gap-2 md:flex">{actions}</div>}

      <Link
        href="/admin/notifications"
        aria-label="Notifications"
        title="Notifications"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 outline-none transition-colors hover:bg-[#F5F6F8] hover:text-[#0B1220] focus-visible:ring-2 focus-visible:ring-[#0B1220]/30"
      >
        <Bell className="h-4.5 w-4.5" aria-hidden="true" />
      </Link>

      <div className="relative" ref={profileRef}>
        <button
          type="button"
          onClick={() => setProfileMenuOpen((prev) => !prev)}
          className="flex items-center gap-2.5 rounded-xl p-1 outline-none transition-colors hover:bg-[#F5F6F8] focus-visible:ring-2 focus-visible:ring-[#0B1220]/30 sm:pe-2.5"
          aria-expanded={profileMenuOpen}
          aria-haspopup="menu"
          aria-label={`Compte : ${displayName}`}
        >
          <Avatar profile={userProfile} size="sm" />
          <span className="hidden min-w-0 text-start md:block">
            <span className="block max-w-36 truncate text-[13px] font-bold leading-tight text-[#0B1220]">{displayName}</span>
            <span className="block max-w-36 truncate text-[11px] text-slate-500">{roleLabel || ' '}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn('hidden h-4 w-4 text-slate-400 transition-transform md:block', profileMenuOpen && 'rotate-180')}
          />
        </button>

        {profileMenuOpen && (
          <div role="menu" className="absolute end-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_-20px_rgba(11,18,32,0.35)]">
            <div className="mb-1.5 flex items-center gap-3 rounded-xl bg-[#F5F6F8] px-3 py-3">
              <Avatar profile={userProfile} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#0B1220]">{displayName}</p>
                {email && <p className="truncate text-xs text-slate-500">{email}</p>}
                {roleLabel && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#E63946]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#B4232F]">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {roleLabel}
                  </span>
                )}
              </div>
            </div>
            <Link role="menuitem" href="/admin/settings" onClick={() => setProfileMenuOpen(false)} className={menuLink}>
              <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Paramètres de la plateforme
            </Link>
            <Link role="menuitem" href="/admin/permissions" onClick={() => setProfileMenuOpen(false)} className={menuLink}>
              <Shield className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Rôles & permissions
            </Link>
            <Link role="menuitem" href="/admin/audit" onClick={() => setProfileMenuOpen(false)} className={menuLink}>
              <ScrollText className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Journal d’audit
            </Link>
            <div className="my-1.5 border-t border-slate-100" />
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                onLogout();
              }}
              disabled={loggingOut}
              className={cn(menuLink, 'w-full font-semibold text-[#B4232F] hover:bg-red-50 disabled:opacity-50')}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {loggingOut ? 'Déconnexion en cours…' : 'Se déconnecter'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* ── Shell (layout wrapper) ────────────────────────────────────────── */
export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  // Messages de contact non traités : compteur du menu, rafraîchi en continu (voir contact-alerts-store)
  const { newCount: messageCount } = useContactAlerts();

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login?portal=admin');
    }
  }, []);

  // Cadre d'application à la hauteur de l'écran visible (dvh : barres du navigateur mobile exclues) ;
  // seul <main> défile.
  return (
    <div className="flex h-dvh overflow-hidden bg-[#F5F6F8]">
      <a
        href="#admin-main"
        className="sr-only z-60 rounded-lg bg-[#0B1220] px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        Aller au contenu
      </a>

      <AdminSidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        messageCount={messageCount}
      />
      <AdminMobileDrawer
        open={mobileOpen}
        onClose={closeMobile}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        messageCount={messageCount}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopBar
          title={title}
          subtitle={subtitle}
          actions={actions}
          onMobileMenu={() => setMobileOpen(true)}
          onLogout={handleLogout}
          loggingOut={loggingOut}
          messageCount={messageCount}
        />
        {/* `relative` : la zone qui défile est le bloc conteneur des éléments positionnés (sr-only,
            décors). Sans lui, ils se placent par rapport à la page, sortent du cadre overflow-hidden
            et allongent la page entière : une bande vide apparaissait sous le dernier bloc. */}
        <main id="admin-main" tabIndex={-1} className="relative flex-1 overflow-y-auto outline-none">
          <div className="mx-auto max-w-360 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      {/* Alerte à l'arrivée d'un message de contact (enfant direct du cadre : `fixed` reste relatif à l'écran) */}
      <ContactAlertToast />
    </div>
  );
}
