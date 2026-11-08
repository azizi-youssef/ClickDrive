import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente',
  alternates: { canonical: '/cgv' },
  description:
    'Conditions Générales de Vente (CGV) de ClickDrive, plateforme de location de voitures à Nador. Modalités de réservation, annulation, tarification et responsabilités.',
  robots: { index: true, follow: true },
};

const LAST_UPDATE = '26 octobre 2026';

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <nav aria-label="Fil d’Ariane" className="mb-5 flex items-center gap-1.5 text-xs text-ink-secondary">
            <Link href="/" className="hover:text-slate-600 transition-colors">Accueil</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-700 font-medium">Conditions Générales de Vente</span>
          </nav>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1220]">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Conditions Générales de Vente
            </h1>
          </div>
          <p className="text-sm text-slate-500">Dernière mise à jour : {LAST_UPDATE}</p>
        </div>
      </div>

      {/* Intro banner */}
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-sm text-amber-800">
            <strong>Important :</strong> En utilisant la plateforme ClickDrive, vous acceptez les
            présentes Conditions Générales de Vente dans leur intégralité. Veuillez les lire
            attentivement avant toute réservation.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-10">

          <Section title="Article 1 — Objet et champ d'application">
            <Paragraph>
              Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les
              relations contractuelles entre <strong>ClickDrive</strong> (ci-après « la Plateforme »)
              et tout utilisateur (ci-après « le Client ») souhaitant effectuer une demande de
              réservation de véhicule auprès d&apos;une agence partenaire.
            </Paragraph>
            <Paragraph>
              ClickDrive agit en qualité d&apos;<strong>intermédiaire de mise en relation</strong> entre
              les Clients et les Agences partenaires. Le contrat de location est conclu
              directement entre le Client et l&apos;Agence. ClickDrive n&apos;est pas partie au contrat de
              location lui-même.
            </Paragraph>
          </Section>

          <Section title="Article 2 — Inscription et compte utilisateur">
            <Paragraph>
              La création d&apos;un compte sur ClickDrive est gratuite. Pour effectuer une demande de
              réservation, le Client doit :
            </Paragraph>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E63946] mt-2" />Fournir des informations exactes et complètes (nom, prénom, email, téléphone)</li>
              <li className="flex items-start gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E63946] mt-2" />Être âgé d&apos;au moins 21 ans et titulaire d&apos;un permis de conduire valide</li>
              <li className="flex items-start gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E63946] mt-2" />Disposer d&apos;une pièce d&apos;identité valide (CIN marocaine ou passeport)</li>
            </ul>
            <Paragraph>
              Le Client est responsable de la confidentialité de ses identifiants. Toute
              utilisation frauduleuse du compte doit être signalée immédiatement à ClickDrive.
            </Paragraph>
          </Section>

          <Section title="Article 3 — Processus de réservation">
            <Paragraph>
              Le processus de réservation sur ClickDrive comprend les étapes suivantes :
            </Paragraph>
            <ol className="mt-3 space-y-3 text-sm text-slate-600">
              {[
                { n: '1', t: 'Recherche', d: 'Sélection du véhicule, des dates de prise en charge et de restitution, et du point de livraison.' },
                { n: '2', t: 'Identification', d: 'Saisie des informations du conducteur principal (CIN/Passeport, permis, coordonnées).' },
                { n: '3', t: 'Demande', d: 'Soumission de la demande de réservation via la plateforme. Un numéro de référence unique (CD-YYYY-XXXXXX) est généré.' },
                { n: '4', t: 'Confirmation', d: 'L\'agence examine la demande et confirme ou informe le Client de la disponibilité dans les plus brefs délais.' },
              ].map(step => (
                <li key={step.n} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0B1220] text-[11px] font-bold text-white">{step.n}</span>
                  <span><strong>{step.t} :</strong> {step.d}</span>
                </li>
              ))}
            </ol>
            <Paragraph>
              La demande de réservation <strong>ne constitue pas un contrat de location ferme</strong>{' '}
              jusqu&apos;à confirmation explicite de l&apos;agence partenaire.
            </Paragraph>
          </Section>

          <Section title="Article 4 — Tarification et paiement">
            <Paragraph>
              Les prix affichés sur ClickDrive sont exprimés en <strong>Dirhams Marocains (MAD)</strong>{' '}
              et représentent le tarif journalier de base hors options.
            </Paragraph>
            <Paragraph>
              Les conditions de paiement (mode, délai, caution) sont fixées par chaque agence
              partenaire et précisées lors de la confirmation de réservation. ClickDrive ne collecte
              pas de paiement pour le compte des agences partenaires.
            </Paragraph>
            <Paragraph>
              Une <strong>caution (dépôt de garantie)</strong> peut être demandée par l&apos;agence
              au moment de la remise des clés. Son montant est communiqué lors de la réservation.
            </Paragraph>
          </Section>

          <Section title="Article 5 — Annulation et modification">
            <Paragraph>
              Les conditions d&apos;annulation et de modification varient selon chaque agence
              partenaire et sont précisées lors de la confirmation de réservation.
            </Paragraph>
            <Paragraph>
              En cas d&apos;annulation souhaitée par le Client avant la remise des clés, celui-ci
              doit contacter directement l&apos;agence partenaire via les coordonnées fournies à la
              confirmation et en informer ClickDrive.
            </Paragraph>
            <Paragraph>
              ClickDrive se réserve le droit d&apos;annuler une réservation en cas de suspicion de
              fraude, d&apos;informations erronées ou de non-respect des présentes CGV.
            </Paragraph>
          </Section>

          <Section title="Article 6 — Obligations du Client">
            <Paragraph>Le Client s&apos;engage à :</Paragraph>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {[
                'Se présenter à l\'heure et au lieu convenus avec les documents requis (CIN/passeport, permis de conduire)',
                'Utiliser le véhicule conformément au contrat de location et au code de la route',
                'Restituer le véhicule dans l\'état et aux conditions convenus',
                'Ne pas sous-louer ou prêter le véhicule à un tiers non désigné au contrat',
                'Signaler tout dommage ou incident à l\'agence dans les plus brefs délais',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E63946]" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Article 7 — Responsabilité de ClickDrive">
            <Paragraph>
              ClickDrive s&apos;engage à maintenir la disponibilité de la plateforme et à traiter les
              données personnelles avec sécurité.
            </Paragraph>
            <Paragraph>
              ClickDrive ne peut être tenu responsable :
            </Paragraph>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {[
                'De l\'état mécanique ou de la disponibilité effective d\'un véhicule',
                'Des litiges entre le Client et l\'agence partenaire',
                'Des dommages directs ou indirects résultant d\'une annulation ou d\'une modification de réservation par l\'agence',
                'Des interruptions de service dues à des maintenances ou événements de force majeure',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Article 8 — Protection anti-désintermédiation">
            <Paragraph>
              La mise en relation effectuée via ClickDrive est réservée à l&apos;usage personnel du
              Client. Il est strictement interdit d&apos;utiliser les informations obtenues via la
              plateforme pour contacter les agences partenaires en dehors du cadre de la
              réservation et dans le but de contourner la plateforme.
            </Paragraph>
          </Section>

          <Section title="Article 9 — Propriété intellectuelle">
            <Paragraph>
              Tous les contenus de la plateforme ClickDrive sont protégés par le droit de la
              propriété intellectuelle. Toute utilisation non autorisée est strictement interdite.
            </Paragraph>
          </Section>

          <Section title="Article 10 — Droit applicable et juridiction compétente">
            <Paragraph>
              Les présentes CGV sont soumises au <strong>droit marocain</strong>. Tout litige
              relatif à leur interprétation ou exécution sera soumis à la compétence exclusive
              des tribunaux de <strong>Nador</strong>, sauf disposition légale contraire.
            </Paragraph>
          </Section>

          <Section title="Article 11 — Modification des CGV">
            <Paragraph>
              ClickDrive se réserve le droit de modifier les présentes CGV à tout moment. Les
              Clients seront informés des modifications substantielles par email ou notification
              sur la plateforme. L&apos;utilisation continue de la plateforme après modification
              vaut acceptation des nouvelles CGV.
            </Paragraph>
          </Section>

          <Section title="Article 12 — Contact et réclamations">
            <Paragraph>
              Pour toute réclamation ou question relative aux présentes CGV :
            </Paragraph>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li>📧 <a href="mailto:contact@clickdrive.ma" className="text-accent-text hover:underline font-semibold">contact@clickdrive.ma</a></li>
              <li>📍 Nador, Région de l&apos;Oriental, Maroc</li>
              <li>💬 <Link href="/contact" className="text-accent-text hover:underline font-semibold">Formulaire de contact en ligne</Link></li>
            </ul>
          </Section>

        </div>

        {/* Footer links */}
        <div className="mt-14 flex flex-wrap gap-4 border-t border-slate-200 pt-8 text-sm">
          <Link href="/mentions-legales" className="text-slate-500 hover:text-slate-800 transition-colors">
            Mentions Légales
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
