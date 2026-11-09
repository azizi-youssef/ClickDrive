/** Textes d'une page SEO dans une langue (la configuration — filtres, type — reste dans landingPages.ts) */
export type LandingText = {
  h1: string;
  /** 60 caractères au plus, affiché tel quel (sans suffixe) */
  title: string;
  /** 160 caractères au plus */
  metaDescription: string;
  keywords: string[];
  zoneName: string;
  introTitle: string;
  introText: string;
  sections?: Array<{ title: string; paragraphs: string[] }>;
  faqs: Array<{ question: string; answer: string }>;
};
