'use client';

import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Contrôles du design system : hauteur 44 px, bordure line-strong, focus graphite, état invalide explicite,
   texte indicatif slate-500 (4,97:1 ; slate-400 ne faisait que 2,58:1) */
const CONTROL =
  'w-full min-h-11 rounded-xl border bg-surface px-3.5 text-body text-ink outline-none transition-[border-color,box-shadow] duration-fast placeholder:text-slate-500 hover:border-slate-400 focus:border-ink focus:ring-4 focus:ring-ink/8 disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-disabled sm:text-sm motion-reduce:transition-none';

function controlClasses(invalid: boolean | undefined, className?: string) {
  return cn(
    CONTROL,
    invalid ? 'border-danger bg-danger-soft/40 focus:border-danger focus:ring-danger/15' : 'border-line-strong',
    className
  );
}

type ControlExtras = { invalid?: boolean };

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & ControlExtras>(
  function Input({ invalid, className, ...props }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={controlClasses(invalid, className)} {...props} />;
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & ControlExtras>(
  function Select({ invalid, className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={controlClasses(invalid, cn('cursor-pointer pe-9', className))}
        {...props}
      >
        {children}
      </select>
    );
  }
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras
>(function Textarea({ invalid, className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, cn('min-h-28 py-3 leading-relaxed', className))}
      {...props}
    />
  );
});

/** Attributs à transmettre au contrôle pour le relier à son libellé, son aide et son erreur. */
export type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  invalid?: boolean;
  required?: boolean;
};

/**
 * Champ de formulaire accessible : le libellé est relié au contrôle (htmlFor/id),
 * l'aide et l'erreur sont annoncées via aria-describedby.
 * Usage : <Field label="E-mail" error={e}>{(p) => <Input type="email" {...p} />}</Field>
 */
export function Field({
  label,
  hint,
  error,
  required,
  id: providedId,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  id?: string;
  className?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-label text-ink">
        {label}
        {required && (
          <span className="text-accent-text" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        invalid: Boolean(error),
        required,
      })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-label font-medium text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-label font-normal text-ink-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
