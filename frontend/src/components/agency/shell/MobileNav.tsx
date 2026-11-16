'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronRight, Home, LayoutGrid, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heading } from '@/lib/design/tokens';

type Section = { id: string; label: string; icon: LucideIcon };

/** Sections affichées directement dans la barre du bas (les autres sont sous « Plus »). */
const PRIMARY_IDS = ['overview', 'bookings', 'fleet', 'calendar'];

const SHORT_LABELS: Record<string, string> = {
  overview: 'Accueil',
  bookings: 'Demandes',
  fleet: 'Flotte',
  calendar: 'Calendrier',
};

/**
 * Navigation mobile/tablette du portail agence : barre fixe en bas d'écran
 * (4 sections principales + « Plus ») au lieu d'une rangée d'onglets défilants.
 */
export function MobileNav({
  sections,
  activeSection,
  onNavigate,
  pendingCount = 0,
}: {
  sections: Section[];
  activeSection: string;
  onNavigate: (id: string) => void;
  /** Demandes de réservation à traiter (pastille sur « Demandes ») */
  pendingCount?: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Le menu ouvert a sa propre entrée d'historique : « Retour » (bouton ou geste Android) le ferme */
  const historyEntryRef = useRef(false);
  /** Action à lancer une fois l'entrée du menu retirée de l'historique (ex. : aller à une section) */
  const afterCloseRef = useRef<(() => void) | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Hauteur publiée dans --cd-fixed-nav (0 sur grand écran, où la barre est masquée) : le bandeau cookies
  // se pose au-dessus au lieu de la recouvrir. La marge de fin de page reste celle de l'espace agence (pb-28).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--cd-fixed-nav', `${Math.round(nav.getBoundingClientRect().height)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(nav);
    window.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      root.style.removeProperty('--cd-fixed-nav');
    };
  }, []);

  const primary = PRIMARY_IDS.map((id) => sections.find((s) => s.id === id)).filter((s): s is Section => Boolean(s));
  const activeInMore = !primary.some((s) => s.id === activeSection);

  const openSheet = () => {
    window.history.pushState(null, '', window.location.href);
    historyEntryRef.current = true;
    setSheetOpen(true);
  };

  /** Ferme le menu en retirant son entrée d'historique ; `then` s'exécute ensuite (aucune entrée en double) */
  const closeSheet = useCallback((then?: () => void) => {
    if (historyEntryRef.current) {
      historyEntryRef.current = false;
      afterCloseRef.current = then ?? null;
      window.history.back();
      return;
    }
    setSheetOpen(false);
    then?.();
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const opener = moreRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    // Retour (bouton du navigateur, geste Android, ou closeSheet) : le menu se ferme, puis l'action suit
    const onPopState = () => {
      historyEntryRef.current = false;
      setSheetOpen(false);
      const then = afterCloseRef.current;
      afterCloseRef.current = null;
      // Après le traitement du retour par le routeur
      if (then) window.setTimeout(then, 0);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPopState);
      opener?.focus();
    };
  }, [sheetOpen, closeSheet]);

  const go = (id: string) => {
    closeSheet(() => {
      onNavigate(id);
      window.scrollTo({ top: 0 });
    });
  };

  const itemClass = (active: boolean) =>
    cn(
      // Pleine largeur de la colonne : toute la case réagit au toucher, pas seulement l'icône et le libellé
      'relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]',
      active ? 'text-[#0B1220]' : 'text-slate-500 hover:text-[#0B1220]'
    );

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Sections du tableau de bord"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(11,18,32,0.08)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {primary.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            const badge = section.id === 'bookings' && pendingCount > 0;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => go(section.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={badge ? `${section.label} (${pendingCount} à traiter)` : section.label}
                  className={itemClass(active)}
                >
                  {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[#E63946]" aria-hidden="true" />}
                  <span className="relative">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {badge && (
                      <span className="absolute -end-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold text-white" aria-hidden="true">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true">{SHORT_LABELS[section.id] ?? section.label}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              ref={moreRef}
              type="button"
              onClick={openSheet}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className={itemClass(activeInMore)}
            >
              {activeInMore && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[#E63946]" aria-hidden="true" />}
              <LayoutGrid className="h-5 w-5" aria-hidden="true" />
              Plus
            </button>
          </li>
        </ul>
      </nav>

      {sheetOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button type="button" tabIndex={-1} aria-label="Fermer" onClick={() => closeSheet()} className="absolute inset-0 bg-[#0B1220]/50 backdrop-blur-[2px]" />
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="agency-sections-title"
              className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
              <div className="mb-3 flex items-center justify-between">
                <h2 id="agency-sections-title" className={heading.dialog}>
                  Toutes les sections
                </h2>
                <button
                  type="button"
                  onClick={() => closeSheet()}
                  aria-label="Fermer le menu des sections"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const active = activeSection === section.id;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => go(section.id)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-start text-sm font-semibold transition-colors',
                          active ? 'border-[#0B1220] bg-[#0B1220] text-white' : 'border-slate-200 text-[#0B1220] hover:bg-slate-50'
                        )}
                      >
                        <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-white' : 'text-[#E63946]')} aria-hidden="true" />
                        <span className="min-w-0">{section.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Hors des sections : sortir de l'espace agence. Sur ordinateur, le même lien est en bas de la barre latérale. */}
              <div className="mt-3 border-t border-slate-100 pt-3">
                {/* replace : la page d'accueil remplace l'entrée d'historique du menu (pas de « Retour » vers un menu fermé) */}
                <Link
                  href="/"
                  replace
                  onClick={() => {
                    historyEntryRef.current = false;
                    setSheetOpen(false);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-start transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
                >
                  <Home className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#0B1220]">Retour au site</span>
                    <span className="block text-xs text-slate-500">Quitter l’espace agence</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
