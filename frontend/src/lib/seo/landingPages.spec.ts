import { describe, expect, it } from 'vitest';
import { ALL_SEO_SLUGS, SEO_LANDING_PAGES, getLandingPage } from './landingPages';
import { LANDING_SLUGS, canonicalLandingSlug, landingSlugFor } from './landing-slugs';
import { PREFIXED_LOCALES, type Locale } from '@/lib/i18n/config';
import robots from '@/app/robots';

const pages = Object.values(SEO_LANDING_PAGES);
const allText = (page: (typeof pages)[number]) =>
  [
    page.h1,
    page.title,
    page.metaDescription,
    page.introTitle,
    page.introText,
    ...(page.sections ?? []).flatMap((section) => [section.title, ...section.paragraphs]),
    ...page.faqs.flatMap((faq) => [faq.question, faq.answer]),
  ].join(' ');

describe('Pages SEO — règles éditoriales', () => {
  it('titres de 60 caractères au plus, descriptions de 160 au plus, slugs cohérents', () => {
    for (const [slug, page] of Object.entries(SEO_LANDING_PAGES)) {
      expect(page.slug).toBe(slug);
      expect(page.title.length, page.slug).toBeLessThanOrEqual(60);
      expect(page.metaDescription.length, page.slug).toBeLessThanOrEqual(160);
      expect(page.faqs.length, page.slug).toBeGreaterThan(0);
    }
    expect(new Set(ALL_SEO_SLUGS).size).toBe(ALL_SEO_SLUGS.length);
  });

  it('aucun prix écrit à la main : les montants viennent du catalogue', () => {
    for (const page of pages) {
      expect(allText(page), page.slug).not.toMatch(/\d+\s*(DH|MAD|dirhams?)\b/i);
    }
  });

  it('aucune agence inventée ni promesse invérifiable', () => {
    const invented = /Nador Auto Rent|Rif Car Luxury|Marchica Drive|Atlas Car|pancarte|temps réel|n°\s*1|\bgaranti(e|es|s)?\b/i;
    for (const page of pages) {
      expect(allText(page), page.slug).not.toMatch(invented);
    }
  });
});

/** Promesses invérifiables ou services non garantis par toutes les agences, par langue */
const INVENTED_BY_LOCALE: Partial<Record<Locale, RegExp>> = {
  en: /guarantee[ds]?|real[- ]time|no\.?\s*1|name (board|sign)/i,
  es: /garantizad[oa]s?|tiempo real|n\.?º\s*1|cartel/i,
  de: /garantiert|Echtzeit|Nr\.\s*1|Namensschild/i,
  nl: /gegarandeerd|real-?time|nr\.\s*1|naambord/i,
  ar: /مضمون|الوقت الحقيقي|لافتة|رقم\s*1/,
};

describe('Pages SEO traduites', () => {
  it('chaque langue traduit les 13 pages, avec les mêmes règles de longueur', () => {
    for (const locale of PREFIXED_LOCALES) {
      for (const slug of ALL_SEO_SLUGS) {
        const page = getLandingPage(slug, locale)!;
        const french = SEO_LANDING_PAGES[slug];
        expect(page.slug, `${locale} ${slug}`).toBe(slug);
        expect(page.h1, `${locale} ${slug}`).not.toBe(french.h1);
        expect(page.title.length, `${locale} ${slug}`).toBeLessThanOrEqual(60);
        expect(page.metaDescription.length, `${locale} ${slug}`).toBeLessThanOrEqual(160);
        expect(page.faqs.length, `${locale} ${slug}`).toBeGreaterThan(0);
        // Les guides gardent leurs sections ; la configuration (filtres) reste celle du français
        expect(Boolean(page.sections?.length), `${locale} ${slug}`).toBe(Boolean(french.sections?.length));
        expect(page.filterCategory).toBe(french.filterCategory);
        expect(page.vehicleType).toBe(french.vehicleType);
      }
    }
  });

  it('aucun prix ni promesse invérifiable, dans aucune langue', () => {
    for (const locale of PREFIXED_LOCALES) {
      for (const slug of ALL_SEO_SLUGS) {
        const text = allText(getLandingPage(slug, locale)!);
        expect(text, `${locale} ${slug}`).not.toMatch(/\d+\s*(DH|MAD|dirhams?|درهم)/i);
        expect(text, `${locale} ${slug}`).not.toMatch(INVENTED_BY_LOCALE[locale]!);
      }
    }
  });

  it('adresses traduites uniques et réversibles (l’arabe garde le slug français)', () => {
    expect(Object.keys(LANDING_SLUGS).sort()).toEqual([...ALL_SEO_SLUGS].sort());
    for (const locale of PREFIXED_LOCALES) {
      const slugs = ALL_SEO_SLUGS.map((slug) => landingSlugFor(slug, locale));
      expect(new Set(slugs).size, locale).toBe(slugs.length);
      for (const slug of ALL_SEO_SLUGS) {
        expect(canonicalLandingSlug(landingSlugFor(slug, locale), locale)).toBe(slug);
        expect(landingSlugFor(slug, locale)).toMatch(/^[a-z0-9-]+$/);
      }
    }
    expect(landingSlugFor('location-voiture-nador', 'ar')).toBe('location-voiture-nador');
  });
});

describe('robots.txt', () => {
  const rules = robots().rules;
  const list = Array.isArray(rules) ? rules : [rules];
  const blockedEverywhere = list
    .filter((rule) => (Array.isArray(rule.disallow) ? rule.disallow.includes('/') : rule.disallow === '/'))
    .flatMap((rule) => (Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent]));

  it('robots d’entraînement bloqués, robots de recherche des assistants autorisés', () => {
    expect(blockedEverywhere).toEqual(expect.arrayContaining(['GPTBot', 'CCBot', 'ClaudeBot', 'Google-Extended']));
    for (const searchBot of ['ChatGPT-User', 'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot']) {
      expect(blockedEverywhere).not.toContain(searchBot);
    }
  });

  it('pages personnelles signées jamais indexées', () => {
    const general = list.find((rule) => rule.userAgent === '*');
    expect(general?.disallow).toEqual(expect.arrayContaining(['/suivi/', '/avis/']));
  });
});
