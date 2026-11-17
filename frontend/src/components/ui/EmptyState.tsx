import React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * État vide du design system : pictogramme, titre, explication et action facultative.
 * `titleAs` garde la sémantique de l'appelant : un état vide n'est en général pas un titre
 * (`p`, par défaut) ; une liste titrée de l'administration peut demander `h3`.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  titleAs: Title = 'p',
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  titleAs?: 'p' | 'h2' | 'h3' | 'h4';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-soft text-slate-400">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <Title className="mt-4 text-body font-bold text-ink">{title}</Title>
      {description && <p className="mt-1 max-w-sm text-support text-ink-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
