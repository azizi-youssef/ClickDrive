'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from '@/components/i18n/LocalizedLink';
import Image from 'next/image';
import faqHeroImage from '../../../public/faq.jpg';
import {
  ArrowRight,
  ChevronDown,
  FileQuestion,
  HelpCircle,
  Link2,
  MessageSquare,
  Search,
  X,
} from 'lucide-react';
import { FAQ_ENTRIES, localizeFaq, type FaqCategoryId, type FaqItem } from './faq-data';
import { useTranslation } from '@/lib/i18n/LanguageContext';

type CategoryFilter = 'all' | FaqCategoryId;

/** Minuscules sans accents : « caution » trouve aussi « Caution », « aéroport » trouve « aeroport ». */
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Met en évidence la requête dans le texte, sans tenir compte des accents. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalize(query.trim());
  if (!q) return <>{text}</>;
  // La normalisation NFD ne change pas la longueur des caractères latins usuels une fois les diacritiques retirés
  const haystack = normalize(text);
  if (haystack.length !== text.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let from = 0;
  let index = haystack.indexOf(q);
  while (index !== -1) {
    if (index > from) parts.push(text.slice(from, index));
    parts.push(
      <mark key={index} className="rounded bg-[#E63946]/15 px-0.5 text-inherit">
        {text.slice(index, index + q.length)}
      </mark>
    );
    from = index + q.length;
    index = haystack.indexOf(q, from);
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}

function FaqAccordionItem({
  item,
  open,
  query,
  onToggle,
}: {
  item: FaqItem;
  open: boolean;
  query: string;
  onToggle: () => void;
}) {
  const Icon = item.icon;
  const { t } = useTranslation();
  const panelId = `faq-panel-${item.id}`;
  const buttonId = `faq-button-${item.id}`;

  return (
    <li
      id={item.id}
      className={`scroll-mt-28 overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none ${
        open
          ? 'border-[#0B1220]/15 shadow-[0_16px_36px_-24px_rgba(11,18,32,0.35)]'
          : 'border-slate-200/80 hover:border-slate-300'
      }`}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-4 px-4 py-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E63946] sm:px-6 sm:py-5"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none ${
              open ? 'bg-action text-white' : 'bg-[#F5F6F8] text-slate-600'
            }`}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-[#0B1220] sm:text-base">
            <Highlight text={item.question} query={query} />
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${
              open ? 'rotate-180 text-accent-text' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
        <div className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-6 sm:ps-20">
          <p className="text-[15px] leading-7 text-slate-600">
            <Highlight text={item.answer} query={query} />
          </p>
          <a
            href={`#${item.id}`}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-ink-secondary transition-colors hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E63946]"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t.faq.ui.linkToQuestion}
          </a>
        </div>
      </div>
    </li>
  );
}

