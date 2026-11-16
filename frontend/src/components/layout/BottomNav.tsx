'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Building2, Car, House, Motorbike, type LucideIcon } from 'lucide-react';
import Link from '@/components/i18n/LocalizedLink';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { delocalizeHref } from '@/lib/i18n/routing';

type Destination = {
  href: string;
  icon: LucideIcon;
  label: 'home' | 'cars' | 'motos' | 'agencies';
  /** Autres chemins rattachés à l'onglet (fiches agence, etc.) */
  match?: (pathname: string) => boolean;
};

/** Quatre destinations : le compte et le menu restent dans l'en-tête compact. */
const DESTINATIONS: Destination[] = [
  { href: '/', icon: House, label: 'home', match: (p) => p === '/' },
  { href: '/search', icon: Car, label: 'cars' },
  { href: '/motos', icon: Motorbike, label: 'motos' },
  { href: '/agencies', icon: Building2, label: 'agencies' },
];

function isActive(destination: Destination, pathname: string): boolean {
  if (destination.match) return destination.match(pathname);
  return pathname === destination.href || pathname.startsWith(`${destination.href}/`);
}

/** Champs qui ouvrent le clavier virtuel (pas les cases, curseurs ni boutons) */
function opensKeyboard(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image'].includes(target.type);
}

/**
 * Navigation inférieure fixe du site public (mobile et tablette, < 1024 px).
 * - Rendue côté serveur et masquée en CSS au-delà de 1024 px : aucune bascule après hydratation.
 * - Sa hauteur est réservée par la feuille de style (--cd-bottom-nav, voir globals.css).
 * - Elle s'efface pendant la saisie au clavier virtuel, pour ne jamais recouvrir un champ.
 */
export function BottomNav() {
  const rawPathname = usePathname();
  const pathname = delocalizeHref(rawPathname ?? '/');
  const { t } = useTranslation();
  const strings = t.navbar;
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    // Seulement sur écran tactile : au clavier physique, la barre ne gêne pas la saisie
    const coarse = window.matchMedia('(pointer: coarse)');
    const onFocusIn = (event: FocusEvent) => {
      if (coarse.matches && opensKeyboard(event.target)) setTyping(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      // Passage d'un champ à l'autre : la barre reste masquée
      if (!opensKeyboard(event.relatedTarget)) setTyping(false);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <nav
      id="cd-bottom-nav"
      aria-label={strings.navigation}
      data-hidden={typing || undefined}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-14px_rgba(11,18,32,0.22)] backdrop-blur-xl lg:hidden',
        'transition-transform duration-200 ease-out motion-reduce:transition-none data-hidden:translate-y-full'
      )}
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-4 px-1">
        {DESTINATIONS.map((destination) => {
          const active = isActive(destination, pathname);
          const Icon = destination.icon;
          return (
            <li key={destination.href} className="flex">
              <Link
                href={destination.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E63946]',
                  active ? 'text-[#0B1220]' : 'text-slate-500 active:text-[#0B1220]'
                )}
              >
                {/* Pastille de l'onglet actif : forme + couleur + graisse (jamais la couleur seule) */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-8 w-14 items-center justify-center rounded-full transition-[background-color,transform] duration-200 motion-reduce:transition-none',
                    active ? 'bg-[#E63946]/12 text-accent-text' : 'group-active:scale-95 group-active:bg-slate-100'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={cn('max-w-full truncate px-1 leading-tight', active && 'font-extrabold')}>
                  {strings[destination.label]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
