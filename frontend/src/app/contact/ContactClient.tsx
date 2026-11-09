'use client';

import React, { useState } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { clickdriveWhatsAppUrl } from '@/lib/constants/contact';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { track } from '@/lib/analytics/track';
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
/** Libellés traduits : t.contact.categories */
const CATEGORIES = [
  { value: 'reservation' },
  { value: 'agency-partner' },
  { value: 'vehicle' },
  { value: 'technical' },
  { value: 'billing' },
  { value: 'other' },
];

/* ── Main Component ─────────────────────────────────────────────────────── */

export function ContactClient() {
  const { t, locale, fmt } = useTranslation();
  const c = t.contact;
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
  const [serverError, setServerError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ reference: string; acknowledged: boolean } | null>(null);

  function validate(): boolean {
    const newErrors: Partial<FormData> = {};
    if (!form.name.trim()) newErrors.name = c.errName;
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = c.errEmail;
    }
    if (!form.category) newErrors.category = c.errCategory;
    if (!form.message.trim() || form.message.trim().length < 20) {
      newErrors.message = c.errMessage;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setState('sending');
    setServerError(null);
    // Champ piège invisible (robots) : lu dans le formulaire, jamais affiché
    const website = String(new FormData(e.currentTarget).get('website') ?? '');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Langue du visiteur : accusé de réception dans sa langue
        body: JSON.stringify({ ...form, website, locale }),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; reference?: string; acknowledged?: boolean; error?: string; fields?: Partial<FormData> }
        | null;
      if (!res.ok || !json?.success || !json.reference) {
        if (json?.fields) setErrors(json.fields);
        // Messages du serveur rédigés en français : traduits par un message générique dans les autres langues
        setServerError(locale === 'fr' ? json?.error ?? c.errSend : c.errSend);
        setState('error');
        return;
      }
      setReceipt({ reference: json.reference, acknowledged: Boolean(json.acknowledged) });
      track('Contact envoyé', { categorie: form.category });
      setState('success');
    } catch {
      setServerError(c.errNetwork);
      setState('error');
    }
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
          <nav aria-label={c.breadcrumbAria} className="mb-5 flex items-center gap-1.5 text-xs text-ink-secondary">
            <Link href="/" className="transition-colors hover:text-slate-600">{c.home}</Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="font-medium text-slate-700">{c.crumb}</span>
          </nav>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {c.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            {c.introBefore} <strong>{c.introStrong}</strong> {c.introAfter}
          </p>
          {/* Quick orientation */}
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">{c.chipBooking}</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">{c.chipPartner}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-600">{c.chipTechnical}</span>
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
                <h2 className="text-xl font-bold text-slate-900" role="status">{c.successTitle}</h2>
                {receipt && (
                  <p className="mt-2 text-sm text-slate-600">
                    {c.reference} <strong className="font-mono text-slate-900">{receipt.reference}</strong>
                  </p>
                )}
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  {c.successText}
                  {receipt?.acknowledged ? c.ackSent : ''}
                </p>
                <button
                  type="button"
                  onClick={() => { setState('idle'); setReceipt(null); setForm({ name: '', email: '', phone: '', subject: '', category: '', message: '' }); }}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0B1220] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {c.sendAnother}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="mb-2">
                  <h2 className="text-lg font-bold text-slate-900">{c.formTitle}</h2>
                  <p className="text-sm text-slate-500">{c.formHint}</p>
                </div>

                {/* Name + Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={c.name} htmlFor="contact-name" error={errors.name}>
                    <input
                      id="contact-name"
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? "contact-name-error" : undefined}
                      type="text"
                      required
                      placeholder={c.namePlaceholder}
                      value={form.name}
                      onChange={update('name')}
                      className={inputClass(!!errors.name)}
                    />
                  </Field>
                  <Field label={c.email} htmlFor="contact-email" error={errors.email}>
                    <input
                      id="contact-email"
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? "contact-email-error" : undefined}
                      type="email"
                      required
                      placeholder={c.emailPlaceholder}
                      value={form.email}
                      onChange={update('email')}
                      className={inputClass(!!errors.email)}
                    />
                  </Field>
                </div>

                {/* Phone + Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={c.phone} htmlFor="contact-phone">
                    <input
                      id="contact-phone"
                      type="tel"
                      placeholder="+212 6XX XXX XXX"
                      value={form.phone}
                      onChange={update('phone')}
                      className={inputClass(false)}
                    />
                  </Field>
                  <Field label={c.category} htmlFor="contact-category" error={errors.category}>
                    <select
                      id="contact-category"
                      aria-invalid={errors.category ? true : undefined}
                      aria-describedby={errors.category ? "contact-category-error" : undefined}
                      required
                      value={form.category}
                      onChange={update('category')}
                      className={inputClass(!!errors.category)}
                    >
                      <option value="">{c.chooseCategory}</option>
                      {CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>{c.categories[category.value]}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Subject */}
                <Field label={c.subject} htmlFor="contact-subject">
                  <input
                    id="contact-subject"
                    type="text"
                    placeholder={c.subjectPlaceholder}
                    value={form.subject}
                    onChange={update('subject')}
                    className={inputClass(false)}
                  />
                </Field>

                {/* Message */}
                <Field label={c.message} htmlFor="contact-message" error={errors.message}>
                  <textarea
                    id="contact-message"
                      aria-invalid={errors.message ? true : undefined}
                      aria-describedby={errors.message ? "contact-message-error" : undefined}
                    required
                    rows={6}
                    placeholder={c.messagePlaceholder}
                    value={form.message}
                    onChange={update('message')}
                    className={`${inputClass(!!errors.message)} resize-none`}
                  />
                  <p className="mt-1 text-end text-xs text-ink-secondary">{fmt(c.characters, { count: form.message.length })}</p>
                </Field>

                {/* Champ piège pour les robots : hors écran, ignoré au clavier et par les lecteurs d'écran */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label htmlFor="contact-website">{c.honeypot}</label>
                  <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
                </div>

                {/* Error banner */}
                {state === 'error' && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                      {serverError ?? c.errGeneric}{' '}
                      <a href={clickdriveWhatsAppUrl(c.whatsappFallback)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                        {c.writeWhatsapp}
                      </a>
                    </p>
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
                        {c.sending}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        {c.send}
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
              <h2 className="mb-5 text-base font-bold text-slate-900">{c.infoTitle}</h2>
              <ul className="space-y-4">
                {[
                  {
                    icon: MapPin,
                    label: c.address,
                    value: c.addressValue,
                  },
                  {
                    icon: Mail,
                    label: c.generalEmail,
                    value: 'contact@clickdrive.ma',
                    href: 'mailto:contact@clickdrive.ma',
                  },
                  {
                    icon: Mail,
                    label: c.privacyEmail,
                    value: 'privacy@clickdrive.ma',
                    href: 'mailto:privacy@clickdrive.ma',
                  },
                  {
                    icon: MessageCircle,
                    label: c.whatsapp,
                    value: c.whatsappValue,
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
                <h2 className="text-base font-bold text-slate-900">{c.hoursTitle}</h2>
              </div>
              <ul className="space-y-2 text-sm">
                {c.hours.map(({ day, hours }) => (
                  <li key={day} className="flex items-center justify-between">
                    <span className="text-slate-600">{day}</span>
                    <span className="font-semibold text-slate-900">{hours}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-ink-secondary">{c.usualDelay}</p>
            </div>

            {/* For agencies */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#0B1220]" />
                <p className="text-sm font-bold text-[#0B1220]">{c.agencyTitle}</p>
              </div>
              <p className="text-xs text-slate-600 mb-4">{c.agencyText}</p>
              <Link
                href="/agency/join"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B1220] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 shadow-2xs"
              >
                <Building2 className="h-3.5 w-3.5 text-[#E63946]" />
                {c.becomePartner}
              </Link>
            </div>

            {/* FAQ */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-bold text-slate-800">{c.faqTitle}</p>
              </div>
              <p className="text-xs text-slate-500 mb-3">{c.faqText}</p>
              <Link
                href="/faq"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text hover:underline"
              >
                {c.faqLink} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
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
