'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import { CookieBanner } from '@/components/shared/CookieBanner';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import type { Locale } from '@/lib/i18n/config';
import type { Messages } from '@/lib/i18n/messages';
import { delocalizeHref } from '@/lib/i18n/routing';

export function AppShell({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: Locale;
  messages: Partial<Messages>;
}) {
  // Chemin français canonique : /nl/login se met en page comme /login
  const rawPathname = usePathname();
  const pathname = rawPathname ? delocalizeHref(rawPathname) : rawPathname;

  // Les routes d'administration et agence ont leurs propres interfaces et layouts
  // « Devenir partenaire » est une page publique : elle garde menu, pied de page et <main>
  const isAdminOrAgency =
    pathname?.startsWith('/admin') ||
    (pathname?.startsWith('/agency') && !pathname.startsWith('/agency/join'));

  // La connexion est une page « focus » plein écran : sans navbar ni footer, avec son propre <main>
  const isFocusedAuth = pathname === '/login';

  return (
    <LanguageProvider locale={locale} messages={messages}>
      {isAdminOrAgency ? (
        children
      ) : isFocusedAuth ? (
        <>
          {children}
          <CookieBanner />
        </>
      ) : (
        <>
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-xl focus:bg-[#0B1220] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
          >
            {messages.common?.skipToContent}
          </a>

          <Navbar />

          <main id="contenu" className="flex-1">
            {children}
          </main>

          <Footer />

          {/* Bandeau de consentement cookies — CNDP / RGPD */}
          <CookieBanner />
        </>
      )}
    </LanguageProvider>
  );
}

