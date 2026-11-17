/**
 * Recettes de classes du portail agence ClickDrive.
 * Les couleurs, ombres et tailles viennent toutes des jetons de src/app/globals.css (@theme) :
 * aucune valeur hexadécimale ici, pour qu'un réglage de la marque se fasse à un seul endroit.
 */

/** Indicateur de focus clavier commun : contour rouge de marque décalé de 2 px (visible aussi en contraste élevé). */
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Échelle des titres (espace agence et écrans Statistiques) : un style par rôle, une seule couleur.
 *   page    — h1, un seul par écran ;
 *   dialog  — h2, titre d'une fenêtre ou d'un panneau ;
 *   block   — titre d'une carte ou d'une section (h2 sous le titre de page, h3 dans une liste titrée) ;
 *   sub     — sous-titre à l'intérieur d'un bloc (h3, ou h4 dans une fenêtre) ;
 *   eyebrow — étiquette en capitales au-dessus d'une valeur ou d'un titre, libellé de champ, en-tête
 *             de tableau : jamais une balise de titre ; couleur ajoutée par l'appelant (`eyebrowMuted` : gris).
 * Le niveau suit la structure de la page ; le style suit le rôle. Une valeur (nom de client, de
 * véhicule), un indicateur ou un état vide n'est pas un titre.
 */
export const heading = {
  page: 'text-2xl font-extrabold tracking-tight text-ink sm:text-[32px]',
  dialog: 'text-lg font-extrabold tracking-tight text-ink',
  block: 'text-[15px] font-extrabold leading-snug text-ink',
  sub: 'text-sm font-bold text-ink',
} as const;

export const eyebrow = 'text-xs font-semibold uppercase tracking-[0.08em]';
export const eyebrowMuted = `${eyebrow} text-slate-500`;

/** Classes Tailwind reutilisables (bordures, etats, focus). */
export const shell = {
  page: 'min-h-screen bg-canvas text-ink',
  sidebar: 'bg-ink text-white',
  card: 'rounded-2xl border border-slate-200/80 bg-white shadow-card',
  cardPad: 'p-5 sm:p-6',
  heading: 'text-lg font-bold tracking-tight text-ink',
  subtle: 'text-sm text-ink-secondary',
  focusRing,
} as const;

/** Mêmes variantes que <Button> (components/ui/Button.tsx), aux hauteurs compactes du portail. */
export const button = {
  primary: `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-action px-4 py-2.5 text-sm font-bold text-white shadow-action transition-colors hover:bg-action-hover ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none`,
  secondary: `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-slate-300 hover:bg-slate-50 ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`,
  ghost: `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink ${focusRing} disabled:opacity-50`,
  danger: `inline-flex items-center justify-center gap-2 rounded-xl border border-danger-line bg-white px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft ${focusRing} disabled:opacity-50`,
} as const;

/** Champ de saisie. Texte indicatif en slate-500 (4,97:1) : slate-400 ne faisait que 2,58:1. */
export const input =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-slate-500 hover:border-slate-300 focus:border-ink focus:ring-4 focus:ring-ink/8 disabled:bg-slate-100 disabled:text-slate-500';

/** Presets de periode pour les filtres du dashboard. */
export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'ytd' | 'all';

export const RANGE_PRESETS: readonly { value: RangePreset; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: 'ytd', label: 'Cette année' },
  { value: 'all', label: 'Tout' },
] as const;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Convertit un preset en bornes [from, to] (bornes exclues = non definies). */
export function resolveRange(preset: RangePreset): { from?: string; to?: string } {
  if (preset === 'all') return {};
  const now = new Date();
  if (preset === 'today') return { from: isoDate(now), to: isoDate(now) };
  if (preset === 'ytd') return { from: `${now.getFullYear()}-01-01`, to: isoDate(now) };
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return { from: isoDate(start), to: isoDate(now) };
}
