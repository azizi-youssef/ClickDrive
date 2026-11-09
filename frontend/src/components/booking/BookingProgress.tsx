import { Check, X } from 'lucide-react';
import { PROGRESS_TEXT, bookingNextStepHint, bookingStatusLabel, bookingTimeline } from '@/lib/bookings/status';
import type { Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

/** Étapes de la demande (statuts réels), de l'envoi à la restitution — sans état client */
export function BookingProgress({ status, locale = 'fr', headingId }: { status: string; locale?: Locale; headingId: string }) {
  const timeline = bookingTimeline(status, locale);
  const nextStep = bookingNextStepHint(status, locale);
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-sm font-bold text-ink">
        {PROGRESS_TEXT.heading[locale]}
      </h2>
      {nextStep && <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{nextStep}</p>}
      <ol className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {timeline.map((step, index) => (
          <li
            key={step.key}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3 sm:flex-col sm:items-start sm:gap-2',
              step.state === 'done' && 'border-success-line bg-success-soft',
              step.state === 'current' && 'border-ink bg-surface ring-2 ring-ink/10',
              step.state === 'stopped' && 'border-danger-line bg-danger-soft',
              step.state === 'upcoming' && 'border-line bg-canvas'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                step.state === 'done' && 'bg-success text-white',
                step.state === 'current' && 'bg-ink text-white',
                step.state === 'stopped' && 'bg-danger text-white',
                step.state === 'upcoming' && 'bg-surface text-ink-secondary ring-1 ring-line-strong'
              )}
            >
              {step.state === 'done' ? <Check className="h-4 w-4" /> : step.state === 'stopped' ? <X className="h-4 w-4" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-[13px] font-bold leading-snug', step.state === 'upcoming' ? 'text-ink-secondary' : 'text-ink')}>
                {step.label}
              </span>
              <span className="block text-xs text-ink-secondary">
                {step.state === 'stopped' ? bookingStatusLabel(status, locale) : PROGRESS_TEXT[step.state][locale]}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
