'use client';

import { track } from '@/lib/analytics/track';
import React, { useEffect, useId, useState, useSyncExternalStore, useTransition } from 'react';
import { useLocalizedRouter } from '@/lib/i18n/useLocalizedRouter';
import { categoryLabel, locationLabel } from '@/lib/i18n/labels';
import { MapPin, Calendar, Car, ChevronDown, Loader2, Search, type LucideIcon } from 'lucide-react';
import { LOCATIONS_NADOR, CATEGORIES } from '@/lib/constants/catalog';
import { DEFAULT_PICKUP_LOCATION, findPickupLocation } from '@/data/locations';
import {
  addDateDays,
  formatLocalDate,
  getEffectiveRentalDates,
  isValidDateOnly,
  parseRentalPeriod,
  rentalDayCount,
  type RentalPeriod,
} from '@/lib/utils/date-only';
import { SearchSummaryChips } from './SearchSummaryChips';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  initialLocation?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialCategory?: string;
  initialBrand?: string;
  isCompact?: boolean;
  /** Catégories réellement présentes dans le catalogue (sinon : liste par défaut) */
  categories?: string[];
  /** Catalogue visé par la recherche : /search (voitures) ou /motos */
  basePath?: string;
  /** Dates affichées par la barre (valeurs effectives) : la page s'en sert comme unique source de dates */
  onPeriodChange?: (period: RentalPeriod) => void;
}

// Valeurs techniques (jamais affichées telles quelles) : « tous types / toutes marques »
const ALL_CATEGORIES_LABEL = 'Tous les types';
const ALL_BRANDS_LABEL = 'Toutes les marques';

function subscribeToLocalDateChange(onChange: () => void): () => void {
  const interval = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(interval);
}

function getLocalToday(): string {
  return formatLocalDate(new Date());
}

function getServerToday(): string {
  return '';
}

/**
 * Carte de l'accueil sous 1024 px : champ invisible piloté à la souris (fenêtre étroite sur ordinateur).
 * Le clic ouvre directement le calendrier natif ; au doigt, le navigateur l'ouvre déjà de lui-même.
 */
function openDatePicker(event: React.MouseEvent<HTMLInputElement>) {
  if (!window.matchMedia('(width < 64rem) and (pointer: fine)').matches) return;
  const input = event.currentTarget;
  if (typeof input.showPicker !== 'function') return;
  try {
    input.showPicker();
  } catch {
    /* calendrier indisponible (navigateur ancien, champ désactivé) : saisie native au clavier */
  }
}

