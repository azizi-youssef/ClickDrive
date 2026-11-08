'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SUPPORT_HOURS } from '@/lib/constants/contact';
import {
  ChevronRight,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock3,
  HelpCircle,
} from 'lucide-react';
import { Magnet } from '@/components/ui/react-bits';

/* ── Types ─────────────────────────────────────────────────────────────── */

type FormState = 'idle' | 'sending' | 'success' | 'error';

type FormData = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  category: string;
  message: string;
};

/**
 * CATEGORIES — chaque type dirige vers le bon canal de traitement.
 * Demande de réservation : transmise à l'agence concernée, pas au support ClickDrive.
 * Partenariat agence : traité en priorité avec un responsable local.
 * Support technique / facturation : traité par l'équipe ClickDrive sous 24 h ouvrables.
 */
const CATEGORIES = [
  { value: 'reservation', label: '🗓️ Demande d’information sur un véhicule ou une réservation' },
  { value: 'agency-partner', label: '🏢 Inscription ou partenariat agence' },
  { value: 'vehicle', label: '🚗 Question sur un véhicule spécifique' },
  { value: 'technical', label: '⚙️ Problème technique sur la plateforme' },
  { value: 'billing', label: '💳 Facturation ou abonnement' },
  { value: 'other', label: '💬 Autre demande' },
];

/* ── Main Component ─────────────────────────────────────────────────────── */

