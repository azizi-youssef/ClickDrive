import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Mentions Légales',
  alternates: { canonical: '/mentions-legales' },
  description:
    "Informations légales relatives à la plateforme ClickDrive, éditeur, hébergeur et conditions d'utilisation du site de location de voitures à Nador.",
  robots: { index: true, follow: true },
};

const LAST_UPDATE = '26 octobre 2026';

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <nav aria-label="Fil d’Ariane" className="mb-5 flex items-center gap-1.5 text-xs text-ink-secondary">
            <Link href="/" className="hover:text-slate-600 transition-colors">Accueil</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-700 font-medium">Mentions légales</span>
          </nav>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1220]">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Mentions Légales
            </h1>
          </div>
          <p className="text-sm text-slate-500">Dernière mise à jour : {LAST_UPDATE}</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-10">

          {/* 1 - Éditeur */}
          <Section title="1. Éditeur du site">
            <InfoGrid items={[
              { label: 'Dénomination sociale', value: 'ClickDrive' },
              { label: 'Forme juridique', value: 'Entreprise individuelle' },
              { label: 'Responsable de la publication', value: 'Youssef Azizi' },
              { label: 'Adresse', value: 'Nador, Région de l\'Oriental, Maroc' },
              { label: 'Email', value: 'contact@clickdrive.ma' },
              { label: 'Site web', value: 'https://clickdrive.ma' },
            ]} />
          </Section>

          {/* 2 - Hébergeur */}
          <Section title="2. Hébergeur">
            <InfoGrid items={[
              { label: 'Hébergeur', value: 'Vercel Inc.' },
              { label: 'Adresse', value: '340 Pine Street, Suite 700, San Francisco, CA 94104, États-Unis' },
              { label: 'Site web', value: 'https://vercel.com' },
            ]} />
            <Paragraph>
              La base de données et les services d&apos;authentification sont fournis par{' '}
              <strong>Supabase Inc.</strong> (infrastructure PostgreSQL hébergée sur AWS EU-West).
            </Paragraph>
          </Section>

          {/* 3 - Propriété intellectuelle */}
          <Section title="3. Propriété intellectuelle">
            <Paragraph>
              L&apos;ensemble du contenu présent sur le site ClickDrive (textes, graphiques, logos,
              images, icônes, sons, logiciels) est la propriété exclusive de ClickDrive ou de ses
              partenaires, et est protégé par les lois marocaines et internationales relatives à
              la propriété intellectuelle.
            </Paragraph>
            <Paragraph>
              Toute reproduction, distribution, modification, adaptation, retransmission ou
              publication, même partielle, de ces différents éléments est strictement interdite
              sans l&apos;accord exprès par écrit de ClickDrive.
            </Paragraph>
          </Section>

          {/* 4 - Données personnelles */}
          <Section title="4. Données personnelles">
            <Paragraph>
              ClickDrive collecte et traite des données personnelles dans le cadre de la gestion
              des réservations de véhicules (nom, prénom, CIN/passeport, email, téléphone). Ces
              données sont traitées conformément à la{' '}
              <strong>loi n° 09-08 relative à la protection des personnes physiques à l'égard
              du traitement des données à caractère personnel</strong> (Maroc) et au Règlement
              Général sur la Protection des Données (RGPD) pour les ressortissants européens.
            </Paragraph>
            <Paragraph>
              Pour toute demande relative à vos données personnelles (accès, rectification,
              suppression), contactez-nous à{' '}
              <a href="mailto:privacy@clickdrive.ma" className="text-accent-text hover:underline font-semibold">
                privacy@clickdrive.ma
              </a>.
            </Paragraph>
            <Paragraph>
              Consultez notre{' '}
              <Link href="/confidentialite" className="text-accent-text hover:underline font-semibold">
                Politique de Confidentialité
              </Link>{' '}
              pour plus d&apos;informations.
            </Paragraph>
          </Section>

          {/* 5 - Cookies */}
          <Section title="5. Cookies">
            <Paragraph>
              Le site ClickDrive utilise des cookies essentiels au fonctionnement de la
              plateforme (gestion de session, authentification). Aucun cookie publicitaire
              tiers n&apos;est déposé sans votre consentement.
            </Paragraph>
            <Paragraph>
              Vous pouvez configurer votre navigateur pour refuser les cookies, ce qui peut
              toutefois affecter certaines fonctionnalités du site.
            </Paragraph>
          </Section>

          {/* 6 - Responsabilité */}
          <Section title="6. Limitation de responsabilité">
            <Paragraph>
              ClickDrive agit en qualité d&apos;<strong>intermédiaire technique</strong> entre les
              voyageurs et les agences de location de véhicules. ClickDrive ne saurait être tenu
              responsable des dommages directs ou indirects résultant de l&apos;utilisation du site,
              de l&apos;indisponibilité d&apos;un véhicule, ou d&apos;un litige entre un client et une agence
              partenaire.
            </Paragraph>
            <Paragraph>
              Les agences partenaires sont des entités indépendantes, responsables de leurs
              propres véhicules, tarifs et conditions de location.
            </Paragraph>
          </Section>

          {/* 7 - Loi applicable */}
          <Section title="7. Loi applicable et juridiction">
            <Paragraph>
              Les présentes mentions légales sont régies par le <strong>droit marocain</strong>.
              En cas de litige, les parties s&apos;engagent à rechercher une solution amiable avant
              tout recours judiciaire. À défaut, les tribunaux compétents de <strong>Nador</strong>{' '}
              seront seuls compétents.
            </Paragraph>
          </Section>

          {/* 8 - Contact */}
          <Section title="8. Contact">
            <Paragraph>
              Pour toute question relative aux présentes mentions légales, vous pouvez nous
              contacter :
            </Paragraph>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li>
                📧 <a href="mailto:contact@clickdrive.ma" className="text-accent-text hover:underline font-semibold">contact@clickdrive.ma</a>
              </li>
              <li>
                📍 Nador, Région de l&apos;Oriental, Maroc
              </li>
              <li>
                💬 <Link href="/contact" className="text-accent-text hover:underline font-semibold">Formulaire de contact</Link>
              </li>
            </ul>
          </Section>

        </div>

        {/* Footer links */}
        <div className="mt-14 flex flex-wrap gap-4 border-t border-slate-200 pt-8 text-sm">
          <Link href="/cgv" className="text-slate-500 hover:text-slate-800 transition-colors">
            Conditions Générales de Vente
          </Link>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <Link href="/confidentialite" className="text-slate-500 hover:text-slate-800 transition-colors">
            Politique de Confidentialité
          </Link>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <Link href="/contact" className="text-slate-500 hover:text-slate-800 transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Shared sub-components ─────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-slate-900 border-l-4 border-[#E63946] pl-4">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-7 text-slate-600">{children}</p>;
}

function InfoGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
          <dd className="text-sm font-semibold text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
