import { Calendar, Car, MapPin, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Résumé d'une recherche en pastilles séparées : [Lieu] [Dates · durée] [Catégorie].
 * Chaque pastille est un élément distinct (jamais de texte collé « …(NDR)Tous les types ») et les
 * lecteurs d'écran entendent une virgule entre elles.
 */
function Chip({ icon: Icon, children, last = false }: { icon: LucideIcon; children: React.ReactNode; last?: boolean }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[13px] font-semibold leading-4 text-ink">
      <Icon className="h-3.5 w-3.5 shrink-0 text-accent-text" aria-hidden="true" />
      <span className="min-w-0 truncate">{children}</span>
      {!last && <span className="sr-only">, </span>}
    </span>
  );
}

export function SearchSummaryChips({
  location,
  dates,
  category,
  action,
  prefix,
  className,
}: {
  /** Libellé du lieu, déjà traduit */
  location: string;
  /** Dates et durée déjà mises en forme (« 30 nov. → 3 déc. · 3 jours ») */
  dates: string;
  /** Libellé de la catégorie, déjà traduit */
  category: string;
  /** Texte placé avant les pastilles (ex. intitulé réservé aux lecteurs d'écran) */
  prefix?: React.ReactNode;
  /** Libellé « Modifier » placé à la suite des pastilles (il passe à la ligne avec elles) */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      {prefix}
      <Chip icon={MapPin}>{location}</Chip>
      <Chip icon={Calendar}>{dates}</Chip>
      <Chip icon={Car} last>
        {category}
      </Chip>
      {action}
    </span>
  );
}
