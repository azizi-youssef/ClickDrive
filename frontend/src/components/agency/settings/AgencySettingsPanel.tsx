'use client';

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BadgePercent,
  Building2,
  Car,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  ImageIcon,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Motorbike,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { button, heading, input } from '@/lib/design/tokens';
import { AccountProfileSettings } from '@/components/shared/AccountProfileSettings';
import { AgencyLogoUploader } from '@/components/agency/settings/AgencyLogoUploader';
import { CardSkeleton, ErrorBanner } from '@/components/agency/shell/Feedback';
import { AGENCY_LANGUAGES } from '@/lib/agencies/languages';
import { formatNumber } from '@/lib/i18n/format';
import {
  DURATION_DISCOUNT_RULES,
  calculateRentalPrice,
  durationDiscountsIssue,
  normalizeDurationDiscounts,
  type DurationDiscount,
} from '@/lib/utils/pricing';

/** Champs modifiables (le logo et la bannière sont enregistrés dès leur envoi). */
type EditableFields = {
  name: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  address: string;
  opening_hours: string;
  /** Codes de langue séparés par des virgules (« ar,fr,es ») */
  languages: string;
  cancellation_policy: string;
  /** Montants en DH saisis en texte ; vide = non proposé */
  delivery_fee_airport: string;
  delivery_fee_port: string;
  /** Paliers de remise longue durée des voitures, en JSON de lignes saisies (TierRow[]) */
  duration_discounts: string;
  /** Paliers de remise longue durée des motos (liste indépendante de celle des voitures) */
  motorcycle_duration_discounts: string;
};
type FieldErrors = Partial<Record<keyof EditableFields, string>>;

const EMPTY: EditableFields = {
  name: '',
  description: '',
  phone: '',
  whatsapp: '',
  email: '',
  city: '',
  address: '',
  opening_hours: '',
  languages: '',
  cancellation_policy: '',
  delivery_fee_airport: '',
  delivery_fee_port: '',
  duration_discounts: '[]',
  motorcycle_duration_discounts: '[]',
};

const FEE_KEYS = ['delivery_fee_airport', 'delivery_fee_port'] as const;

function feeError(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const amount = Number(value.replace(',', '.'));
  return Number.isFinite(amount) && amount >= 0 && amount <= 5000 ? undefined : 'Montant entre 0 et 5 000 DH.';
}

/* ── Remises longue durée : lignes saisies (texte) ↔ paliers (nombres) ── */
type TierRow = { days: string; percent: string };

function parseTierRows(value: string): TierRow[] {
  try {
    const rows: unknown = JSON.parse(value || '[]');
    return Array.isArray(rows) ? (rows as TierRow[]) : [];
  } catch {
    return [];
  }
}

function tierRowsToDiscounts(rows: TierRow[]): DurationDiscount[] {
  return rows
    .map((row) => ({ min_days: Number(row.days.trim()), percent: Number(row.percent.trim().replace(',', '.')) }))
    .sort((a, b) => a.min_days - b.min_days);
}

function discountsToTierRows(value: unknown): string {
  return JSON.stringify(normalizeDurationDiscounts(value).map((tier) => ({ days: String(tier.min_days), percent: String(tier.percent) })));
}

function tiersError(value: string): string | undefined {
  const rows = parseTierRows(value);
  if (rows.some((row) => !row.days.trim() || !row.percent.trim())) return 'Complétez ou retirez chaque palier.';
  return durationDiscountsIssue(tierRowsToDiscounts(rows)) ?? undefined;
}

/** Durées proposées à l'ajout d'un palier (la remise reste à saisir par l'agence) */
const SUGGESTED_TIER_DAYS = ['3', '7', '15', '30'];

/** Les deux listes de paliers : une pour les voitures, une pour les motos (prix d'exemple de l'aperçu, sans véhicule réel) */
const DISCOUNT_LISTS = [
  { key: 'duration_discounts', title: 'Voitures', noun: 'une voiture', icon: Car, vehicleType: 'CAR', exampleDailyPrice: 300 },
  { key: 'motorcycle_duration_discounts', title: 'Motos', noun: 'une moto', icon: Motorbike, vehicleType: 'MOTORCYCLE', exampleDailyPrice: 150 },
] as const;