export function FaqClient() {
  const { t, fmt, plural } = useTranslation();
  const ui = t.faq.ui;
  const { categories: FAQ_CATEGORIES, items: FAQ_ITEMS } = useMemo(() => localizeFaq(t.faq), [t.faq]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set([FAQ_ENTRIES[0].id]));
  const [scrollTarget, setScrollTarget] = useState<{ id: string; at: number } | null>(null);

  // Lien direct (/faq#caution) : ouvre la question ciblée, retire les filtres qui la masqueraient…
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!FAQ_ENTRIES.some((item) => item.id === id)) return;
      setCategory('all');
      setQuery('');
      setOpenIds((current) => new Set(current).add(id));
      setScrollTarget({ id, at: Date.now() });
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  // …puis la fait défiler une fois la liste complète affichée
  useEffect(() => {
    if (!scrollTarget) return;
    document.getElementById(scrollTarget.id)?.scrollIntoView({ block: 'start' });
  }, [scrollTarget]);

  const searching = query.trim().length > 0;

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return FAQ_ITEMS.filter(
      (item) =>
        (category === 'all' || item.category === category) &&
        (!q || normalize(item.question).includes(q) || normalize(item.answer).includes(q))
    );
  }, [query, category, FAQ_ITEMS]);

  const countByCategory = useMemo(() => {
    const counts = new Map<FaqCategoryId, number>();
    for (const item of FAQ_ENTRIES) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return counts;
  }, []);

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Sans recherche ni filtre : questions regroupées par thème
  const groups =
    !searching && category === 'all'
      ? FAQ_CATEGORIES.map((cat) => ({ ...cat, items: results.filter((item) => item.category === cat.id) }))
      : null;

  const isOpen = (id: string) => searching || openIds.has(id);

  const categoryButtons: { id: CategoryFilter; label: string; count: number }[] = [
    { id: 'all', label: ui.allQuestions, count: FAQ_ITEMS.length },
    ...FAQ_CATEGORIES.map((cat) => ({ id: cat.id, label: cat.label, count: countByCategory.get(cat.id) ?? 0 })),
  ];

  return (
    <div className="min-h-screen bg-[#F5F6F8] pb-20 text-[#0B1220]">
      {/* ── Hero + recherche ─────────────────────────────────────────── */}
      <section aria-labelledby="faq-title" className="relative overflow-hidden bg-[#0B1220] text-white">
        {/* Photo en fond, voile marine pour garder le texte blanc lisible (contraste AA) — comme les catalogues et les agences */}
        <Image
          src={faqHeroImage}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          quality={70}
          className="object-cover object-[50%_65%]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-r from-[#0B1220]/95 via-[#0B1220]/80 to-[#0B1220]/50 rtl:bg-linear-to-l"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#0B1220]/85 via-transparent to-[#0B1220]/45"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-[#E63946]/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-[1180px] px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF6B76]">
            <span className="h-px w-7 bg-current" aria-hidden="true" />
            {ui.eyebrow}
          </p>
          <h1
            id="faq-title"
            className="mt-4 max-w-3xl text-balance text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-[56px]"
          >
            {ui.titleBefore} <span className="text-accent-text">ClickDrive</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">{ui.subtitle}</p>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-10 max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div role="search" className="rounded-2xl bg-white p-2 shadow-[0_18px_50px_-20px_rgba(11,18,32,0.35)] ring-1 ring-slate-200/70">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute start-4 h-5 w-5 text-accent-text" aria-hidden="true" />
            <label htmlFor="faq-search" className="sr-only">
              {ui.searchLabel}
            </label>
            <input
              id="faq-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ui.searchPlaceholder}
              className="h-14 w-full rounded-xl bg-[#F5F6F8] pe-12 ps-12 text-base font-medium text-[#0B1220] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1220]/10 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={ui.clearSearch}
                className="absolute end-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 px-1 text-sm text-slate-500" aria-live="polite">
          {searching
            ? plural(results.length, ui.results, { query: query.trim() })
            : ''}
        </p>
      </div>

      {/* ── Catégories + questions ──────────────────────────────────── */}
      <div className="mx-auto mt-6 max-w-[1180px] px-4 sm:px-6 lg:mt-10 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:px-8">
        <aside aria-label={ui.themesAria} className="lg:sticky lg:top-28 lg:self-start">
          {/* Mobile/tablette : puces défilantes — desktop : liste verticale */}
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {categoryButtons.map((cat) => {
              const active = category === cat.id;
              return (
                <li key={cat.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(cat.id)}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors motion-reduce:transition-none lg:whitespace-normal lg:text-start ${
                      active
                        ? 'bg-[#0B1220] text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#0B1220] lg:border-transparent lg:bg-transparent lg:hover:bg-white'
                    }`}
                  >
                    {cat.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                        active ? 'bg-white/15 text-white' : 'bg-[#F5F6F8] text-ink-tertiary'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 hidden rounded-2xl border border-slate-200/80 bg-white p-5 lg:block">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E63946]/10 text-accent-text">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 font-extrabold">{ui.needAnswer}</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">{ui.needAnswerText}</p>
            <Link
              href="/contact"
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-accent-text hover:text-[#C92F3B]"
            >
              {ui.contactUs}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <section aria-label={ui.qaAria} className="mt-6 min-w-0 lg:mt-0">
          {results.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F6F8] text-accent-text">
                <FileQuestion className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-extrabold">{ui.noMatchTitle}</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">{ui.noMatchText}</p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#0B1220] px-5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                >
                  {ui.seeAll}
                </button>
                <Link
                  href="/contact"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-[#0B1220] transition-colors hover:bg-slate-50"
                >
                  {ui.contactUs}
                </Link>
              </div>
            </div>
          ) : groups ? (
            <div className="space-y-10">
              {groups.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.id}>
                    <h2 className="mb-4 flex items-center gap-2.5 text-lg font-extrabold">
                      <Icon className="h-5 w-5 text-accent-text" aria-hidden="true" />
                      {group.label}
                    </h2>
                    <ul className="space-y-3">
                      {group.items.map((item) => (
                        <FaqAccordionItem
                          key={item.id}
                          item={item}
                          open={isOpen(item.id)}
                          query={query}
                          onToggle={() => toggle(item.id)}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <ul className="space-y-3">
              {results.map((item) => (
                <FaqAccordionItem
                  key={item.id}
                  item={item}
                  open={isOpen(item.id)}
                  query={query}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </ul>
          )}

          {/* ── Encore une question ? ─────────────────────────────── */}
          <div className="relative mt-12 overflow-hidden rounded-3xl bg-[#0B1220] p-7 text-white sm:p-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -end-20 -top-24 h-64 w-64 rounded-full bg-[#E63946]/25 blur-3xl"
            />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-[#FF6B76]">
                  <HelpCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-2xl font-extrabold leading-tight">{ui.moreTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{ui.moreText}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
                <Link
                  href="/search"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-action px-6 text-sm font-bold text-white transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {ui.searchCar}
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-6 text-sm font-bold text-white transition-colors hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  {ui.contactUs}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
