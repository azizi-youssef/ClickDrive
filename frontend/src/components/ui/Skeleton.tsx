import { cn } from '@/lib/utils';

/**
 * Bloc de chargement du design system (classe .skeleton de globals.css : reflet discret,
 * figé quand l'utilisateur réduit les animations). Décoratif : masqué aux lecteurs d'écran,
 * l'état « chargement » s'annonce sur le conteneur (aria-busy) ou par un texte dédié.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-lg', className)} />;
}
