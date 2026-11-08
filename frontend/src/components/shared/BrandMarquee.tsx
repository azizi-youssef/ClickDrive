'use client';

import React, { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { BRAND_LOGO_PATHS } from '@/lib/constants/brand-logos';
import { CATALOG_PATHS } from '@/lib/vehicles/kind';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

/*
 * Ordre = demande du marché marocain : les marques produites ou très diffusées localement
 * (Dacia, Renault, Peugeot) d'abord, puis les généralistes, le premium en dernier.
 * Valeurs = libellés du catalogue (utilisés pour le filtre de recherche).
 */
export const FEATURED_BRANDS = [
  'Dacia',
  'Renault',
  'Peugeot',
  'Toyota',
  'Volkswagen',
  'Hyundai',
  'Kia',
  'Citroen',
  'Mercedes-Benz',
  'Land Rover',
] as const;

/*
 * Motos et scooters, même logique : d'abord les marques les plus louées au Maroc (scooters et roadsters
 * japonais, SYM, Peugeot), puis les marques plus rares en location (trail et sportives européennes).
 */
export const FEATURED_MOTORCYCLE_BRANDS = [
  'Yamaha',
  'Honda',
  'Suzuki',
  'SYM',
  'Peugeot',
  'Vespa',
  'Kawasaki',
  'BMW',
  'KTM',
  'Ducati',
] as const;

export type BrandMarqueeKind = 'cars' | 'motorcycles';

/* Libellés d'affichage : la valeur filtrée reste celle du catalogue */
const DISPLAY_NAMES: Record<string, string> = {
  Citroen: 'Citroën',
};

/*
 * Marques sans tracé libre de droits : badge typographique (nom de la marque dans un cartouche),
 * jamais une imitation de leur logo.
 */
const WORDMARK_BADGES: Record<string, { text: string; viewWidth: number; fontSize: number; textLength: number }> = {
  // Cartouche adapté à la longueur du nom, pour un poids visuel proche des autres logos
  Kawasaki: { text: 'KAWASAKI', viewWidth: 44, fontSize: 8.5, textLength: 36 },
  SYM: { text: 'SYM', viewWidth: 30, fontSize: 11, textLength: 20 },
};

/*
 * Poids optique : chaque logo tient dans une boîte de 40×40 px (conteneur constant de 48 px), puis une échelle
 * uniforme par marque égalise la surface visuelle (logos fins agrandis, emblèmes pleins réduits) :
 * les proportions du tracé SVG ne sont jamais déformées.
 */
const LOGO_SCALE: Record<string, number> = {
  Dacia: 1.2,
  Renault: 0.9,
  Peugeot: 0.95,
  Toyota: 0.95,
  Volkswagen: 0.9,
  Hyundai: 1.1,
  Kia: 1.25,
  Citroen: 0.95,
  'Mercedes-Benz': 0.9,
  'Land Rover': 1,
  // Motos
  Yamaha: 0.95,
  Honda: 1,
  Suzuki: 0.9,
  SYM: 1,
  Vespa: 1.4,
  Kawasaki: 1.4,
  BMW: 0.9,
  KTM: 1.25,
  Ducati: 0.95,
};

/*
 * Couleurs officielles des logos (Simple Icons v16.36.0, données CC0, champ « hex »).
 * Renault, Peugeot et Kia : logos officiels actuels monochromes (l'ancien jaune Renault #FFCC33 serait
 * illisible sur fond blanc). Hors Simple Icons : Mercedes-Benz (noir de marque), Land Rover (vert de marque),
 * Kawasaki (« Kawasaki Green ») ; SYM sans source fiable → anthracite neutre.
 */
const BRAND_COLORS: Record<string, string> = {
  Dacia: '#646B52',
  Renault: '#000000',
  Peugeot: '#000000',
  Toyota: '#EB0A1E',
  Volkswagen: '#151F5D',
  Hyundai: '#002C5E',
  Kia: '#05141F',
  Citroen: '#DA291C',
  'Mercedes-Benz': '#1F1F1F',
  'Land Rover': '#005A2B',
  // Motos
  Yamaha: '#E60012',
  Honda: '#E40521',
  Suzuki: '#E30613',
  SYM: '#17191D',
  Vespa: '#85B09A',
  Kawasaki: '#6BBF23',
  BMW: '#0066B1',
  KTM: '#FF6600',
  Ducati: '#CC0000',
};

/** Compte de véhicules par marque, clé normalisée (minuscules, sans accents). */
export function normalizeBrandKey(brand: string): string {
  return brand
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Logo vectoriel d'une marque (tracé Simple Icons, ou emblème dédié). */
export function BrandLogo({ brand, className }: { brand: string; className?: string }) {
  const scale = { transform: `scale(${LOGO_SCALE[brand] ?? 1})` };
  if (brand === 'Land Rover') {
    // Pas de tracé libre : ovale typographique dans l'esprit du badge
    return (
      <svg viewBox="0 0 48 24" aria-hidden="true" className={className} style={scale}>
        <ellipse cx="24" cy="12" rx="23" ry="11" fill="currentColor" />
        <ellipse cx="24" cy="12" rx="21.2" ry="9.4" fill="none" stroke="#fff" strokeWidth="0.8" />
        <text
          x="24"
          y="14.3"
          textAnchor="middle"
          fill="#fff"
          fontSize="6"
          fontWeight="800"
          textLength="34"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          LAND ROVER
        </text>
      </svg>
    );
  }
  const badge = WORDMARK_BADGES[brand];
  if (badge) {
    return (
      <svg viewBox={`0 0 ${badge.viewWidth} 24`} aria-hidden="true" className={className} style={scale}>
        <rect x="0.5" y="3" width={badge.viewWidth - 1} height="18" rx="3.5" fill="currentColor" />
        <text
          x={badge.viewWidth / 2}
          y={12 + badge.fontSize * 0.36}
          textAnchor="middle"
          fill="#fff"
          fontSize={badge.fontSize}
          fontWeight="800"
          textLength={badge.textLength}
          lengthAdjust="spacingAndGlyphs"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          {badge.text}
        </text>
      </svg>
    );
  }
  const path = BRAND_LOGO_PATHS[brand];
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} style={scale}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/** Une marque : logo en couleurs officielles, nom et nombre réel de véhicules, lien vers le catalogue filtré. */
function BrandCard({
  brand,
  count,
  loading,
  kind,
  active,
  onSelect,
}: {
  brand: string;
  count: number | undefined;
  loading: boolean;
  kind: BrandMarqueeKind;
  /** Marque actuellement filtrée dans le catalogue */
  active: boolean;
  onSelect?: (brand: string) => void;
}) {
  const { t } = useTranslation();
  const name = DISPLAY_NAMES[brand] ?? brand;
  const moto = kind === 'motorcycles';
  const [one, many] = moto ? [t.brands.motoOne, t.brands.motoMany] : [t.brands.vehicleOne, t.brands.vehicleMany];
  const unavailable = !loading && (count === undefined || count === 0);
  const countLabel = unavailable ? t.brands.soon : (count === 1 ? one : many).replace('{count}', String(count));
  const cardLabel = (moto ? t.brands.motoCardLabel : t.brands.cardLabel).replace('{brand}', name);

  return (
    <Link
      href={`${CATALOG_PATHS[moto ? 'MOTORCYCLE' : 'CAR']}?brand=${encodeURIComponent(brand)}`}
      aria-label={loading ? cardLabel : `${cardLabel} — ${countLabel}`}
      aria-current={active ? 'true' : undefined}
      draggable={false}
      onClick={(event) => {
        // Sur la page du catalogue : filtre appliqué sur place (le lien reste utilisable en nouvel onglet)
        if (!onSelect || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onSelect(brand);
      }}
      // Sans carte : ni bordure, ni fond, ni ombre. Le contour n'apparaît qu'au focus clavier (accessibilité).
      className="group/card flex flex-col items-center gap-4 rounded-2xl px-2 py-5 text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17191D]"
    >
      {/* Logo aux couleurs officielles, 60 px, proportions du tracé conservées ; léger agrandissement au survol */}
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center transition-[scale,filter,opacity] duration-[250ms] ease-out',
          'group-hover/card:scale-[1.06] group-focus-visible/card:scale-[1.06]',
          'motion-reduce:transition-none motion-reduce:group-hover/card:scale-100 motion-reduce:group-focus-visible/card:scale-100',
          // Marque sans véhicule : couleurs officielles conservées, légèrement estompées (pleines au survol)
          unavailable && 'opacity-55 group-hover/card:opacity-100 group-focus-visible/card:opacity-100'
        )}
        style={{ color: BRAND_COLORS[brand] ?? '#17191D' }}
        aria-hidden="true"
      >
        <BrandLogo brand={brand} className="h-[60px] w-[60px]" />
      </span>
      <span className="flex flex-col items-center">
        <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#17191D]">{name}</span>
        {loading ? (
          <span className="mt-1.5 h-3.5 w-16 animate-pulse rounded bg-[#F1F2F5] motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <span className={cn('mt-1 text-[12.5px] tabular-nums', unavailable ? 'text-[#69707D]' : 'text-[#4E5562]')}>
            {countLabel}
          </span>
        )}
        {/* Marque active : fin soulignement rouge (place réservée : aucun décalage quand il apparaît) */}
        <span
          className={cn('mt-2.5 h-0.5 w-8 rounded-full transition-colors duration-[250ms]', active ? 'bg-[#E63946]' : 'bg-transparent')}
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

/** Défilement continu volontairement lent (ton éditorial), et pause après une action de l'utilisateur */
const CYCLE_SPEED_PX_PER_S = 24;
const MANUAL_HOLD_MS = 6000;
/** Distance (px) au-delà de laquelle un appui souris devient un glisser (et n'ouvre pas la carte) */
const DRAG_THRESHOLD_PX = 6;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** Largeur d'une série complète de marques (cartes + écarts), base du cycle. */
function measureSetWidth(el: HTMLUListElement, count: number): number {
  const items = el.children;
  if (count === 0 || items.length < count) return 0;
  const first = items[0] as HTMLElement;
  if (items.length > count) return (items[count] as HTMLElement).offsetLeft - first.offsetLeft;
  const last = items[count - 1] as HTMLElement;
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  return last.offsetLeft + last.offsetWidth + gap - first.offsetLeft;
}

/**
 * Vitrine des grandes marques (éditorial automobile, sans cartes : ni bordure, ni fond, ni ombre) :
 * - logos de 60 px aux couleurs officielles, proportions conservées, agrandis de 6 % au survol (250 ms) ;
 * - nom en capitales espacées, nombre réel de véhicules dessous (données du catalogue), « Bientôt disponible »
 *   sinon (logo en couleurs, légèrement estompé) ;
 * - marque filtrée signalée par un fin soulignement rouge (`aria-current`) ;
 * - cycle infini à défilement lent : une copie inerte de la série suit l'originale et la position est
 *   recalée d'une série, sans saut visible ; pause au survol, au focus, au toucher, hors écran, onglet masqué
 *   et bouton pause/lecture (WCAG 2.2.2) ; aucune animation si l'utilisateur réduit les mouvements ;
 * - défilement natif (swipe, molette), glisser à la souris, flèches sans butée ;
 * - clavier : Tab entre les cartes, ← → Début Fin pour se déplacer dans la liste.
 *
 * Contrastes (fond blanc) : #17191D 17,6:1 ; nombres #4E5562 7,6:1 ; « Bientôt » #69707D 5,0:1
 * (le #737B89 de la charte n'atteint que 4,3:1 : réservé aux éléments non textuels) ;
 * rouge #E63946 (4,2:1) uniquement pour des éléments graphiques.
 *
 * `kind` choisit le catalogue (voitures → /search, motos → /motos) et les libellés ;
 * `reverse` fait défiler vers la droite.
 */
export function BrandMarquee({
  kind = 'cars',
  brands = kind === 'motorcycles' ? FEATURED_MOTORCYCLE_BRANDS : FEATURED_BRANDS,
  vehicleCounts,
  countsLoading = false,
  reverse = false,
  className,
  activeBrand,
  onBrandSelect,
}: {
  kind?: BrandMarqueeKind;
  brands?: readonly string[];
  /** Nombre de véhicules par marque, clés issues de normalizeBrandKey() */
  vehicleCounts?: Record<string, number>;
  countsLoading?: boolean;
  reverse?: boolean;
  className?: string;
  /** Marque actuellement filtrée dans le catalogue (comparaison sans casse ni accents) */
  activeBrand?: string;
  /** Sur la page du catalogue lui-même : applique le filtre sans quitter la page */
  onBrandSelect?: (brand: string) => void;
}) {
  const { t } = useTranslation();
  const moto = kind === 'motorcycles';
  const texts = moto
    ? {
        eyebrow: t.brands.motoEyebrow,
        title: t.brands.motoTitle,
        description: t.brands.motoDescription,
        catalog: t.brands.motoCatalog,
        region: t.brands.motoRegionLabel,
      }
    : {
        eyebrow: t.brands.eyebrow,
        title: t.brands.title,
        description: t.brands.description,
        catalog: t.brands.catalog,
        region: t.brands.regionLabel,
      };
  const catalogPath = CATALOG_PATHS[moto ? 'MOTORCYCLE' : 'CAR'];
  const activeKey = activeBrand ? normalizeBrandKey(activeBrand) : null;
  const titleId = useId();
  const scrollerId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const holdUntil = useRef(0);
  const setWidth = useRef(0);
  const position = useRef(0);
  const drag = useRef<{ pointerId: number; startX: number; startLeft: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState({ canPrev: false, canNext: true, thumb: 100, offset: 0 });

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );
  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true
  );
  // Cycle possible : animations autorisées et marques plus larges que l'écran (sinon tout est déjà visible)
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [inView, setInView] = useState(false);
  // Apparition en cascade, jouée une seule fois quand la section approche de l'écran
  const [reveal, setReveal] = useState(false);

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const series = measureSetWidth(el, brands.length);
    setWidth.current = series;
    const cycle = !reducedMotion && series > el.clientWidth + 8;
    setLoop(cycle);

    if (cycle) {
      // Position dans le cycle courant ; flèches toujours actives (pas de butée)
      const thumb = Math.min(100, (el.clientWidth / (series + el.clientWidth)) * 100);
      const progress = (((el.scrollLeft % series) + series) % series) / series;
      setState({ canPrev: true, canNext: true, thumb, offset: progress * (100 - thumb) });
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    const thumb = el.scrollWidth > 0 ? Math.min(100, (el.clientWidth / el.scrollWidth) * 100) : 100;
    const ratio = max > 0 ? el.scrollLeft / max : 0;
    setState({
      canPrev: el.scrollLeft > 4,
      canNext: el.scrollLeft < max - 4,
      thumb,
      offset: ratio * (100 - thumb),
    });
  }, [brands.length, reducedMotion]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Recalage d'une série une fois le défilement manuel terminé (évite d'interrompre un swipe)
    const wrap = () => {
      const series = setWidth.current;
      if (loop && series > 0 && el.scrollLeft >= series) el.scrollLeft -= series;
    };
    // Les événements scroll sont déjà cadencés par le navigateur (une fois par image au plus)
    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('scrollend', wrap);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('scrollend', wrap);
      observer.disconnect();
    };
  }, [update, loop]);

  // Visibilité de la section : met le défilement en pause hors écran
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), {
      threshold: 0.2,
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Apparition : déclenchée un peu avant l'entrée à l'écran (marge de 15 %), donc sans clignotement.
  // Les cartes ne sont jamais masquées à l'avance : si l'observateur ne se déclenche pas, elles restent visibles.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let first = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const near = entry?.isIntersecting ?? false;
        if (first) {
          first = false;
          // Déjà visible au chargement : pas d'animation
          if (near) observer.disconnect();
          return;
        }
        if (near) {
          setReveal(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px 15% 0px' }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const autoplayActive = loop && playing && pageVisible && inView && !hovered && !focusInside && !dragging;

  // Défilement continu : position flottante cumulée (scrollLeft est arrondi par les navigateurs)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!autoplayActive || !el) return;
    position.current = el.scrollLeft;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = Math.min(50, now - last);
      last = now;
      if (Date.now() < holdUntil.current) {
        position.current = el.scrollLeft;
      } else {
        // L'utilisateur a bougé la liste entre-temps : on repart de sa position
        if (Math.abs(el.scrollLeft - Math.round(position.current)) > 2) position.current = el.scrollLeft;
        position.current += ((reverse ? -1 : 1) * CYCLE_SPEED_PX_PER_S * elapsed) / 1000;
        const series = setWidth.current;
        // Recalage d'une série dans les deux sens : la copie identique rend le saut invisible
        if (series > 0 && position.current >= series) position.current -= series;
        if (series > 0 && position.current < 0) position.current += series;
        el.scrollLeft = Math.round(position.current);
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [autoplayActive, reverse]);

  /** Toute action manuelle suspend le défilement automatique quelques secondes */
  const holdAutoplay = () => {
    holdUntil.current = Date.now() + MANUAL_HOLD_MS;
  };

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    holdAutoplay();
    const page = el.clientWidth * 0.85;
    const series = setWidth.current;
    // Cycle : on se replace d'une série avant d'avancer pour ne jamais buter sur une extrémité
    if (loop && series > 0) {
      if (direction > 0 && el.scrollLeft + page > el.scrollWidth - el.clientWidth - 1) el.scrollLeft -= series;
      if (direction < 0 && el.scrollLeft - page < 0) el.scrollLeft += series;
    }
    el.scrollBy({ left: direction * page, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  // ── Glisser à la souris (le tactile utilise le défilement natif) ─────────────────────
  const onPointerDown = (event: React.PointerEvent<HTMLUListElement>) => {
    holdAutoplay();
    suppressClick.current = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLUListElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const el = event.currentTarget;
    const dx = event.clientX - current.startX;
    if (!current.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      current.moved = true;
      setDragging(true);
      el.setPointerCapture?.(event.pointerId);
    }
    holdAutoplay();
    let next = current.startLeft - dx;
    // Cycle : on glisse sans fin, en recalant l'origine d'une série au besoin
    const series = setWidth.current;
    if (loop && series > 0) {
      if (next >= series) {
        current.startLeft -= series;
        next -= series;
      } else if (next < 0) {
        current.startLeft += series;
        next += series;
      }
    }
    el.scrollLeft = next;
  };

  const endDrag = (event: React.PointerEvent<HTMLUListElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    // Un glisser ne doit pas ouvrir la carte sous le curseur au relâchement
    suppressClick.current = current.moved;
    drag.current = null;
    if (current.moved) {
      setDragging(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  // ── Clavier : ← → Début Fin entre les cartes (les copies inertes du cycle sont ignorées) ──
  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('li:not([inert]) a'));
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (index === -1 || links.length === 0) return;
    event.preventDefault();
    holdAutoplay();
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? links.length - 1
          : Math.min(links.length - 1, Math.max(0, index + (event.key === 'ArrowRight' ? 1 : -1)));
    links[target]?.focus();
  };

  const circleButton =
    'flex h-11 w-11 items-center justify-center rounded-full border border-[#E9EBEF] bg-white text-[#17191D] outline-none transition-colors duration-[250ms] hover:border-[#17191D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17191D] disabled:cursor-not-allowed disabled:text-[#C3C8D0] disabled:hover:border-[#E9EBEF]';

  const pauseButton = (extraClass: string) =>
    loop ? (
      <button
        type="button"
        onClick={() => setPlaying((value) => !value)}
        aria-controls={scrollerId}
        aria-label={playing ? t.brands.pause : t.brands.play}
        title={playing ? t.brands.pause : t.brands.play}
        className={cn(circleButton, extraClass)}
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </button>
    ) : null;

  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      // Marge de départ commune au titre et aux cartes (mêmes valeurs que le conteneur max-w-7xl)
      className={cn(
        'border-t border-[#E9EBEF] bg-white py-14 [--edge:1rem] sm:py-20 sm:[--edge:1.5rem] lg:[--edge:max(2rem,calc((100%-80rem)/2+2rem))]',
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
        <div className="min-w-0 max-w-xl">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#17191D]">
            <span className="h-px w-6 bg-[#E63946]" aria-hidden="true" />
            {texts.eyebrow}
          </p>
          <h2 id={titleId} className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[#17191D] sm:text-[34px]">
            {texts.title}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#69707D]">{texts.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <Link
            href={catalogPath}
            className="group/link inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#17191D] underline-offset-[6px] outline-none hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17191D]"
          >
            {texts.catalog}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-[250ms] group-hover/link:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180"
              aria-hidden="true"
            />
          </Link>
          <div dir="ltr" className="hidden items-center gap-2 sm:flex">
            {/* Pause/lecture : à côté des flèches sur PC, sous le carrousel sur mobile */}
            {pauseButton('')}
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              disabled={!state.canPrev}
              aria-controls={scrollerId}
              aria-label={t.brands.previous}
              className={circleButton}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!state.canNext}
              aria-controls={scrollerId}
              aria-label={t.brands.next}
              className={circleButton}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* dir="ltr" : défilement et flèches cohérents quelle que soit la langue */}
      <div
        dir="ltr"
        role="region"
        aria-label={texts.region}
        className="relative mt-8"
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocusInside(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
        }}
      >
        <ul
          id={scrollerId}
          ref={scrollerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(event) => {
            if (!suppressClick.current) return;
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
          onKeyDown={onListKeyDown}
          onWheel={holdAutoplay}
          onTouchStart={holdAutoplay}
          className={cn(
            'flex gap-3 overflow-x-auto overscroll-x-contain py-3 ps-(--edge) pe-(--edge) scroll-ps-(--edge) [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden',
            dragging ? 'cursor-grabbing select-none' : 'sm:cursor-grab',
            // Aimantation sur les cartes, sauf pendant le défilement continu ou un glisser (elle les bloquerait)
            autoplayActive || dragging ? 'snap-none' : 'snap-x snap-mandatory'
          )}
        >
          {/* Cycle : série d'origine + copie inerte (masquée aux lecteurs d'écran, hors tabulation) */}
          {(loop ? [0, 1] : [0]).flatMap((copy) =>
            brands.map((brand, index) => (
              <li
                key={`${copy}-${brand}`}
                aria-hidden={copy === 1 || undefined}
                inert={copy === 1 || undefined}
                className={cn(
                  // Espacement généreux : mobile ~2,5 marques visibles ; tablette ~5 ; portable ~7 ; grand écran 8+
                  'w-[36vw] max-w-[168px] shrink-0 snap-start sm:w-[152px] lg:w-[168px]',
                  reveal && 'animate-[cd-brand-rise_560ms_cubic-bezier(0.16,1,0.3,1)_both]'
                )}
                style={reveal ? { animationDelay: `${Math.min(index, 7) * 60}ms` } : undefined}
              >
                <BrandCard
                  brand={brand}
                  count={vehicleCounts?.[normalizeBrandKey(brand)]}
                  loading={countsLoading}
                  kind={kind}
                  active={activeKey !== null && normalizeBrandKey(brand) === activeKey}
                  onSelect={onBrandSelect}
                />
              </li>
            ))
          )}
        </ul>

        {/* Fondus de bord discrets : signalent qu'il reste des marques de chaque côté */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-white to-transparent transition-opacity duration-[250ms] sm:w-14',
            state.canPrev ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-white to-transparent transition-opacity duration-[250ms] sm:w-14',
            state.canNext ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>

      {/* Progression (décorative) ; sur mobile, précédée du bouton pause/lecture */}
      {state.thumb < 100 && (
        <div dir="ltr" className="mx-auto mt-6 flex max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          {pauseButton('sm:hidden')}
          <div aria-hidden="true" className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-[#E9EBEF]">
            <div
              className="absolute inset-y-0 rounded-full bg-[#17191D] transition-[left] duration-150 motion-reduce:transition-none"
              style={{ width: `${state.thumb}%`, left: `${state.offset}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