/** Valeur envoyée à l'API : langues en liste, frais en nombre (null = non proposé), texte nettoyé */
function payloadValue(key: keyof EditableFields, value: string): unknown {
  if (key === 'languages') return value ? value.split(',').filter(Boolean) : [];
  if (key === 'duration_discounts' || key === 'motorcycle_duration_discounts') return tierRowsToDiscounts(parseTierRows(value));
  if ((FEE_KEYS as readonly string[]).includes(key)) return value.trim() ? Number(value.replace(',', '.')) : null;
  return value.trim();
}
const DESCRIPTION_MAX = 1000;

/** Mêmes règles que l'API (settingsUpdateSchema) */
function validate(form: EditableFields): FieldErrors {
  const errors: FieldErrors = {};
  if (form.name.trim().length < 2) errors.name = 'Le nom commercial doit contenir au moins 2 caractères.';
  if (form.phone.replace(/\D/g, '').length < 8) errors.phone = 'Saisissez un numéro valide (8 chiffres minimum).';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Adresse e-mail invalide.';
  if (form.description.length > DESCRIPTION_MAX) errors.description = `${DESCRIPTION_MAX} caractères maximum.`;
  if (form.opening_hours.length > 300) errors.opening_hours = '300 caractères maximum.';
  if (form.cancellation_policy.length > 600) errors.cancellation_policy = '600 caractères maximum.';
  for (const key of FEE_KEYS) {
    const message = feeError(form[key]);
    if (message) errors[key] = message;
  }
  for (const { key } of DISCOUNT_LISTS) {
    const tiersMessage = tiersError(form[key]);
    if (tiersMessage) errors[key] = tiersMessage;
  }
  return errors;
}

/**
 * Paliers de remise d'un type de véhicule (voitures ou motos) : lignes « à partir de N jours → X % »,
 * erreur, ajout d'un palier et aperçu sur un prix d'exemple. Les deux listes sont indépendantes.
 */