export function ContactClient() {
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    category: '',
    message: '',
  });
  const [state, setState] = useState<FormState>('idle');
  const [errors, setErrors] = useState<Partial<FormData>>({});

  function validate(): boolean {
    const newErrors: Partial<FormData> = {};
    if (!form.name.trim()) newErrors.name = 'Le nom est requis';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Adresse email invalide';
    }
    if (!form.category) newErrors.category = 'Veuillez choisir une catégorie';
    if (!form.message.trim() || form.message.trim().length < 20) {
      newErrors.message = 'Le message doit contenir au moins 20 caractères';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState('sending');
    // Simulate sending — in production wire to /api/contact
    await new Promise((r) => setTimeout(r, 1500));
    setState('success');
  }

  function update(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <nav aria-label="Fil d’Ariane" className="mb-5 flex items-center gap-1.5 text-xs text-ink-secondary">
            <Link href="/" className="transition-colors hover:text-slate-600">Accueil</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-700">Contact</span>
          </nav>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Contactez ClickDrive
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Choisissez la catégorie de votre demande ci-dessous. Les questions sur les
            véhicules et agences sont traitées en priorité. Le support général répond
            sous <strong>24 h ouvrables</strong> (lundi–vendredi).
          </p>
          {/* Quick orientation */}
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">Réservation → transmis à l&apos;agence</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">Partenariat agence → prioritaire</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-600">Support technique → 24 h ouvrables</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">

          {/* ── Form ── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {state === 'success' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Message envoyé !</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Merci pour votre message. Notre équipe vous répondra sous 24h (jours ouvrés).
                </p>
                <button
                  onClick={() => { setState('idle'); setForm({ name: '', email: '', phone: '', subject: '', category: '', message: '' }); }}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0B1220] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="mb-2">
                  <h2 className="text-lg font-bold text-slate-900">Envoyez-nous un message</h2>
                  <p className="text-sm text-slate-500">Tous les champs marqués * sont obligatoires.</p>
                </div>

                {/* Name + Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nom complet *" htmlFor="contact-name" error={errors.name}>
                    <input
                      id="contact-name"
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? "contact-name-error" : undefined}
                      type="text"
                      required
                      placeholder="Votre nom et prénom"
                      value={form.name}
                      onChange={update('name')}
                      className={inputClass(!!errors.name)}
                    />
                  </Field>
                  <Field label="Email *" htmlFor="contact-email" error={errors.email}>
                    <input
                      id="contact-email"
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? "contact-email-error" : undefined}
                      type="email"
                      required
                      placeholder="vous@email.com"
                      value={form.email}
                      onChange={update('email')}
                      className={inputClass(!!errors.email)}
                    />
                  </Field>
                </div>

                {/* Phone + Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Téléphone (optionnel)" htmlFor="contact-phone">
                    <input
                      id="contact-phone"
                      type="tel"
                      placeholder="+212 6XX XXX XXX"
                      value={form.phone}
                      onChange={update('phone')}
                      className={inputClass(false)}
                    />
                  </Field>
                  <Field label="Catégorie *" htmlFor="contact-category" error={errors.category}>
                    <select
                      id="contact-category"
                      aria-invalid={errors.category ? true : undefined}
                      aria-describedby={errors.category ? "contact-category-error" : undefined}
                      required
                      value={form.category}
                      onChange={update('category')}
                      className={inputClass(!!errors.category)}
                    >
                      <option value="">Choisir une catégorie…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Subject */}
                <Field label="Objet (optionnel)" htmlFor="contact-subject">
                  <input
                    id="contact-subject"
                    type="text"
                    placeholder="Ex: Question sur ma réservation CD-2026-123456"
                    value={form.subject}
                    onChange={update('subject')}
                    className={inputClass(false)}
                  />
                </Field>

                {/* Message */}
                <Field label="Message *" htmlFor="contact-message" error={errors.message}>
                  <textarea
                    id="contact-message"
                      aria-invalid={errors.message ? true : undefined}
                      aria-describedby={errors.message ? "contact-message-error" : undefined}
                    required
                    rows={6}
                    placeholder="Décrivez votre demande en détail…"
                    value={form.message}
                    onChange={update('message')}
                    className={`${inputClass(!!errors.message)} resize-none`}
                  />
                  <p className="mt-1 text-right text-xs text-ink-secondary">{form.message.length} caractère(s)</p>
                </Field>

                {/* Error banner */}
                {state === 'error' && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Une erreur est survenue. Veuillez réessayer ou contacter directement par email.
                  </div>
                )}

                <Magnet strength={0.2} className="w-full">
                  <button
                    id="contact-submit"
                    type="submit"
                    disabled={state === 'sending'}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-action px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:bg-action-hover disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {state === 'sending' ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Envoi en cours…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Envoyer le message
                      </>
                    )}
                  </button>
                </Magnet>
              </form>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">

            {/* Contact info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-base font-bold text-slate-900">Informations de contact</h2>
              <ul className="space-y-4">
                {[
                  {
                    icon: MapPin,
                    label: 'Adresse',
                    value: 'Nador, Région de l\'Oriental, Maroc',
                  },
                  {
                    icon: Mail,
                    label: 'Email général',
                    value: 'contact@clickdrive.ma',
                    href: 'mailto:contact@clickdrive.ma',
                  },
                  {
                    icon: Mail,
                    label: 'Protection des données',
                    value: 'privacy@clickdrive.ma',
                    href: 'mailto:privacy@clickdrive.ma',
                  },
                  {
                    icon: MessageCircle,
                    label: 'WhatsApp',
                    value: 'Réservé aux agences partenaires (support dédié)',
                  },
                ].map(({ icon: Icon, label, value, href }) => (
                  <li key={label} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{label}</p>
                      {href ? (
                        <a href={href} className="text-sm font-medium text-accent-text hover:underline">{value}</a>
                      ) : (
                        <p className="text-sm font-medium text-slate-800">{value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Hours */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-accent-text" />
                <h2 className="text-base font-bold text-slate-900">Heures de réponse</h2>
              </div>
              <ul className="space-y-2 text-sm">
                {SUPPORT_HOURS.map(({ day, hours }) => (
                  <li key={day} className="flex items-center justify-between">
                    <span className="text-slate-600">{day}</span>
                    <span className="font-semibold text-slate-900">{hours}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-ink-secondary">Délai de réponse habituel : 24h ouvrées</p>
            </div>

            {/* For agencies */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#0B1220]" />
                <p className="text-sm font-bold text-[#0B1220]">Vous êtes une agence ?</p>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                Rejoignez la plateforme ClickDrive pour présenter votre flotte et recevoir des
                demandes de réservation directement.
              </p>
              <Link
                href="/agency/join"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B1220] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 shadow-2xs"
              >
                <Building2 className="h-3.5 w-3.5 text-[#E63946]" />
                Devenir partenaire
              </Link>
            </div>

            {/* FAQ */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-bold text-slate-800">Consultez la FAQ</p>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Trouvez rapidement des réponses aux questions les plus fréquentes.
              </p>
              <Link
                href="/faq"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text hover:underline"
              >
                Voir la FAQ <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border ${hasError ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 bg-slate-50 focus:border-[#E63946] focus:ring-[#E63946]'} px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-1 focus:bg-white`;
}

function Field({
  label,
  error,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  /** id du contrôle : relie le libellé et l'erreur au champ (lecteurs d'écran, clic sur le libellé) */
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 flex items-center gap-1 text-[13px] text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
