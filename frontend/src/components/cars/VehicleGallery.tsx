'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CarFront, ChevronLeft, ChevronRight, Expand, Motorbike, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isOptimizableImage } from '@/lib/utils/images';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface VehicleGalleryProps {
  images: string[];
  /** Ex. « Hyundai Tucson 2026 » — sert aux textes alternatifs */
  title: string;
  /** Pastille superposée (statut de disponibilité) */
  overlay?: React.ReactNode;
  /** Indique s'il s'agit d'une moto (adapte l'icône de remplacement) */
  isMoto?: boolean;
}

function Placeholder({ title, className, isMoto }: { title: string; className?: string; isMoto?: boolean }) {
  const { t, fmt } = useTranslation();
  return (
    <div
      role="img"
      aria-label={fmt(t.car.gallery.unavailable, { title })}
      className={cn('flex h-full w-full items-center justify-center bg-linear-to-b from-[#EEF0F3] to-[#F5F6F8] text-slate-300', className)}
    >
      {isMoto ? (
        <Motorbike className="h-16 w-16" strokeWidth={1.2} aria-hidden="true" />
      ) : (
        <CarFront className="h-16 w-16" strokeWidth={1.2} aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * Galerie de la fiche véhicule : grande photo, miniatures, compteur, navigation clavier
 * et visionneuse plein écran. Les photos en échec sont remplacées par un emplacement neutre.
 */
export function VehicleGallery({ images, title, overlay, isMoto }: VehicleGalleryProps) {
  const { t, fmt } = useTranslation();
  const g = t.car.gallery;
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  const count = images.length;
  const hasMany = count > 1;
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;
  const src = count > 0 && !failed.has(safeIndex) ? images[safeIndex] : undefined;

  const go = useCallback(
    (step: 1 | -1) => {
      if (count < 2) return;
      setDirection(step);
      setIndex((current) => (current + step + count) % count);
    },
    [count]
  );

  const markFailed = (i: number) => setFailed((current) => new Set(current).add(i));

  // Visionneuse : Échap, focus piégé, page inerte, scroll bloqué, focus rendu à la photo d'ouverture
  const lightboxRef = useModalDialog<HTMLDivElement>(lightboxOpen && Boolean(src), {
    onClose: () => setLightboxOpen(false),
    returnFocusRef: openerRef,
  });

  // Flèches gauche / droite : photo précédente / suivante
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxOpen, go]);

  const slide = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, x: direction * 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -24 },
      };

  const arrowClass =
    'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#0B1220] shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]';

  return (
    <section aria-roledescription={g.carousel} aria-label={fmt(g.photosLabel, { title })} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(11,18,32,0.04)] sm:p-2.5">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#F5F6F8]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={safeIndex}
            className="absolute inset-0"
            initial={slide.initial}
            animate={slide.animate}
            exit={slide.exit}
            transition={{ duration: 0.28, ease: [0.33, 1, 0.68, 1] }}
          >
            {src ? (
              <Image
                src={src}
                alt={fmt(g.photoAlt, { title, index: safeIndex + 1, total: Math.max(count, 1) })}
                fill
                priority={safeIndex === 0}
                sizes="(max-width: 1024px) 100vw, 860px"
                className="object-cover"
                unoptimized={!isOptimizableImage(src)}
                onError={() => markFailed(safeIndex)}
              />
            ) : (
              <Placeholder title={title} isMoto={isMoto} />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/35 to-transparent" />

        {overlay && <div className="absolute start-3 top-3 z-10">{overlay}</div>}

        {hasMany && (
          <>
            <button type="button" onClick={() => go(-1)} className={cn(arrowClass, 'start-3')} aria-label={g.previous}>
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} className={cn(arrowClass, 'end-3')} aria-label={g.next}>
              <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </button>
          </>
        )}

        <div className="absolute bottom-3 start-3 z-10 rounded-lg bg-black/55 px-2.5 py-1 text-xs font-bold tabular-nums text-white backdrop-blur-md" aria-live="polite">
          {count > 0 ? safeIndex + 1 : 0} / {count}
        </div>

        {src && (
          <button
            ref={openerRef}
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label={g.fullscreenAria}
            className="absolute bottom-3 end-3 z-10 inline-flex h-10 items-center gap-1.5 rounded-lg bg-white/95 px-3 text-xs font-bold text-[#0B1220] shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E63946]"
          >
            <Expand className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline" aria-hidden="true">{g.fullscreen}</span>
          </button>
        )}
      </div>

      {hasMany && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:mt-2.5" aria-label={g.thumbnails}>
          {images.map((image, i) => (
            <li key={`${image}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDirection(i > safeIndex ? 1 : -1);
                  setIndex(i);
                }}
                aria-label={fmt(g.showPhoto, { index: i + 1 })}
                aria-current={i === safeIndex ? 'true' : undefined}
                className={cn(
                  'relative block aspect-[16/10] w-24 overflow-hidden rounded-lg border-2 transition sm:w-28',
                  i === safeIndex ? 'border-[#E63946]' : 'border-transparent opacity-70 hover:opacity-100'
                )}
              >
                {failed.has(i) ? (
                  <Placeholder title={title} className="[&_svg]:h-6 [&_svg]:w-6" isMoto={isMoto} />
                ) : (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                    unoptimized={!isOptimizableImage(image)}
                    onError={() => markFailed(i)}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Visionneuse plein écran ─────────────────────────────── */}
      {lightboxOpen && src && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label={fmt(g.viewer, { title })}
          tabIndex={-1}
          className="fixed inset-0 z-[70] flex flex-col bg-[#0B1220]/95 outline-none backdrop-blur-sm"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
            <p className="text-sm font-bold">
              {title}
              <span className="ms-3 font-medium tabular-nums text-slate-400">
                {safeIndex + 1} / {count}
              </span>
            </p>
            <button
              data-autofocus
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
              aria-label={g.closeViewer}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="relative flex-1">
            <Image
              src={src}
              alt={fmt(g.photoAlt, { title, index: safeIndex + 1, total: count })}
              fill
              sizes="100vw"
              className="object-contain"
              unoptimized={!isOptimizableImage(src)}
            />
            {hasMany && (
              <>
                <button type="button" onClick={() => go(-1)} className={cn(arrowClass, 'start-4')} aria-label={g.previous}>
                  <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => go(1)} className={cn(arrowClass, 'end-4')} aria-label={g.next}>
                  <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <div className="pb-[max(1rem,env(safe-area-inset-bottom))]" />
        </div>
      )}
    </section>
  );
}