function DiscountTiersEditor({
  id,
  list,
  rows,
  error,
  locked,
  onChange,
}: {
  id: string;
  list: (typeof DISCOUNT_LISTS)[number];
  rows: TierRow[];
  error?: string;
  locked: boolean;
  onChange: (rows: TierRow[]) => void;
}) {
  const Icon = list.icon;
  const addRow = () => {
    const used = new Set(rows.map((row) => row.days.trim()));
    onChange([...rows, { days: SUGGESTED_TIER_DAYS.find((days) => !used.has(days)) ?? '', percent: '' }]);
  };
  const previewTiers = tiersError(JSON.stringify(rows)) ? [] : tierRowsToDiscounts(rows);

  return (
    <div
      id={id}
      tabIndex={-1}
      role="group"
      aria-labelledby={`${id}-title`}
      aria-describedby={error ? `${id}-error` : undefined}
      className="space-y-3 border-t border-slate-100 pt-4 outline-none first:border-t-0 first:pt-0"
    >
      <h3 id={`${id}-title`} className={cn('flex items-center gap-2', heading.sub)}>
        <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
        {list.title}
      </h3>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600">
            Aucune remise sur les {list.title.toLowerCase()} pour l’instant : vos clients paient le prix par jour, ou le tarif semaine / mois prévu sur le véhicule.
          </p>
        ) : (
          rows.map((row, index) => {
            const invalid = Boolean(error);
            const updateRow = (patch: Partial<TierRow>) =>
              onChange(rows.map((current, i) => (i === index ? { ...current, ...patch } : current)));
            return (
              <div
                key={index}
                className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-slate-200 bg-[#F5F6F8]/70 px-3 py-2.5 text-sm text-[#0B1220]"
              >
                <span className="font-semibold">À partir de</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={row.days}
                  disabled={locked}
                  aria-label={`${list.title}, palier ${index + 1} : durée minimale en jours`}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => updateRow({ days: e.target.value.replace(/\D/g, '') })}
                  className={cn(input, 'w-16 text-center font-semibold disabled:bg-white aria-[invalid=true]:border-[#E63946]')}
                />
                <span>jours</span>
                <span aria-hidden="true" className="text-slate-400">→</span>
                <span className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={row.percent}
                    placeholder="10"
                    disabled={locked}
                    aria-label={`${list.title}, palier ${index + 1} : remise en pourcentage`}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => updateRow({ percent: e.target.value.replace(/\D/g, '') })}
                    className={cn(input, 'w-20 pe-7 text-center font-semibold disabled:bg-white aria-[invalid=true]:border-[#E63946]')}
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 flex items-center font-semibold text-slate-500">
                    %
                  </span>
                </span>
                <span>de remise</span>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    aria-label={`${list.title} : retirer le palier ${index + 1}`}
                    className="ms-auto flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white hover:text-[#B4232F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs font-semibold text-[#B4232F]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!locked && rows.length < DURATION_DISCOUNT_RULES.maxTiers && (
        <button type="button" onClick={addRow} className={button.secondary}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajouter un palier ({list.title.toLowerCase()})
        </button>
      )}

      {previewTiers.length > 0 && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          <p className="font-bold">
            Exemple pour {list.noun} à {list.exampleDailyPrice} DH par jour
          </p>
          <ul className="mt-1.5 space-y-1">
            {previewTiers.map((tier) => {
              const price = calculateRentalPrice(
                { daily_price: list.exampleDailyPrice, vehicle_type: list.vehicleType, agency: { [list.key]: previewTiers } },
                tier.min_days
              );
              return (
                <li key={tier.min_days} className="tabular-nums">
                  {tier.min_days} jours : <s>{formatNumber(price.full_price, 'fr')} DH</s>{' '}
                  <strong>{formatNumber(price.total, 'fr')} DH</strong> (−{tier.percent} %)
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5">
            Remise de {DURATION_DISCOUNT_RULES.minPercent} à {DURATION_DISCOUNT_RULES.maxPercent} %, dès{' '}
            {DURATION_DISCOUNT_RULES.minDays} jours · {DURATION_DISCOUNT_RULES.maxTiers} paliers au maximum.
          </p>
        </div>
      )}
    </div>
  );
}

function Card({ icon: Icon, title, description, children }: { icon: typeof Building2; title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(11,18,32,0.04)]">
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F6F8] text-[#0B1220]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className={heading.block}>{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </header>
      <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-[13px] font-bold text-[#0B1220]">
        {label}
        {required && <span className="text-accent-text" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1 text-xs font-semibold text-[#B4232F]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function AgencySettingsPanel({ agencyId, canManage }: { agencyId: string; canManage: boolean }) {
  const uid = useId();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [initial, setInitial] = useState<EditableFields>(EMPTY);
  const [form, setForm] = useState<EditableFields>(EMPTY);
  const [branding, setBranding] = useState({ logo_url: '', banner_url: '', slug: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/agencies/${agencyId}/settings`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Impossible de charger les paramètres.');
      const data = json.data;
      const next: EditableFields = {
        name: data.name || '',
        description: data.description || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        city: data.city || '',
        address: data.address || '',
        opening_hours: data.opening_hours || '',
        languages: Array.isArray(data.languages) ? data.languages.join(',') : '',
        cancellation_policy: data.cancellation_policy || '',
        delivery_fee_airport: data.delivery_fee_airport == null ? '' : String(Number(data.delivery_fee_airport)),
        delivery_fee_port: data.delivery_fee_port == null ? '' : String(Number(data.delivery_fee_port)),
        duration_discounts: discountsToTierRows(data.duration_discounts),
        // Colonne absente (base pas encore migrée) : les motos suivent les paliers des voitures, comme avant
        motorcycle_duration_discounts: discountsToTierRows(data.motorcycle_duration_discounts ?? data.duration_discounts),
      };
      setInitial(next);
      setForm(next);
      setBranding({ logo_url: data.logo_url || '', banner_url: data.banner_url || '', slug: data.slug || '' });
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Impossible de charger les paramètres.');
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changedKeys = useMemo(
    () => (Object.keys(form) as (keyof EditableFields)[]).filter((key) => form[key] !== initial[key]),
    [form, initial]
  );
  const dirty = changedKeys.length > 0;

  // Avertit avant de quitter la page avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const update = (key: keyof EditableFields, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
    setSavedAt(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage || !dirty || saving) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`${uid}-${firstInvalid}`)?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Seuls les champs modifiés sont envoyés
      const payload = Object.fromEntries(changedKeys.map((key) => [key, payloadValue(key, form[key])]));
      const res = await fetch(`/api/agencies/${agencyId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur lors de la sauvegarde.');
      const saved = { ...form, ...Object.fromEntries(changedKeys.map((key) => [key, form[key].trim()])) } as EditableFields;
      setInitial(saved);
      setForm(saved);
      setSavedAt(Date.now());
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (key: keyof EditableFields) => ({
    id: `${uid}-${key}`,
    value: form[key],
    disabled: !canManage || saving,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${uid}-${key}-error` : undefined,
    className: cn(input, 'disabled:bg-[#F5F6F8] aria-[invalid=true]:border-[#E63946] aria-[invalid=true]:bg-[#FFF6F7]'),
  });

  if (loading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]" role="status" aria-label="Chargement des paramètres">
        <div className="space-y-6">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={3} />
        </div>
        <CardSkeleton rows={5} tall />
      </div>
    );
  }

  // Sans données chargées, aucun formulaire : évite d'écraser l'agence avec des champs vides
  if (loadError) {
    return <ErrorBanner message={loadError} onRetry={() => void load()} />;
  }

  const whatsappDigits = form.whatsapp.replace(/\D/g, '');

  const tiersLocked = !canManage || saving;

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-slate-500">
        Ces informations sont affichées aux clients sur votre page agence et dans les bons de réservation.
      </p>

      {!canManage && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          Consultation seule : votre rôle ne permet pas de modifier les informations de l’agence. Contactez le
          responsable de l’agence pour toute modification.
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form id={`${uid}-form`} noValidate onSubmit={handleSubmit} className="space-y-6">
          <Card icon={Building2} title="Identité de l’agence" description="Nom, ville et présentation visibles sur la marketplace.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id={`${uid}-name`} label="Nom commercial" required error={errors.name}>
                <input type="text" autoComplete="organization" maxLength={120} onChange={(e) => update('name', e.target.value)} {...fieldProps('name')} />
              </Field>
              <Field id={`${uid}-city`} label="Ville principale" error={errors.city}>
                <input type="text" autoComplete="address-level2" maxLength={80} placeholder="Nador" onChange={(e) => update('city', e.target.value)} {...fieldProps('city')} />
              </Field>
            </div>
            <Field
              id={`${uid}-description`}
              label="Présentation"
              error={errors.description}
              hint={`${form.description.length}/${DESCRIPTION_MAX} caractères — services, accueil, options incluses…`}
            >
              <textarea
                rows={5}
                maxLength={DESCRIPTION_MAX}
                placeholder="Agence familiale à Nador depuis 2015 : livraison à l’aéroport, véhicules récents, assistance 7j/7…"
                onChange={(e) => update('description', e.target.value)}
                {...fieldProps('description')}
                aria-describedby={errors.description ? `${uid}-description-error` : `${uid}-description-hint`}
                className={cn(fieldProps('description').className, 'min-h-32 leading-relaxed')}
              />
            </Field>
          </Card>

          <Card icon={Phone} title="Coordonnées" description="Utilisées par les clients et dans les bons de réservation.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id={`${uid}-phone`} label="Téléphone d’accueil" required error={errors.phone} hint="Format international conseillé : +212 6…">
                <input type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="+212 6 12 34 56 78" onChange={(e) => update('phone', e.target.value)} {...fieldProps('phone')}
                  aria-describedby={errors.phone ? `${uid}-phone-error` : `${uid}-phone-hint`} />
              </Field>
              <Field
                id={`${uid}-whatsapp`}
                label="WhatsApp professionnel"
                error={errors.whatsapp}
                hint={
                  canManage && form.phone && form.whatsapp !== form.phone ? (
                    <button type="button" onClick={() => update('whatsapp', form.phone)} className="font-bold text-accent-text hover:underline">
                      Utiliser le numéro d’accueil
                    </button>
                  ) : (
                    'Recommandé : les clients vous contactent souvent par WhatsApp.'
                  )
                }
              >
                <input type="tel" inputMode="tel" maxLength={30} placeholder="+212 6 12 34 56 78" onChange={(e) => update('whatsapp', e.target.value)} {...fieldProps('whatsapp')} />
              </Field>
              <Field id={`${uid}-email`} label="E-mail de contact" error={errors.email} className="sm:col-span-2">
                <input type="email" inputMode="email" autoComplete="email" maxLength={160} placeholder="contact@votre-agence.ma" onChange={(e) => update('email', e.target.value)} {...fieldProps('email')} />
              </Field>
              <Field id={`${uid}-address`} label="Adresse de l’agence" error={errors.address} className="sm:col-span-2">
                <input type="text" autoComplete="street-address" maxLength={240} placeholder="Bd Mohammed V, Nador" onChange={(e) => update('address', e.target.value)} {...fieldProps('address')} />
              </Field>
            </div>
          </Card>

          <Card icon={Clock3} title="Informations pratiques" description="Affichées sur votre page agence et sur vos fiches véhicules : le client sait tout avant de réserver.">
            <Field id={`${uid}-opening_hours`} label="Horaires d’ouverture" error={errors.opening_hours} hint="Ex. Lun–Sam 8h–20h, dimanche sur rendez-vous">
              <input type="text" maxLength={300} onChange={(e) => update('opening_hours', e.target.value)} {...fieldProps('opening_hours')} />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-bold text-[#0B1220]">Langues parlées à l’agence</legend>
              <div className="flex flex-wrap gap-2">
                {AGENCY_LANGUAGES.map(({ code, label }) => {
                  const selected = form.languages.split(',').filter(Boolean);
                  const checked = selected.includes(code);
                  return (
                    <label
                      key={code}
                      className={cn(
                        'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
                        checked ? 'border-[#0B1220] bg-[#0B1220] text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300',
                        (!canManage || saving) && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={!canManage || saving}
                        onChange={() =>
                          update(
                            'languages',
                            AGENCY_LANGUAGES.map((language) => language.code)
                              .filter((item) => (item === code ? !checked : selected.includes(item)))
                              .join(',')
                          )
                        }
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id={`${uid}-delivery_fee_airport`} label="Livraison à l’aéroport (DH)" error={errors.delivery_fee_airport} hint="Vide = non proposée · 0 = gratuite">
                <input type="text" inputMode="decimal" maxLength={8} onChange={(e) => update('delivery_fee_airport', e.target.value)} {...fieldProps('delivery_fee_airport')} />
              </Field>
              <Field id={`${uid}-delivery_fee_port`} label="Livraison au port de Beni Ansar (DH)" error={errors.delivery_fee_port} hint="Vide = non proposée · 0 = gratuite">
                <input type="text" inputMode="decimal" maxLength={8} onChange={(e) => update('delivery_fee_port', e.target.value)} {...fieldProps('delivery_fee_port')} />
              </Field>
            </div>
            <Field
              id={`${uid}-cancellation_policy`}
              label="Politique d’annulation"
              error={errors.cancellation_policy}
              hint={`${form.cancellation_policy.length}/600 caractères — ex. annulation gratuite jusqu’à 48 h avant la prise en charge`}
            >
              <textarea rows={3} maxLength={600} onChange={(e) => update('cancellation_policy', e.target.value)} {...fieldProps('cancellation_policy')} />
            </Field>
          </Card>

          <Card
            icon={BadgePercent}
            title="Remises longue durée"
            description="Appliquées automatiquement selon la durée de location, séparément pour vos voitures et vos motos. Le client voit la remise sur la fiche et paie le meilleur prix : tarif semaine ou mois du véhicule, ou cette remise (sans cumul)."
          >
            {DISCOUNT_LISTS.map((list) => (
              <DiscountTiersEditor
                key={list.key}
                id={`${uid}-${list.key}`}
                list={list}
                rows={parseTierRows(form[list.key])}
                error={errors[list.key]}
                locked={tiersLocked}
                onChange={(rows) => update(list.key, JSON.stringify(rows))}
              />
            ))}
          </Card>
        </form>

        {/* ── Colonne latérale : image de marque + aperçu public ── */}
        <aside className="space-y-6 xl:sticky xl:top-24">
          <Card icon={ImageIcon} title="Image de marque" description="Enregistrée dès l’envoi du fichier.">
            <AgencyLogoUploader
              agencyId={agencyId}
              agencyName={form.name}
              imageUrl={branding.logo_url}
              disabled={!canManage}
              onUploaded={(logo_url) => setBranding((current) => ({ ...current, logo_url }))}
            />
            <AgencyLogoUploader
              agencyId={agencyId}
              agencyName={form.name}
              imageUrl={branding.banner_url}
              brandingType="banner"
              disabled={!canManage}
              onUploaded={(banner_url) => setBranding((current) => ({ ...current, banner_url }))}
            />
          </Card>

          <section aria-labelledby={`${uid}-preview`} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(11,18,32,0.04)]">
            <div className="flex items-center justify-between gap-2 px-5 py-3">
              <h2 id={`${uid}-preview`} className={cn('flex items-center gap-2', heading.block)}>
                <Eye className="h-4 w-4 text-accent-text" aria-hidden="true" />
                Aperçu côté client
              </h2>
              {branding.slug && (
                <Link href={`/agencies/${branding.slug}`} target="_blank" className="inline-flex min-h-8 items-center gap-1 text-xs font-bold text-accent-text hover:underline">
                  Ma page
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="relative h-24 bg-linear-to-br from-[#0B1220] to-slate-700">
              {branding.banner_url && (
                // eslint-disable-next-line @next/next/no-img-element -- URL publique de la bannière
                <img src={branding.banner_url} alt="" className="h-full w-full object-cover" />
              )}
              <div className="absolute -bottom-7 start-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-4 border-white bg-white shadow-md">
                {branding.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL publique du logo
                  <img src={branding.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-extrabold text-slate-400">{form.name.trim().charAt(0).toUpperCase() || '?'}</span>
                )}
              </div>
            </div>
            <div className="space-y-2.5 px-5 pb-5 pt-9">
              <p className="truncate text-base font-extrabold text-[#0B1220]">{form.name.trim() || 'Nom de l’agence'}</p>
              {(form.city || form.address) && (
                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="line-clamp-2">{[form.address, form.city].filter(Boolean).join(', ')}</span>
                </p>
              )}
              <p className={cn('line-clamp-3 text-xs leading-relaxed', form.description ? 'text-slate-600' : 'italic text-slate-400')}>
                {form.description || 'Ajoutez une présentation pour rassurer les clients.'}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {form.phone && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F6F8] px-2.5 py-1 text-[11px] font-semibold text-[#0B1220]">
                    <Phone className="h-3 w-3" aria-hidden="true" />
                    {form.phone}
                  </span>
                )}
                {whatsappDigits.length >= 8 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <MessageCircle className="h-3 w-3" aria-hidden="true" />
                    WhatsApp
                  </span>
                )}
                {form.email && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F6F8] px-2.5 py-1 text-[11px] font-semibold text-[#0B1220]">
                    <Mail className="h-3 w-3" aria-hidden="true" />
                    E-mail
                  </span>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* ── Mon compte (profil personnel, distinct de l'agence) ── */}
      <section aria-labelledby={`${uid}-account`} className="space-y-4 border-t border-slate-200 pt-8">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-white">
            <UserRound className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 id={`${uid}-account`} className={heading.block}>Mon compte</h2>
            <p className="text-sm text-slate-500">Votre profil personnel, indépendant des informations de l’agence.</p>
          </div>
        </div>
        <AccountProfileSettings />
      </section>

      {/* ── Barre d'enregistrement (visible dès qu'il y a des modifications) ── */}
      {canManage && (dirty || saving || saveError || savedAt) && (
        <div
          // Au-dessus de la navigation mobile (6rem) et du bandeau cookies tant qu'il est affiché
          className="sticky bottom-[calc(6rem+var(--cd-cookie-banner,0px))] z-30 lg:bottom-[calc(1.5rem+var(--cd-cookie-banner,0px))]"
          role={saveError ? 'alert' : 'status'}
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_20px_50px_-20px_rgba(11,18,32,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:ps-5">
            <p className={cn('flex items-center gap-2 text-sm font-semibold', saveError ? 'text-[#B4232F]' : dirty ? 'text-[#0B1220]' : 'text-emerald-700')}>
              {saveError ? (
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : dirty ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {saveError
                ? saveError
                : dirty
                  ? `${changedKeys.length} modification${changedKeys.length > 1 ? 's' : ''} non enregistrée${changedKeys.length > 1 ? 's' : ''}`
                  : 'Modifications enregistrées'}
            </p>
            {dirty && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setForm(initial);
                    setErrors({});
                    setSaveError(null);
                  }}
                  className={cn(button.secondary, 'flex-1 sm:flex-none')}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Annuler
                </button>
                <button type="submit" form={`${uid}-form`} disabled={saving} className={cn(button.primary, 'flex-1 sm:flex-none')}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
