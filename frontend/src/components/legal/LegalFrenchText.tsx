import type { ReactNode } from 'react';
import { Languages } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';
import { getServerLocale } from '@/lib/i18n/server';

const NOTICE: Record<Exclude<Locale, 'fr'>, { title: string; text: string }> = {
  en: {
    title: 'Available in French only',
    text: 'This document is published in French. The French version is the legally binding text.',
  },
  es: {
    title: 'Disponible solo en francés',
    text: 'Este documento se publica en francés. La versión francesa es el texto jurídicamente vinculante.',
  },
  de: {
    title: 'Nur auf Französisch verfügbar',
    text: 'Dieses Dokument wird auf Französisch veröffentlicht. Rechtlich verbindlich ist die französische Fassung.',
  },
  nl: {
    title: 'Alleen in het Frans beschikbaar',
    text: 'Dit document wordt in het Frans gepubliceerd. De Franse versie is de juridisch bindende tekst.',
  },
  ar: {
    title: 'متاح باللغة الفرنسية فقط',
    text: 'تُنشر هذه الوثيقة باللغة الفرنسية. النسخة الفرنسية هي النص الملزم قانونيًا.',
  },
};

/**
 * Textes juridiques (CGV, confidentialité, mentions légales) : le texte français fait foi et n'est
 * pas traduit. Dans une autre langue, un avis traduit l'annonce et le texte garde lang="fr" (lecteurs
 * d'écran, traduction du navigateur) et le sens de lecture gauche-droite.
 */
export async function LegalFrenchText({ children }: { children: ReactNode }) {
  const { locale, dir } = await getServerLocale();
  if (locale === 'fr') return <>{children}</>;
  const notice = NOTICE[locale];
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50" dir={dir}>
        <div className="mx-auto flex max-w-4xl items-start gap-3 px-4 py-4 sm:px-6 lg:px-8" role="note">
          <Languages className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="text-sm text-amber-950">
            <p className="font-bold">{notice.title}</p>
            <p className="mt-0.5">{notice.text}</p>
          </div>
        </div>
      </div>
      <div lang="fr" dir="ltr">
        {children}
      </div>
    </>
  );
}
