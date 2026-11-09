import React from 'react';
import Link from '@/components/i18n/LocalizedLink';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bouton du design system. Variantes :
 * - primary : action principale (rouge d'action accessible, texte blanc 5,3:1)
 * - dark : action forte sur fond clair (graphite)
 * - secondary : action secondaire (surface blanche bordée)
 * - ghost : action tertiaire, sans fond
 * - danger : action destructive (rouge d'erreur, contour)
 */
export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-action text-white shadow-[0_10px_20px_-12px_rgba(201,47,59,0.75)] hover:bg-action-hover',
  dark: 'bg-ink text-white hover:bg-[#1A2333]',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-[#98A2B3] hover:bg-canvas',
  ghost: 'text-ink-tertiary hover:bg-neutral-soft hover:text-ink',
  danger: 'border border-danger-line bg-surface text-danger hover:bg-danger-soft',
};

/* Hauteurs : 36 / 44 / 48 px — 44 px minimum pour les actions tactiles principales */
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-[13px]',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-6 text-[15px]',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold outline-none transition-[background-color,border-color,color,box-shadow,scale] duration-200',
    'focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
    'active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className
  );
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Icône avant le libellé (masquée pendant le chargement) */
  icon?: React.ReactNode;
};

type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, loading = false, icon, className, children, disabled, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

type ButtonLinkProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

/** Lien stylé comme un bouton (navigation interne via next/link). */
export function ButtonLink({ variant, size, fullWidth, icon, className, children, href, ...props }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
