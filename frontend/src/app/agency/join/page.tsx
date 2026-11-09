
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PartnerPlans } from '@/components/agency/join/PartnerPlans';
import { track } from '@/lib/analytics/track';
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Users,
  CarFront,
  CalendarDays,
  Headset,
  MapPin,
  Phone,
  UserRound,
  Sparkles,
  BadgeCheck,
  Clock3,
  CircleHelp,
  ChevronRight,
} from 'lucide-react';

const benefits = [
  {
    icon: Users,
    title: 'Une nouvelle clientèle',
    description:
      'Présentez votre flotte aux voyageurs, touristes et MRE recherchant une location à Nador et dans l’Oriental.',
  },
  {
    icon: CalendarDays,
    title: 'Vos réservations centralisées',
    description:
      'Recevez et gérez les demandes de location avec une meilleure visibilité sur votre activité.',
  },
  {
    icon: CarFront,
    title: 'Votre flotte en ligne',
    description:
      'Présentez vos véhicules, leurs caractéristiques, leurs tarifs et leurs disponibilités.',
  },
  {
    icon: ShieldCheck,
    title: 'Un partenariat de confiance',
    description:
      'Après vérification de votre dossier, votre agence peut obtenir le statut de partenaire vérifié.',
  },
];

const fleetOptions = [
  '1 à 5 véhicules',
  '5 à 15 véhicules',
  '15 à 30 véhicules',
  'Plus de 30 véhicules',
];

const inputClass =
  'w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#0B1220] placeholder:text-slate-400 outline-none transition-all hover:border-slate-300 focus:border-[#0B1220] focus:ring-4 focus:ring-[#0B1220]/[0.07]';

