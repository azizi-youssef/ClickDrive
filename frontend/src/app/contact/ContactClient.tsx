'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from '@/components/i18n/LocalizedLink';
import contactHeroImage from '../../../public/contact.jpg';
import { CONTACT_EMAIL, PRIVACY_EMAIL, platformWhatsAppUrl, supportHoursRows } from '@/lib/constants/contact';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  HelpCircle,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Send,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { CONTACT_CATEGORIES } from '@/lib/validations/contact';

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

type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

/** Longueur minimale du message (même borne que l'API : lib/validations/contact.ts) */
const MESSAGE_MIN_LENGTH = 20;

const EMPTY_FORM: FormData = { name: '', email: '', phone: '', subject: '', category: '', message: '' };

/**
 * Catégories (mêmes valeurs que l'API) : libellés traduits dans t.contact.categories, conseils dans
 * t.contact.categoryHints. Tous les messages arrivent à l'équipe ClickDrive.
 */
const CATEGORY_ICONS: Record<ContactCategory, LucideIcon> = {
  reservation: CalendarCheck,
  'agency-partner': Building2,
  vehicle: Car,
  technical: Wrench,
  billing: CreditCard,
  other: MessageSquare,
};

/** Ordre des champs à l'écran : le premier champ en erreur reçoit le focus */
const FIELD_ORDER: (keyof FormData)[] = ['category', 'name', 'email', 'message'];

/* ── Page ───────────────────────────────────────────────────────────────── */

