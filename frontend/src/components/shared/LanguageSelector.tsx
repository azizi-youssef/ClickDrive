'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Globe } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { type Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  variant?: 'navbar' | 'mobile' | 'footer';
  className?: string;
}

export function LanguageSelector({ variant = 'navbar', className }: LanguageSelectorProps) {
  const { locale, setLocale, currentLanguage, supportedLanguages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSelect = (code: Locale) => {
    setLocale(code);
    setIsOpen(false);
  };

  /* -------------------------------------------------------------------------- */
  /* VARIANT: MOBILE DRAWER (Full-width pills or grid)                          */
  /* -------------------------------------------------------------------------- */
  if (variant === 'mobile') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Globe className="h-3.5 w-3.5" />
          <span>Langue / Language</span>
        </div>
        {/* 6 langues en 3 × 2 : nom complet dans sa propre langue, zones tactiles de 44 px */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-slate-100/70 p-1">
          {supportedLanguages.map((lang) => {
            const isActive = lang.code === locale;
            return (
              <button
                key={lang.code}
                type="button"
                lang={lang.code}
                dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                onClick={() => setLocale(lang.code)}
                className={cn(
                  'flex min-h-11 items-center justify-center rounded-lg px-1 text-center text-sm transition-all',
                  isActive
                    ? 'bg-white font-bold text-slate-900 shadow-xs'
                    : 'font-medium text-slate-600 hover:text-slate-900'
                )}
                aria-pressed={isActive}
              >
                {lang.nativeName}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* VARIANT: FOOTER (Dark mode friendly)                                      */
  /* -------------------------------------------------------------------------- */
  if (variant === 'footer') {
    return (
      <div ref={containerRef} className={cn('relative inline-block', className)}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label="Sélectionner la langue"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{currentLanguage.nativeName}</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </button>

        {isOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-0 mb-2 w-48 overflow-hidden rounded-2xl border border-slate-700 bg-[#0F172A] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              Choisir la langue
            </div>
            <div className="mt-1 space-y-0.5">
              {supportedLanguages.map((lang) => {
                const isActive = lang.code === locale;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(lang.code)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs transition-colors text-left',
                      isActive
                        ? 'bg-white/10 font-bold text-white'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span>{lang.nativeName}</span>
                    </div>
                    {isActive && <Check className="h-3.5 w-3.5 text-accent-text" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* VARIANT: NAVBAR (Default Desktop dropdown)                                 */
  /* -------------------------------------------------------------------------- */
  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={`Langue actuelle : ${currentLanguage.nativeName}. Cliquer pour changer.`}
        className={cn(
          'tap-44 inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all duration-200',
          isOpen
            ? 'border-[#0B1220] bg-slate-100 text-slate-900 shadow-xs'
            : 'border-slate-200/80 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        )}
      >
        <Globe className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        <span className="uppercase tracking-wide text-[11px] font-bold text-slate-800">
          {currentLanguage.code}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.12)] z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Langue / Language
          </div>
          <div className="mt-1 space-y-0.5">
            {supportedLanguages.map((lang) => {
              const isActive = lang.code === locale;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(lang.code)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs transition-colors text-left',
                    isActive
                      ? 'bg-slate-100 font-bold text-slate-950'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-slate-900">{lang.nativeName}</span>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      ({lang.code})
                    </span>
                  </div>
                  {isActive && <Check className="h-3.5 w-3.5 text-accent-text" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