export default function AgencyJoinPage() {
  const [submitted, setSubmitted] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [fleetSize, setFleetSize] = useState('5 à 15 véhicules');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // Demande enregistrée comme message « partenariat agence » : alerte à l'équipe, accusé à l'agence
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    const website = String(new FormData(e.currentTarget).get('website') ?? '');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: managerName,
          email,
          phone,
          category: 'agency-partner',
          subject: `Inscription agence : ${agencyName}`.slice(0, 150),
          message: `Demande d'inscription d'une agence partenaire.\nAgence : ${agencyName}\nResponsable : ${managerName}\nAdresse : ${address}\nTaille de flotte : ${fleetSize}`,
          website,
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; reference?: string; error?: string } | null;
      if (!res.ok || !json?.success || !json.reference) throw new Error(json?.error ?? 'Envoi impossible pour le moment.');
      setReference(json.reference);
      track('Contact envoyé', { categorie: 'agency-partner' });
      setSubmitted(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Envoi impossible pour le moment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F6F8] text-[#0B1220]">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0B1220]">
        {/* Background photo */}
        <Image
          src="/join.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-30"
          aria-hidden="true"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0B1220]/60 via-[#0B1220]/50 to-[#0B1220]/80"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div
          aria-hidden="true"
          className="absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full bg-[#E63946]/20 blur-[110px]"
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/90">
              <Sparkles className="h-4 w-4 text-[#E63946]" />
              Programme partenaires ClickDrive
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Faites grandir votre agence avec{' '}
              <span className="text-[#E63946]">ClickDrive.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Développez votre visibilité, présentez votre flotte et gérez
              vos demandes de location depuis une plateforme conçue pour
              les agences de Nador et de la région de l’Oriental.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#agency-form"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E63946] px-6 text-sm font-bold text-white shadow-lg shadow-red-950/20 transition-colors hover:bg-[#C92F3B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 sm:w-auto"
              >
                Devenir partenaire
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Découvrir ClickDrive
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#E63946]" />
                Inscription gratuite
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#E63946]" />
                Vérification des agences
              </span>
              <span className="flex items-center gap-2">
                <Headset className="h-4 w-4 text-[#E63946]" />
                Accompagnement partenaire
              </span>
            </div>
          </div>
        </div>

        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#E63946] to-transparent opacity-80" />
      </section>

      {/* MAIN CONTENT */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {submitted ? (
          <div className="mx-auto max-w-2xl">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.04]">
              <div className="bg-[#0B1220] px-6 py-10 text-center sm:px-10">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/20">
                  <CheckCircle2 className="h-9 w-9" />
                </div>

                <h2 className="mt-5 text-2xl font-bold text-white" role="status">
                  Demande envoyée
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
                  {reference ? <>Référence <strong className="font-mono text-white">{reference}</strong>. </> : null}
                  Notre équipe vous recontacte sous 24 h ouvrées pour vérifier votre agence et préparer votre mise en ligne.
                </p>
              </div>

              <div className="space-y-5 p-6 sm:p-10">
                <h3 className="text-sm font-bold text-[#0B1220]">
                  Récapitulatif de votre demande
                </h3>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {[
                    ['Agence', agencyName],
                    ['Responsable', managerName],
                    ['Téléphone', phone],
                    ['E-mail', email],
                    ['Adresse', address],
                    ['Taille de flotte', fleetSize],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="text-sm font-semibold text-[#0B1220]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-[#0B1220] transition-colors hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour au formulaire
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14">
            {/* LEFT: BENEFITS */}
            <div className="lg:col-span-5">
              <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#E63946]">
                  Pourquoi ClickDrive ?
                </span>

                <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                  Votre activité mérite une meilleure visibilité.
                </h2>

                <p className="mt-4 text-sm leading-7 text-slate-600">
                  ClickDrive accompagne les agences de location dans leur
                  développement digital, avec des outils adaptés à leur
                  activité et à leurs besoins.
                </p>
              </div>

              <div className="space-y-3">
                {benefits.map((benefit) => {
                  const Icon = benefit.icon;

                  return (
                    <div
                      key={benefit.title}
                      className="group flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/[0.03] sm:p-5"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white transition-colors group-hover:bg-[#E63946]">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-[#0B1220]">
                          {benefit.title}
                        </h3>
                        <p className="mt-1.5 text-xs leading-6 text-slate-600">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TRUST PANEL */}
              <div className="mt-6 rounded-2xl border border-[#0B1220]/10 bg-[#0B1220] p-5 text-white sm:p-6">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-[#E63946]" />
                  <h3 className="text-sm font-bold">
                    Un partenariat transparent
                  </h3>
                </div>

                <p className="mt-3 text-xs leading-6 text-slate-300">
                  Votre demande est étudiée avant toute activation.
                  Les modalités d’abonnement et les conditions du
                  partenariat sont communiquées avant votre engagement.
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-medium text-slate-300">
                  <Clock3 className="h-4 w-4 text-[#E63946]" />
                  Inscription sans frais
                </div>
              </div>
            </div>

            {/* RIGHT: FORM */}
            <div id="agency-form" className="lg:col-span-7">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.04]">
                <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white">
                      <Building2 className="h-6 w-6" />
                    </div>

                    <div>
                      <h2 className="text-lg font-extrabold tracking-tight text-[#0B1220]">
                        Rejoindre notre réseau
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Renseignez les informations de votre agence.
                        Notre équipe pourra ensuite étudier votre demande.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-[#E63946]" />
                    <div className="h-1 flex-1 rounded-full bg-slate-100" />
                    <div className="h-1 flex-1 rounded-full bg-slate-100" />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Informations de votre agence
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="space-y-5 px-6 py-7 sm:px-8 sm:py-8"
                >
                  {/* AGENCY NAME */}
                  <div>
                    <label
                      htmlFor="join-agency-name"
                      className="mb-2 block text-xs font-bold text-slate-700"
                    >
                      Nom commercial de l’agence
                      <span className="ml-1 text-[#E63946]">*</span>
                    </label>

                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="join-agency-name"
                        name="agencyName"
                        type="text"
                        autoComplete="organization"
                        required
                        minLength={2}
                        maxLength={100}
                        placeholder="Ex. : Nador Prestige Rent"
                        value={agencyName}
                        onChange={(e) => setAgencyName(e.target.value)}
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>

                  {/* MANAGER + PHONE */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="join-contact-name"
                        className="mb-2 block text-xs font-bold text-slate-700"
                      >
                        Nom du responsable
                        <span className="ml-1 text-[#E63946]">*</span>
                      </label>

                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="join-contact-name"
                          name="managerName"
                          type="text"
                          autoComplete="name"
                          required
                          minLength={2}
                          maxLength={100}
                          placeholder="Votre nom complet"
                          value={managerName}
                          onChange={(e) => setManagerName(e.target.value)}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="join-phone"
                        className="mb-2 block text-xs font-bold text-slate-700"
                      >
                        Téléphone / WhatsApp
                        <span className="ml-1 text-[#E63946]">*</span>
                      </label>

                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="join-phone"
                          name="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          dir="ltr"
                          required
                          minLength={8}
                          maxLength={20}
                          placeholder="+212 6 XX XX XX XX"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* EMAIL */}
                  <div>
                    <label htmlFor="join-email" className="mb-2 block text-xs font-bold text-slate-700">
                      E-mail
                      <span className="ml-1 text-[#E63946]">*</span>
                    </label>
                    <input
                      id="join-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      dir="ltr"
                      required
                      maxLength={254}
                      placeholder="contact@votre-agence.ma"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">Pour recevoir l’accès à votre espace agence et les demandes de réservation.</p>
                  </div>

                  {/* Champ piège pour les robots : hors écran, ignoré au clavier et par les lecteurs d'écran */}
                  <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                    <label htmlFor="join-website">Site web</label>
                    <input id="join-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
                  </div>

                  {/* ADDRESS */}
                  <div>
                    <label
                      htmlFor="join-address"
                      className="mb-2 block text-xs font-bold text-slate-700"
                    >
                      Adresse de l’agence
                      <span className="ml-1 text-[#E63946]">*</span>
                    </label>

                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="join-address"
                        name="address"
                        type="text"
                        autoComplete="street-address"
                        required
                        minLength={5}
                        maxLength={200}
                        placeholder="Quartier, rue, ville..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Nador et communes environnantes.
                    </p>
                  </div>

                  {/* FLEET SIZE */}
                  <div>
                    <label
                      htmlFor="join-fleet-size"
                      className="mb-2 block text-xs font-bold text-slate-700"
                    >
                      Taille approximative de votre flotte
                    </label>

                    <div className="relative">
                      <CarFront className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        id="join-fleet-size"
                        name="fleetSize"
                        value={fleetSize}
                        onChange={(e) => setFleetSize(e.target.value)}
                        className={`${inputClass} cursor-pointer appearance-none pl-11 pr-10`}
                      >
                        {fleetOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
                    </div>
                  </div>

                  {/* SUBMIT */}
                  <div className="border-t border-slate-100 pt-5">
                    {sendError && (
                      <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {sendError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={sending}
                      className="disabled:cursor-wait disabled:opacity-70 group inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-[#E63946] px-5 text-sm font-bold text-white shadow-lg shadow-[#E63946]/15 transition-all hover:-translate-y-0.5 hover:bg-[#C92F3B] hover:shadow-xl hover:shadow-[#E63946]/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E63946]/20 active:translate-y-0"
                    >
                      {sending ? 'Envoi en cours…' : 'Envoyer ma demande'}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>

                    <div className="mt-4 flex items-start justify-center gap-2 text-center">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <p className="max-w-sm text-[11px] leading-5 text-slate-500">
                        Vos informations sont utilisées pour étudier votre
                        candidature et vous contacter au sujet du partenariat.
                      </p>
                    </div>
                  </div>
                </form>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-[#E63946]" />
                <div>
                  <p className="text-xs font-bold text-[#0B1220]">
                    Une question avant de vous inscrire ?
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Notre équipe pourra vous présenter le fonctionnement
                    de la plateforme et les modalités du partenariat.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {!submitted && <PartnerPlans />}

      {/* BOTTOM CTA */}
      {!submitted && (
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
            <div>
              <h2 className="text-sm font-bold text-[#0B1220]">
                Prêt à développer votre activité ?
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Rejoignez le réseau de partenaires ClickDrive.
              </p>
            </div>

            <a
              href="#agency-form"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#E63946] transition-colors hover:text-[#C92F3B]"
            >
              Commencer l’inscription
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
