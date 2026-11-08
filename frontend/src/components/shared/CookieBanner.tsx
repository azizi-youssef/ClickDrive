'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

const STORAGE_KEY = 'clickdrive_cookie_consent';

type ConsentState = 'accepted' | 'declined' | null;

/**
 * Bandeau de consentement compact, ancré en bas de l'écran : il ne recouvre plus
 * le formulaire de recherche du hero (une ligne sur PC, deux blocs serrés sur mobile).
 */
export function CookieBanner() {
  const { t, isRTL } = useTranslation();
  const [consent, setConsent] = useState<ConsentState>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ConsentState | null;
      if (stored === 'accepted' || stored === 'declined') setConsent(stored);
    } catch {
      /* stockage indisponible : le bandeau reste affiché */
    }
  }, []);

  function save(value: Exclude<ConsentState, null>) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* stockage indisponible : le choix vaut pour la session en cours */
    }
    setConsent(value);
  }

  if (!mounted || consent !== null) return null;

  return (
    <section
      aria-label={t.cookie.title}
      dir={isRTL ? 'rtl' : 'ltr'}
      // z-45 : au-dessus des barres fixes (z-40), sous les dialogues modaux (z-50 et plus),
      // qui rendent la page inerte — la bannière ne doit pas rester visible mais inutilisable par-dessus.
      // Posée au-dessus d'une éventuelle barre d'action fixe (--cd-bottom-bar, fiche véhicule mobile)
      className="fixed inset-x-0 bottom-[var(--cd-bottom-bar,0px)] z-45 border-t border-slate-200 bg-white/95 shadow-[0_-12px_32px_-16px_rgba(11,18,32,0.25)] backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:flex-row sm:py-3 sm:items-center sm:gap-5 sm:px-6 lg:px-8">
        <p className="flex min-w-0 flex-1 items-start gap-2.5 text-xs leading-snug text-slate-600 sm:text-[13px] sm:items-center">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 sm:mt-0" aria-hidden="true" />
          <span>
            {t.cookie.desc}{' '}
            <Link
              href="/confidentialite"
              className="whitespace-nowrap font-semibold text-[#0B1220] underline underline-offset-2 hover:text-accent-text"
            >
              {t.cookie.privacy}
            </Link>
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            id="cookie-decline"
            onClick={() => save('declined')}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1220] sm:min-h-10 sm:flex-none"
          >
            {t.cookie.decline}
          </button>
          <button
            type="button"
            id="cookie-accept"
            onClick={() => save('accepted')}
            className="min-h-11 flex-1 rounded-xl bg-[#0B1220] px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946] sm:min-h-10 sm:flex-none"
          >
            {t.cookie.accept}
          </button>
        </div>
      </div>
    </section>
  );
}
