'use client';

import { ChevronRight, Clock } from 'lucide-react';
import Link from '@/components/i18n/LocalizedLink';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { forgetRecentRequests, liveRecentRequests, recentRequestsStore } from '@/lib/bookings/recent-requests';

/**
 * Demandes envoyées sans compte depuis cet appareil, avec leur lien de suivi. Rien n'est affiché sur un
 * autre appareil, ni au rendu serveur : le bloc apparaît après hydratation s'il y a quelque chose à montrer.
 */
export function RecentRequests({ className }: { className?: string }) {
  const { t, fmt, date } = useTranslation();
  const r = t.tracking?.recent;
  const stored = recentRequestsStore.useValue();
  const items = liveRecentRequests(stored);
  if (!r || items.length === 0) return null;

  return (
    <section aria-labelledby="recent-requests-title" className={cn('rounded-2xl border border-slate-200 bg-white p-4 text-start', className)}>
      <h2 id="recent-requests-title" className="text-sm font-bold text-ink">
        {r.title}
      </h2>
      <p className="mt-0.5 text-xs text-slate-600">{r.text}</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.reference}>
            <Link
              href={item.trackingPath}
              className="flex min-h-12 items-center gap-3 py-2 text-sm hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">{item.vehicle}</span>
                <span className="block text-xs text-slate-600">
                  {fmt(r.line, { reference: item.reference, start: date(item.startDate, 'dayMonth'), end: date(item.endDate, 'dayMonth') })}
                </span>
              </span>
              <span className="text-xs font-bold">{r.open}</span>
              <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={forgetRecentRequests}
        className="mt-2 min-h-11 text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-ink"
      >
        {r.forget}
      </button>
    </section>
  );
}
