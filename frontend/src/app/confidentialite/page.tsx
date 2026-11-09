import type { Metadata } from 'next';
import Link from '@/components/i18n/LocalizedLink';
import { ChevronRight, Shield } from 'lucide-react';
import { legalPageMetadata } from '@/lib/i18n/server';
import { LegalFrenchText } from '@/components/legal/LegalFrenchText';

export async function generateMetadata(): Promise<Metadata> {
  return legalPageMetadata('privacy', '/confidentialite');
}

const LAST_UPDATE = '26 octobre 2026';

export default function ConfidentialitePage() {
  return (
    <LegalFrenchText>
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
            <nav aria-label="Fil d’Ariane" className="mb-5 flex items-center gap-1.5 text-xs text-ink-secondary">
              <Link href="/" className="hover:text-slate-600 transition-colors">Accueil</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-slate-700 font-medium">Politique de Confidentialité</span>
            </nav>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1220]">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Politique de Confidentialité
              </h1>
            </div>
            <p className="text-sm text-slate-500">Dernière mise à jour : {LAST_UPDATE}</p>
          </div>
        </div>

        {/* Compliance badges */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Shield className="h-3 w-3" /> Conforme loi 09-08 (CNDP Maroc)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Shield className="h-3 w-3" /> Conforme RGPD (UE 2016/679)
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="space-y-10">

            <Section title="1. Responsable du traitement">
              <Paragraph>
                Le responsable du traitement des données personnelles est <strong>ClickDrive</strong>,
                représenté par <strong>Youssef Azizi</strong>, dont le siège est à Nador, Maroc.
                Contact : <a href="mailto:privacy@clickdrive.ma" className="text-accent-text hover:underline font-semibold">privacy@clickdrive.ma</a>
              </Paragraph>
            </Section>

            <Section title="2. Données collectées">
              <Paragraph>Nous collectons les catégories de données suivantes :</Paragraph>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    category: 'Données d\'identité',
                    items: ['Nom, prénom', 'Date de naissance', 'N° CIN / Passeport', 'Numéro de permis de conduire'],
                  },
                  {
                    category: 'Données de contact',
                    items: ['Adresse email', 'Numéro de téléphone (WhatsApp)', 'Pays de résidence'],
                  },
                  {
                    category: 'Données de réservation',
                    items: ['Véhicule sélectionné', 'Dates de location', 'Point de livraison', 'Options choisies'],
                  },
                  {
                    category: 'Données de navigation',
                    items: ['Adresse IP', 'Cookies de session', 'Pages visitées', 'Type de navigateur'],
                  },
                ].map(({ category, items }) => (
                  <div key={category} className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{category}</h3>
                    <ul className="space-y-1">
                      {items.map(item => (
                        <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                          <span className="h-1 w-1 rounded-full bg-[#E63946] shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="3. Finalités du traitement">
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Finalité</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Base légale</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Durée de conservation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { purpose: 'Gestion des comptes utilisateurs', basis: 'Exécution du contrat', retention: '3 ans après inactivité' },
                      { purpose: 'Traitement des demandes de réservation', basis: 'Exécution du contrat', retention: '5 ans (obligation comptable)' },
                      { purpose: 'Envoi de notifications WhatsApp', basis: 'Consentement / Contrat', retention: 'Durée de la relation' },
                      { purpose: 'Prévention de la fraude', basis: 'Intérêt légitime', retention: '1 an' },
                      { purpose: 'Réponse aux messages du formulaire de contact', basis: 'Intérêt légitime / Mesures précontractuelles', retention: '3 ans après le dernier échange' },
                      { purpose: 'Mesure d’audience sans cookie (Plausible)', basis: 'Intérêt légitime', retention: 'Statistiques agrégées, sans identification' },
                      { purpose: 'Obligations légales & comptables', basis: 'Obligation légale', retention: '10 ans' },
                    ].map(row => (
                      <tr key={row.purpose} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.purpose}</td>
                        <td className="px-4 py-3 text-slate-600">{row.basis}</td>
                        <td className="px-4 py-3 text-slate-500">{row.retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="4. Partage des données">
              <Paragraph>
                Vos données personnelles sont partagées uniquement dans les cas suivants :
              </Paragraph>
              <ul className="mt-3 space-y-3 text-sm text-slate-600">
                {[
                  { who: 'Agences partenaires ClickDrive', why: 'Pour traiter votre demande de réservation et établir le contrat de location (nom, contact, pièces d\'identité).' },
                  { who: 'Supabase (hébergeur BDD)', why: 'Stockage sécurisé des données — infrastructure AWS EU-West conforme RGPD.' },
                  { who: 'Resend (envoi des e-mails)', why: 'Envoi des e-mails de suivi de réservation et des accusés de réception du formulaire de contact.' },
                  { who: 'Plausible Analytics', why: 'Mesure d’audience sans cookie : statistiques agrégées de fréquentation, sans adresse IP conservée ni profil individuel.' },
                  { who: 'Meta / WhatsApp Business', why: 'Envoi des notifications de réservation via l\'API WhatsApp Business Cloud — uniquement si vous avez fourni votre numéro.' },
                  { who: 'Autorités compétentes', why: 'Sur réquisition judiciaire ou obligation légale uniquement.' },
                ].map(({ who, why }) => (
                  <li key={who} className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-800">{who}</p>
                    <p className="mt-0.5 text-slate-500">{why}</p>
                  </li>
                ))}
              </ul>
              <Paragraph>
                Nous ne vendons, louons ni cédons jamais vos données personnelles à des tiers
                à des fins commerciales.
              </Paragraph>
            </Section>

            <Section title="5. Vos droits">
              <Paragraph>
                Conformément à la <strong>loi n° 09-08</strong> (Maroc) et au <strong>RGPD</strong> (UE),
                vous disposez des droits suivants sur vos données personnelles :
              </Paragraph>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { right: '✅ Droit d\'accès', desc: 'Obtenir une copie de vos données.' },
                  { right: '✏️ Droit de rectification', desc: 'Corriger des données inexactes.' },
                  { right: '🗑️ Droit à l\'effacement', desc: 'Supprimer vos données (droit à l\'oubli).' },
                  { right: '⛔ Droit d\'opposition', desc: 'Vous opposer à certains traitements.' },
                  { right: '📦 Droit à la portabilité', desc: 'Recevoir vos données dans un format lisible.' },
                  { right: '⏸️ Droit de limitation', desc: 'Suspendre temporairement le traitement.' },
                ].map(({ right, desc }) => (
                  <div key={right} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="font-bold text-slate-800 text-sm">{right}</p>
                    <p className="mt-1 text-xs text-slate-500">{desc}</p>
                  </div>
                ))}
              </div>
              <Paragraph>
                Pour exercer ces droits, contactez-nous à{' '}
                <a href="mailto:privacy@clickdrive.ma" className="text-accent-text hover:underline font-semibold">privacy@clickdrive.ma</a>.
                Nous traiterons votre demande dans un délai de <strong>30 jours</strong>.
              </Paragraph>
              <Paragraph>
                En cas de réclamation non résolue, vous pouvez saisir la{' '}
                <strong>Commission Nationale de contrôle de la protection des Données à caractère
                Personnel (CNDP)</strong> — <a href="https://cndp.ma" target="_blank" rel="noopener noreferrer" className="text-accent-text hover:underline font-semibold">cndp.ma</a>.
              </Paragraph>
            </Section>

            <Section title="6. Cookies">
              <Paragraph>
                ClickDrive utilise des cookies pour assurer le bon fonctionnement de la plateforme.
              </Paragraph>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Finalité</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { type: '🔒 Session (Supabase)', purpose: 'Authentification et sécurité', duration: 'Session / 7 jours' },
                      { type: '⚙️ Préférences', purpose: 'Mémorisation des préférences utilisateur', duration: '1 an' },
                    ].map(row => (
                      <tr key={row.type} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.type}</td>
                        <td className="px-4 py-3 text-slate-600">{row.purpose}</td>
                        <td className="px-4 py-3 text-slate-500">{row.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="7. Sécurité des données">
              <Paragraph>
                ClickDrive met en œuvre des mesures techniques et organisationnelles appropriées pour
                protéger vos données contre tout accès non autorisé, perte, destruction ou
                divulgation :
              </Paragraph>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm text-slate-600">
                {[
                  '🔐 Chiffrement TLS 1.3 pour toutes les communications',
                  '🛡️ Row Level Security (RLS) PostgreSQL',
                  '🔑 Authentification JWT sécurisée (Supabase Auth)',
                  '⏱️ Rate limiting pour prévenir les attaques',
                  '🏗️ Idempotence des transactions critiques',
                  '📋 Journalisation des accès (audit trail)',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="8. Transferts internationaux">
              <Paragraph>
                Vos données sont principalement hébergées sur des serveurs en <strong>Europe de
                l&apos;Ouest (AWS EU-West)</strong> via Supabase. En cas de transfert hors EEE/Maroc,
                ClickDrive s&apos;assure que des garanties appropriées sont en place (clauses contractuelles
                types, décision d&apos;adéquation).
              </Paragraph>
            </Section>

            <Section title="9. Modification de la politique">
              <Paragraph>
                Cette politique peut être mise à jour périodiquement. La date de dernière
                modification est indiquée en haut de page. Pour les modifications substantielles,
                nous vous en informerons par email.
              </Paragraph>
            </Section>

            <Section title="10. Contact DPO">
              <Paragraph>
                Pour toute question relative à la protection de vos données :
              </Paragraph>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                <li>📧 <a href="mailto:privacy@clickdrive.ma" className="text-accent-text hover:underline font-semibold">privacy@clickdrive.ma</a></li>
                <li>📍 ClickDrive — Nador, Maroc</li>
                <li>💬 <Link href="/contact" className="text-accent-text hover:underline font-semibold">Formulaire de contact</Link></li>
              </ul>
            </Section>

          </div>

          {/* Footer links */}
          <div className="mt-14 flex flex-wrap gap-4 border-t border-slate-200 pt-8 text-sm">
            <Link href="/mentions-legales" className="text-slate-500 hover:text-slate-800 transition-colors">Mentions Légales</Link>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <Link href="/cgv" className="text-slate-500 hover:text-slate-800 transition-colors">Conditions Générales de Vente</Link>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <Link href="/contact" className="text-slate-500 hover:text-slate-800 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </LegalFrenchText>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-slate-900 border-l-4 border-[#E63946] pl-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-7 text-slate-600">{children}</p>;
}
