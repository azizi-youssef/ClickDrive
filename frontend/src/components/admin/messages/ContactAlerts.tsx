'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BellOff, BellRing, Inbox, X } from 'lucide-react';
import { Btn } from '@/components/admin/AdminUI';
import { contactAlertText } from '@/lib/admin/contact-alerts';
import {
  dismissContactAlert,
  requestBrowserAlertPermission,
  useBrowserAlertPermission,
  useContactAlerts,
} from './contact-alerts-store';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Bandeau affiché sur toutes les pages de l'administration à l'arrivée d'un message de contact.
 * Il reste visible jusqu'à ce que l'administrateur l'ouvre ou le ferme.
 */
export function ContactAlertToast() {
  const { pending } = useContactAlerts();
  const latest = pending?.reduce((a, b) => (Date.parse(b.created_at) > Date.parse(a.created_at) ? b : a));
  const text = pending && pending.length > 0 ? contactAlertText(pending) : null;

  return (
    // Région annoncée par les lecteurs d'écran ; vide, elle ne gêne aucun clic
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-end sm:inset-x-auto sm:bottom-6 sm:end-6">
      {text && latest && pending && (
        <div className="pointer-events-auto w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-20px_rgba(11,18,32,0.45)] sm:w-96">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E63946]/10 text-[#B4232F]">
              <Inbox className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-[#0B1220]">{text.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{text.body}</p>
              <p className="mt-1 text-xs text-slate-500">
                {pending.length === 1 && <span className="font-mono">{latest.reference} · </span>}
                {formatDateTime(latest.created_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissContactAlert}
              aria-label="Fermer l’alerte"
              className="-me-1.5 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 outline-none transition-colors hover:bg-[#F5F6F8] hover:text-[#0B1220] focus-visible:ring-2 focus-visible:ring-[#0B1220]/30"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <Link
              href="/admin/messages"
              onClick={dismissContactAlert}
              className="inline-flex min-h-9 items-center rounded-lg bg-[#0B1220] px-3 text-xs font-bold text-white outline-none transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-[#E63946]/60"
            >
              {pending.length > 1 ? 'Voir les messages' : 'Voir le message'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Active les notifications du navigateur, utiles quand l'onglet du tableau de bord est en arrière-plan */
export function BrowserAlertsToggle() {
  const permission = useBrowserAlertPermission();
  const [asking, setAsking] = useState(false);

  if (permission === 'unsupported') return null;

  if (permission === 'granted') {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <BellRing className="h-4 w-4" aria-hidden="true" />
        Alertes du navigateur activées
      </span>
    );
  }

  if (permission === 'denied') {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 text-xs text-slate-500">
        <BellOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        Alertes du navigateur bloquées : autorisez les notifications de ce site dans les réglages du navigateur.
      </span>
    );
  }

  return (
    <Btn
      size="sm"
      variant="secondary"
      loading={asking}
      onClick={async () => {
        setAsking(true);
        try {
          await requestBrowserAlertPermission();
        } finally {
          setAsking(false);
        }
      }}
    >
      <BellRing className="h-4 w-4" aria-hidden="true" />
      Recevoir aussi une alerte du navigateur
    </Btn>
  );
}