export function ContactClient() {
  const { t, locale, fmt } = useTranslation();
  const c = t.contact;
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [state, setState] = useState<FormState>('idle');
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ reference: string; acknowledged: boolean } | null>(null);

  const whatsappHref = platformWhatsAppUrl(c.whatsappGreeting);
  const messageLength = form.message.trim().length;

  function validate(): Partial<FormData> {
    const newErrors: Partial<FormData> = {};
    if (!form.category) newErrors.category = c.errCategory;
    if (!form.name.trim()) newErrors.name = c.errName;
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = c.errEmail;
    }
    if (messageLength < MESSAGE_MIN_LENGTH) newErrors.message = c.errMessage;
    setErrors(newErrors);
    return newErrors;
  }

  /** Focus sur le premier champ en erreur (clavier, lecteurs d'écran, téléphone) */
  function focusFirstError(fieldErrors: Partial<FormData>) {
    const first = FIELD_ORDER.find((field) => fieldErrors[field]);
    if (!first) return;
    const id = first === 'category' ? `contact-category-${CONTACT_CATEGORIES[0]}` : `contact-${first}`;
    document.getElementById(id)?.focus();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      focusFirstError(fieldErrors);
      return;
    }

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

  function resetForm() {
    setState('idle');
    setReceipt(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="min-h-screen bg-canvas pb-16 text-ink">
      {/* ── Héro : même modèle que la FAQ et les agences (photo, voile graphite, grille, halo rouge) ── */}
      <section aria-labelledby="contact-title" className="relative overflow-hidden bg-ink text-white">
        {/* Photo en fond (décorative), voile graphite pour garder le texte blanc lisible (contraste AA) */}
        <Image
          src={contactHeroImage}
          alt=""
          fill
          priority
          // Flou de chargement fourni par l'import statique de Next ; absent quand l'import n'est qu'une chaîne (tests)
          placeholder={typeof contactHeroImage === 'object' ? 'blur' : 'empty'}
          sizes="100vw"
          quality={70}
          className="object-cover object-[62%_68%]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-r from-ink/95 via-ink/80 to-ink/45 rtl:bg-linear-to-l"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink/85 via-transparent to-ink/45"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative mx-auto max-w-[1180px] px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:px-8">
          <nav aria-label={c.breadcrumbAria} className="mb-6 flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Link href="/" className="inline-flex min-h-6 items-center rounded-sm transition-colors hover:text-white">
              {c.home}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            <span className="text-white" aria-current="page">
              {c.crumb}
            </span>
          </nav>
          <h1
            id="contact-title"
            className="max-w-3xl text-balance text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-[56px]"
          >
            {c.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            {c.introBefore} <strong className="font-semibold text-white">{c.introStrong}</strong> {c.introAfter}
          </p>

          {/* Moyens directs : WhatsApp (vert WhatsApp, comme dans le pied de page) et e-mail */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-whatsapp px-6 text-sm font-bold text-ink shadow-sm transition-colors hover:bg-whatsapp-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[15px]"
            >
              <MessageCircle className="h-4.5 w-4.5" aria-hidden="true" />
              {c.noEmailLink}
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex h-12 max-w-full items-center gap-2.5 rounded-xl border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[15px]"
            >
              <Mail className="h-4.5 w-4.5 shrink-0 text-slate-300" aria-hidden="true" />
              <span className="truncate">{CONTACT_EMAIL}</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Formulaire + coordonnées : cartes qui chevauchent le héro, comme la recherche de la FAQ ── */}
      <div className="relative z-10 mx-auto -mt-12 max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <section aria-labelledby="contact-form-title" className="rounded-2xl bg-white p-5 shadow-[0_18px_50px_-20px_rgba(11,18,32,0.35)] ring-1 ring-slate-200/70 sm:p-8">
            {state === 'success' ? (
              <div className="flex flex-col items-center py-10 text-center" role="status">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
                  <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
                </div>
                <h2 id="contact-form-title" className="text-xl font-bold text-ink">
                  {c.successTitle}
                </h2>
                {receipt && (
                  <p className="mt-2 text-sm text-ink-tertiary">
                    {c.reference} <strong className="font-mono text-ink">{receipt.reference}</strong>
                  </p>
                )}
                <p className="mt-2 max-w-sm text-sm text-ink-secondary">
                  {c.successText}
                  {receipt?.acknowledged ? c.ackSent : ''}
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {c.sendAnother}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <div>
                  <h2 id="contact-form-title" className="text-lg font-bold text-ink">
                    {c.formTitle}
                  </h2>
                  <p className="mt-1 text-sm text-ink-secondary">{c.formHint}</p>
                  {/* L'e-mail est requis pour répondre au formulaire ; sans adresse, WhatsApp */}
                  <p className="mt-1 text-sm text-ink-secondary">
                    {c.noEmail}{' '}
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm font-semibold text-accent-text underline underline-offset-2 hover:text-action-hover"
                    >
                      {c.noEmailLink}
                    </a>
                  </p>
                </div>

                {/* Catégorie : cartes à choisir (boutons radio natifs), conseil adapté au choix */}
                <fieldset aria-describedby={errors.category ? 'contact-category-error' : form.category ? 'contact-category-hint' : undefined}>
                  <legend className="mb-2.5 text-[13px] font-semibold text-ink">{c.category}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CONTACT_CATEGORIES.map((value) => {
                      const Icon = CATEGORY_ICONS[value];
                      const selected = form.category === value;
                      return (
                        <label
                          key={value}
                          htmlFor={`contact-category-${value}`}
                          className={cn(
                            'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors duration-fast sm:min-h-14 sm:px-3.5 sm:py-2.5',
                            'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                            selected
                              ? 'border-ink bg-neutral-soft ring-1 ring-ink'
                              : errors.category
                                ? 'border-danger-line bg-white hover:bg-canvas'
                                : 'border-line bg-white hover:border-line-strong hover:bg-canvas'
                          )}
                        >
                          <input
                            id={`contact-category-${value}`}
                            type="radio"
                            name="category"
                            value={value}
                            checked={selected}
                            onChange={update('category')}
                            className="sr-only"
                          />
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-fast sm:h-9 sm:w-9',
                              selected ? 'bg-ink text-white' : 'bg-canvas text-ink-tertiary'
                            )}
                            aria-hidden="true"
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="font-medium leading-snug text-ink">{c.categories[value]}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.category ? (
                    <FieldError id="contact-category-error">{errors.category}</FieldError>
                  ) : (
                    form.category && (
                      <p
                        id="contact-category-hint"
                        aria-live="polite"
                        className="mt-2.5 flex items-start gap-2 rounded-lg bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink-tertiary"
                      >
                        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-text" aria-hidden="true" />
                        {c.categoryHints[form.category]}
                      </p>
                    )
                  )}
                </fieldset>

                {/* Nom + e-mail */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={c.name} htmlFor="contact-name" error={errors.name}>
                    <input
                      id="contact-name"
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? 'contact-name-error' : undefined}
                      type="text"
                      required
                      autoComplete="name"
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
                      aria-describedby={errors.email ? 'contact-email-error' : undefined}
                      type="email"
                      required
                      autoComplete="email"
                      placeholder={c.emailPlaceholder}
                      value={form.email}
                      onChange={update('email')}
                      className={inputClass(!!errors.email)}
                    />
                  </Field>
                </div>

                {/* Téléphone + objet */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={c.phone} htmlFor="contact-phone">
                    <input
                      id="contact-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      dir="ltr"
                      placeholder="+212 6XX XXX XXX"
                      value={form.phone}
                      onChange={update('phone')}
                      className={cn(inputClass(false), 'rtl:text-end')}
                    />
                  </Field>
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
                </div>

                {/* Message */}
                <Field label={c.message} htmlFor="contact-message" error={errors.message}>
                  <textarea
                    id="contact-message"
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? 'contact-message-error contact-message-count' : 'contact-message-count'}
                    required
                    rows={5}
                    placeholder={c.messagePlaceholder}
                    value={form.message}
                    onChange={update('message')}
                    className={cn(inputClass(!!errors.message), 'resize-y')}
                  />
                  {/* Compteur : minimum rappelé tant qu'il n'est pas atteint */}
                  <p
                    id="contact-message-count"
                    className={cn(
                      'mt-1.5 text-end text-xs tabular-nums',
                      messageLength >= MESSAGE_MIN_LENGTH ? 'text-success' : 'text-ink-secondary'
                    )}
                  >
                    {messageLength >= MESSAGE_MIN_LENGTH
                      ? fmt(c.characters, { count: form.message.length })
                      : fmt(c.messageMin, { count: messageLength, min: MESSAGE_MIN_LENGTH })}
                  </p>
                </Field>

                {/* Champ piège pour les robots : masqué (sans décalage hors écran, qui créait un défilement horizontal en arabe),
                    ignoré au clavier et par les lecteurs d'écran */}
                <div aria-hidden="true" className="sr-only">
                  <label htmlFor="contact-website">{c.honeypot}</label>
                  <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
                </div>

                {/* Erreur d'envoi : message réel et repli WhatsApp */}
                {state === 'error' && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                      {serverError ?? c.errGeneric}{' '}
                      <a href={platformWhatsAppUrl(c.whatsappFallback)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                        {c.writeWhatsapp}
                      </a>
                    </p>
                  </div>
                )}

                <button
                  id="contact-submit"
                  type="submit"
                  disabled={state === 'sending'}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-action px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56"
                >
                  {state === 'sending' ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                      {c.sending}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                      {c.send}
                    </>
                  )}
                </button>
              </form>
            )}
          </section>

          {/* ── Coordonnées (colonne unique, fixe au défilement en desktop) ── */}
          <aside className="space-y-4 lg:sticky lg:top-28">
            <section aria-labelledby="contact-info-title" className="rounded-2xl bg-white p-5 shadow-[0_18px_50px_-20px_rgba(11,18,32,0.35)] ring-1 ring-slate-200/70 sm:p-6">
              <h2 id="contact-info-title" className="text-base font-bold text-ink">
                {c.infoTitle}
              </h2>

              <dl className="mt-4 space-y-4">
                <InfoRow icon={MessageCircle} label={c.whatsapp}>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-ink underline-offset-2 hover:text-accent-text hover:underline"
                  >
                    {c.noEmailLink}
                  </a>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-secondary">{c.whatsappValue}</span>
                </InfoRow>
                <InfoRow icon={Mail} label={c.generalEmail}>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-medium text-ink underline-offset-2 hover:text-accent-text hover:underline">
                    {CONTACT_EMAIL}
                  </a>
                </InfoRow>
                <InfoRow icon={ShieldCheck} label={c.privacyEmail}>
                  <a href={`mailto:${PRIVACY_EMAIL}`} className="break-all font-medium text-ink underline-offset-2 hover:text-accent-text hover:underline">
                    {PRIVACY_EMAIL}
                  </a>
                </InfoRow>
                <InfoRow icon={MapPin} label={c.address}>
                  <span className="font-medium text-ink">{c.addressValue}</span>
                </InfoRow>
              </dl>

              {/* Horaires : config/site.ts, mis en forme dans la langue de la page */}
              <div className="mt-5 border-t border-line pt-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Clock3 className="h-4 w-4 text-accent-text" aria-hidden="true" />
                  {c.hoursTitle}
                </h3>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {[...supportHoursRows(locale), c.closedRow].map(({ day, hours }) => (
                    <div key={day} className="flex items-baseline justify-between gap-4">
                      <dt className="text-ink-tertiary">{day}</dt>
                      <dd className="font-semibold tabular-nums text-ink">{hours}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-ink-secondary">{c.usualDelay}</p>
              </div>
            </section>

            {/* Liens utiles : agences et FAQ, dans un même bloc compact */}
            <nav aria-label={c.infoTitle} className="divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
              <HelpLink href="/agency/join" icon={Building2} title={c.agencyTitle} text={c.agencyText} cta={c.becomePartner} />
              <HelpLink href="/faq" icon={HelpCircle} title={c.faqTitle} text={c.faqText} cta={c.faqLink} />
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ── Éléments ───────────────────────────────────────────────────────────── */

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-secondary transition-colors duration-fast focus:bg-white focus:outline-none focus:ring-1',
    hasError
      ? 'border-danger bg-danger-soft focus:border-danger focus:ring-danger'
      : 'border-line bg-canvas hover:border-line-strong focus:border-ink focus:ring-ink'
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1 text-[13px] text-danger">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
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
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {error && <FieldError id={`${htmlFor}-error`}>{error}</FieldError>}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  // Groupe <div> de la liste : seulement <dt> et <dd> comme enfants (structure valide), icône dans le <dt>
  return (
    <div className="relative min-h-9 ps-12 text-sm">
      <dt className="text-xs font-medium text-ink-secondary">
        <span className="absolute start-0 top-0 flex h-9 w-9 items-center justify-center rounded-lg bg-canvas" aria-hidden="true">
          <Icon className="h-4 w-4 text-ink-tertiary" />
        </span>
        {label}
      </dt>
      <dd className="mt-0.5 min-w-0">{children}</dd>
    </div>
  );
}

function HelpLink({
  href,
  icon: Icon,
  title,
  text,
  cta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  text: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 p-5 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-tertiary group-hover:bg-white" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-secondary">{text}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-text">
          {cta}
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