/** Champ du formulaire compact (catalogue) : pastille grise, libellé au-dessus du contrôle natif. */
function CompactField({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col justify-center rounded-xl border border-transparent bg-canvas px-3.5 py-2.5 transition-colors hover:bg-[#EEF0F3] focus-within:border-ink focus-within:bg-white focus-within:ring-4 focus-within:ring-ink/8">
      <label
        htmlFor={id}
        className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-ink-tertiary"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-accent-text" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </label>
      {children}
    </div>
  );
}

/**
 * Champ de la recherche d'accueil.
 * - Sous 1024 px : une ligne de la carte unique (icône, libellé, valeur lisible sur deux lignes au plus,
 *   flèche). Le contrôle natif, transparent, couvre toute la ligne : toucher n'importe où ouvre le
 *   sélecteur ou le calendrier du téléphone, et les lecteurs d'écran lisent le libellé et la valeur
 *   du contrôle lui-même (la valeur affichée leur est masquée).
 * - À partir de 1024 px : pastille grise de la barre horizontale, à l'identique de l'existant.
 */
function HeroField({
  id,
  label,
  shortLabel,
  icon: Icon,
  value,
  chevron = false,
  children,
}: {
  id: string;
  label: string;
  /** Libellé des colonnes étroites (dates) : jamais tronqué */
  shortLabel?: string;
  icon: LucideIcon;
  /** Valeur affichée sous 1024 px */
  value: React.ReactNode;
  /** Flèche des listes déroulantes */
  chevron?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex h-full min-w-0',
        'max-lg:items-center max-lg:gap-2.5 max-lg:px-4 max-lg:py-3 max-lg:transition-colors max-lg:duration-fast',
        'max-lg:hover:bg-canvas max-lg:focus-within:bg-canvas',
        'max-lg:has-[:focus-visible]:ring-2 max-lg:has-[:focus-visible]:ring-inset max-lg:has-[:focus-visible]:ring-focus',
        'lg:flex-col lg:justify-center lg:rounded-xl lg:border lg:border-transparent lg:bg-canvas lg:px-3.5 lg:py-2.5 lg:transition-colors lg:hover:bg-[#EEF0F3] lg:focus-within:border-ink lg:focus-within:bg-white lg:focus-within:ring-4 lg:focus-within:ring-ink/8'
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-accent-text lg:hidden" aria-hidden="true" />
      <div className="@container min-w-0 flex-1 lg:flex-none">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-xs font-semibold leading-4 text-ink-tertiary lg:mb-0.5"
        >
          <Icon className="hidden h-3.5 w-3.5 shrink-0 text-accent-text lg:block" aria-hidden="true" />
          {shortLabel ? (
            <>
              <span className="lg:hidden">{shortLabel}</span>
              <span className="hidden truncate lg:block">{label}</span>
            </>
          ) : (
            <span className="lg:truncate">{label}</span>
          )}
        </label>
        <span
          aria-hidden="true"
          className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-5 text-ink [overflow-wrap:anywhere] lg:hidden"
        >
          {value}
        </span>
        {children}
      </div>
      {chevron && <ChevronDown className="h-4 w-4 shrink-0 text-ink-secondary lg:hidden" aria-hidden="true" />}
    </div>
  );
}

// text-base on mobile prevents iOS Safari from automatically zooming in when focusing selects/inputs
const controlClass =
  'min-h-8 w-full min-w-0 cursor-pointer truncate bg-transparent text-base sm:text-sm font-bold text-ink focus:outline-none';

// Accueil sous 1024 px : contrôle natif transparent étendu à toute la ligne (voir HeroField)
const heroControlClass = cn(
  controlClass,
  'max-lg:absolute max-lg:inset-0 max-lg:h-full max-lg:min-h-0 max-lg:appearance-none max-lg:opacity-0 disabled:cursor-default'
);

export function SearchBar({
  initialLocation = DEFAULT_PICKUP_LOCATION.value,
  initialStartDate = '',
  initialEndDate = '',
  initialCategory = ALL_CATEGORIES_LABEL,
  initialBrand = ALL_BRANDS_LABEL,
  isCompact = false,
  categories,
  basePath = '/search',
  onPeriodChange,
}: SearchBarProps) {
  const router = useLocalizedRouter();
  const uid = useId();
  const { t, date, plural } = useTranslation();
  // Navigation vers les résultats en cours : bouton en attente, pas de double envoi
  const [isPending, startTransition] = useTransition();
  const hero = !isCompact;
  // Accueil sous 1024 px : carte repliée en « rideau » (résumé), déroulée à la demande
  const [expanded, setExpanded] = useState(false);
  const fieldsId = `${uid}-fields`;

  const today = useSyncExternalStore(
    subscribeToLocalDateChange,
    getLocalToday,
    getServerToday
  );
  // Lieu reçu sous n'importe quelle orthographe connue (libellé, alias, ancienne valeur d'adresse)
  const [location, setLocation] = useState(
    findPickupLocation(initialLocation)?.value ?? DEFAULT_PICKUP_LOCATION.value
  );
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [dateError, setDateError] = useState('');
  const [category, setCategory] = useState(
    initialCategory && initialCategory !== 'ALL' ? initialCategory : ALL_CATEGORIES_LABEL
  );
  // Marque transmise telle quelle (aucun champ dédié dans le formulaire)
  const brand = initialBrand && initialBrand !== 'ALL' ? initialBrand : ALL_BRANDS_LABEL;

  const { startDate: effectiveStartDate, endDate: effectiveEndDate } =
    getEffectiveRentalDates(startDate, endDate, today);
  // Nombre de jours de la période (retour exclu), affiché sous les dates et dans le résumé
  const dayCount = rentalDayCount(effectiveStartDate, effectiveEndDate);
  const durationText = dayCount > 0 ? plural(dayCount, t.vehicle.days) : '';
  const durationId = `${uid}-duration`;

  // Accueil : les cartes véhicules reprennent les dates affichées ici (total estimé, lien vers la fiche)
  useEffect(() => {
    const period = parseRentalPeriod(effectiveStartDate, effectiveEndDate);
    if (period) onPeriodChange?.(period);
  }, [effectiveStartDate, effectiveEndDate, onPeriodChange]);

  const handleStartChange = (value: string) => {
    setStartDate(value);
    setDateError('');
    if (isValidDateOnly(value)) {
      if (!isValidDateOnly(effectiveEndDate) || effectiveEndDate <= value) {
        setEndDate(addDateDays(value, 3));
      }
    }
  };

  const handleEndChange = (value: string) => {
    setEndDate(value);
    setDateError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    const localToday = today || formatLocalDate(new Date());

    if (
      !isValidDateOnly(effectiveStartDate) ||
      effectiveStartDate < localToday ||
      !isValidDateOnly(effectiveEndDate) ||
      effectiveEndDate <= effectiveStartDate
    ) {
      setDateError(t.searchBar.dateError);
      setExpanded(true); // rideau déroulé : les dates à corriger sont visibles
      return;
    }

    const params = new URLSearchParams();
    if (location) params.set('location', location);
    if (effectiveStartDate) params.set('startDate', effectiveStartDate);
    if (effectiveEndDate) params.set('endDate', effectiveEndDate);
    if (category && category !== ALL_CATEGORIES_LABEL) params.set('category', category);
    if (brand && brand !== ALL_BRANDS_LABEL && brand !== 'ALL') params.set('brand', brand);
    track('Recherche', { dates: Boolean(effectiveStartDate && effectiveEndDate), lieu: location || 'non précisé' });
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  };

  const categoryOptions =
    categories && categories.length > 0
      ? [ALL_CATEGORIES_LABEL, ...categories, ...(category !== ALL_CATEGORIES_LABEL && !categories.includes(category) ? [category] : [])]
      : CATEGORIES;
  const categoryText = (value: string) => (value === ALL_CATEGORIES_LABEL ? t.searchBar.allTypes : categoryLabel(t, value));

  // Date affichée sous 1024 px : « lun. 23 nov. » quand la colonne le permet, sinon « 23 nov. ».
  // Seuil 108 px : la forme longue la plus large (« Mo., 28. Sept. », 15 px gras) en mesure 105.
  // Sans date (rendu serveur, avant l'heure locale du visiteur) : texte indicatif explicite, jamais « — ».
  const dateText = (value: string, placeholder: string) =>
    isValidDateOnly(value) ? (
      <>
        <span className="hidden whitespace-nowrap @[6.75rem]:inline">{date(value, 'weekdayDayMonth')}</span>
        <span className="whitespace-nowrap @[6.75rem]:hidden">{date(value, 'dayMonth')}</span>
      </>
    ) : (
      <span className="font-semibold text-ink-secondary">{placeholder}</span>
    );

  const locationSelect = (
    <select
      id={`${uid}-location`}
      value={location}
      onChange={(e) => setLocation(e.target.value)}
      className={hero ? heroControlClass : controlClass}
    >
      {LOCATIONS_NADOR.map((loc) => (
        <option key={loc} value={loc}>
          {locationLabel(t, loc)}
        </option>
      ))}
    </select>
  );

  const startInput = (
    <input
      id={`${uid}-start`}
      type="date"
      value={effectiveStartDate}
      min={today}
      disabled={!today}
      required
      onChange={(e) => handleStartChange(e.target.value)}
      onClick={hero ? openDatePicker : undefined}
      className={hero ? heroControlClass : controlClass}
    />
  );

  const endInput = (
    <input
      id={`${uid}-end`}
      type="date"
      value={effectiveEndDate}
      min={isValidDateOnly(effectiveStartDate) ? addDateDays(effectiveStartDate, 1) : today}
      disabled={!today}
      required
      aria-describedby={durationText ? durationId : undefined}
      onChange={(e) => handleEndChange(e.target.value)}
      onClick={hero ? openDatePicker : undefined}
      className={hero ? heroControlClass : controlClass}
    />
  );

  const categorySelect = (
    <select
      id={`${uid}-category`}
      value={category}
      onChange={(e) => setCategory(e.target.value)}
      className={hero ? heroControlClass : controlClass}
    >
      {categoryOptions.map((cat) => (
        <option key={cat} value={cat}>
          {categoryText(cat)}
        </option>
      ))}
    </select>
  );

  const fieldsGrid = (
      <div
        className={cn(
          'grid grid-cols-2',
          isCompact
            ? 'gap-2 md:grid-cols-4 lg:grid-cols-[1.5fr_1fr_1fr_1.1fr_auto]'
            : // Accueil : lignes à filets sous 1024 px, barre horizontale en pastilles au-delà
              'lg:gap-2 lg:p-2 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]'
        )}
      >
        {/* Lieu : pleine largeur sur mobile */}
        <div className={cn('col-span-2 lg:col-span-1', isCompact && 'md:col-span-4', hero && 'border-line max-lg:border-b')}>
          {hero ? (
            <HeroField
              id={`${uid}-location`}
              label={t.searchBar.pickupLocation}
              icon={MapPin}
              value={locationLabel(t, location)}
              chevron
            >
              {locationSelect}
            </HeroField>
          ) : (
            <CompactField id={`${uid}-location`} label={t.searchBar.pickupLocation} icon={MapPin}>
              {locationSelect}
            </CompactField>
          )}
        </div>

        {/* Date départ : côte à côte avec retour sur mobile */}
        <div className={cn('col-span-1', hero && 'border-line max-lg:border-b max-lg:border-e')}>
          {hero ? (
            <HeroField
              id={`${uid}-start`}
              label={t.searchBar.pickupDate}
              shortLabel={t.searchBar.pickupShort}
              icon={Calendar}
              value={dateText(effectiveStartDate, t.searchBar.pickupDate)}
            >
              {startInput}
            </HeroField>
          ) : (
            <CompactField id={`${uid}-start`} label={t.searchBar.pickupDate} icon={Calendar}>
              {startInput}
            </CompactField>
          )}
        </div>

        {/* Date retour : côte à côte avec départ sur mobile */}
        <div className={cn('col-span-1', hero && 'border-line max-lg:border-b')}>
          {hero ? (
            <HeroField
              id={`${uid}-end`}
              label={t.searchBar.dropoffDate}
              shortLabel={t.searchBar.dropoffShort}
              icon={Calendar}
              value={dateText(effectiveEndDate, t.searchBar.dropoffDate)}
            >
              {endInput}
            </HeroField>
          ) : (
            <CompactField id={`${uid}-end`} label={t.searchBar.dropoffDate} icon={Calendar}>
              {endInput}
            </CompactField>
          )}
        </div>

        {/* Pas de champ Marque : le carrousel « Les grandes marques » et le catalogue s'en chargent.
            Une marque reçue en paramètre (catalogue) reste transmise dans l'URL. */}

        {/* Catégorie : pleine largeur sur mobile */}
        <div className={cn('col-span-2 lg:col-span-1', isCompact && 'md:col-span-2')}>
          {hero ? (
            <HeroField
              id={`${uid}-category`}
              label={t.searchBar.category}
              icon={Car}
              value={categoryText(category)}
              chevron
            >
              {categorySelect}
            </HeroField>
          ) : (
            <CompactField id={`${uid}-category`} label={t.searchBar.category} icon={Car}>
              {categorySelect}
            </CompactField>
          )}
        </div>

        {/* Bouton Rechercher : grande surface tactile sur mobile */}
        <button
          type="submit"
          disabled={!today}
          aria-disabled={isPending || undefined}
          className={cn(
            'col-span-2 lg:col-span-1 flex lg:h-auto items-center justify-center gap-2 rounded-xl bg-action px-7 py-3.5 text-base lg:text-sm font-bold text-white transition hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-press disabled:cursor-not-allowed disabled:opacity-60 shadow-sm aria-disabled:cursor-progress',
            hero ? 'min-h-13 max-lg:mx-3 max-lg:mb-3 max-lg:mt-1 lg:min-h-12' : 'min-h-12'
          )}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          {t.searchBar.searchBtn}
        </button>
      </div>
  );

  // Résumé du rideau replié, en pastilles séparées : [Lieu] [Dates · durée] [Catégorie] Modifier
  const hasDates = isValidDateOnly(effectiveStartDate) && isValidDateOnly(effectiveEndDate);
  const datesSummary = hasDates
    ? `${date(effectiveStartDate, 'dayMonth')} – ${date(effectiveEndDate, 'dayMonth')}${durationText ? ` · ${durationText}` : ''}`
    : `${t.searchBar.pickupShort} – ${t.searchBar.dropoffShort}`;

  // Durée de la période, sous les champs (annoncée quand elle change)
  const durationLine = (
    <p
      id={durationId}
      aria-live="polite"
      className={cn(
        'text-[13px] font-medium text-ink-tertiary',
        hero ? 'px-4 pb-3 lg:px-4 lg:pb-2.5 lg:pt-0.5' : 'mt-2 px-1',
        !durationText && 'sr-only'
      )}
    >
      {durationText && (
        <>
          <Calendar className="me-1.5 inline h-3.5 w-3.5 align-[-2px] text-accent-text" aria-hidden="true" />
          {t.searchBar.durationLabel} : <strong className="font-bold text-ink">{durationText}</strong>
        </>
      )}
    </p>
  );

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label={t.searchBar.formAria}
      className={`w-full ${isCompact ? '' : 'mx-auto max-w-5xl'}`}
    >
      {hero ? (
        <div className="rounded-2xl bg-white shadow-[0_28px_70px_-28px_rgba(0,0,0,0.6)] ring-1 ring-black/5 max-lg:overflow-hidden lg:rounded-3xl">
          {/* Sous 1024 px : barre du rideau. Repliée, elle résume la recherche et garde un bouton
              Rechercher ; un toucher déroule les champs, « Réduire » les enroule. */}
          <div className={cn('flex items-center gap-2 pe-2 lg:hidden', expanded && 'border-b border-line')}>
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls={fieldsId}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-3 self-stretch ps-4 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
                expanded ? 'min-h-12' : 'min-h-15 py-2.5'
              )}
            >
              {expanded ? (
                <>
                  <span className="min-w-0 flex-1 text-sm font-bold text-ink">{t.searchBar.yourSearch}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 pe-2 text-[13px] font-bold text-ink">
                    {t.searchBar.collapse}
                    <ChevronDown
                      className="h-4 w-4 rotate-180 text-ink-secondary transition-transform duration-base motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </span>
                </>
              ) : (
                <SearchSummaryChips
                  className="flex-1"
                  // Nom du bouton : « Modifier la recherche, lieu, dates, catégorie »
                  prefix={<span className="sr-only">{t.searchBar.editSearch}, </span>}
                  location={locationLabel(t, location)}
                  dates={datesSummary}
                  category={categoryText(category)}
                  action={
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center gap-0.5 px-1 py-1 text-[13px] font-bold text-ink underline decoration-line decoration-2 underline-offset-4"
                    >
                      {t.searchBar.edit}
                      <ChevronDown className="h-4 w-4 text-ink-secondary" aria-hidden="true" />
                    </span>
                  }
                />
              )}
            </button>
            {!expanded && (
              <button
                type="submit"
                disabled={!today}
                aria-disabled={isPending || undefined}
                aria-label={t.searchBar.searchBtn}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-action text-white shadow-sm transition hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-press disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-progress"
              >
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
          {/* Champs : déroulés comme un rideau sous 1024 px (hauteur 0fr → 1fr), toujours visibles au-delà.
              Repliés, ils sont masqués (visibility) : hors du parcours clavier et des lecteurs d'écran. */}
          <div
            id={fieldsId}
            className={cn(
              'grid transition-[grid-template-rows,visibility] duration-slow ease-sheet motion-reduce:transition-none lg:visible lg:grid-rows-[1fr]',
              expanded ? 'grid-rows-[1fr]' : 'max-lg:invisible max-lg:grid-rows-[0fr] max-lg:duration-base max-lg:ease-exit'
            )}
          >
            <div className="min-h-0 max-lg:overflow-hidden">
              {fieldsGrid}
              {durationLine}
            </div>
          </div>
        </div>
      ) : (
        <>
          {fieldsGrid}
          {durationLine}
        </>
      )}
      {dateError && (
        <p className={cn('mt-2 text-sm', hero ? 'font-semibold text-accent-on-dark' : 'text-red-700')} role="alert">
          {dateError}
        </p>
      )}
    </form>
  );
}
