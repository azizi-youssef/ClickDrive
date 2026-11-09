'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox, Mail, Phone } from 'lucide-react';
import { AdminCard, EmptyState, ErrorBanner, SelectFilter, StatusBadge } from '@/components/admin/AdminUI';
import { CONTACT_CATEGORY_LABELS } from '@/lib/email/templates';
import { CONTACT_MESSAGES_ARRIVED_EVENT } from '@/lib/admin/contact-alerts';
import { BrowserAlertsToggle } from './ContactAlerts';
import { notifyContactMessagesChanged } from './contact-alerts-store';

type ContactMessage = {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  category: string;
  subject: string | null;
  message: string;
  status: 'NEW' | 'IN_PROGRESS' | 'CLOSED';
  team_notified_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<ContactMessage['status'], string> = {
  NEW: 'Nouveau',
  IN_PROGRESS: 'En cours',
  CLOSED: 'Clos',
};
const STATUS_VARIANT = { NEW: 'warning', IN_PROGRESS: 'info', CLOSED: 'neutral' } as const;

const FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'NEW', label: 'Nouveaux' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'CLOSED', label: 'Clos' },
];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Boîte de réception du formulaire /contact : lecture, réponse par e-mail, suivi du traitement */
export function AdminContactMessagesClient() {
  const [filter, setFilter] = useState('');
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    try {
      const res = await fetch(`/api/admin/contact-messages${status ? `?status=${status}` : ''}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Chargement impossible');
      setMessages(json.data as ContactMessage[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    }
  }, []);

  useEffect(() => {
    void load(filter);
    // Un message vient d'arriver (détecté par la surveillance du tableau de bord) : il s'ajoute à la liste
    const onArrived = () => void load(filter);
    window.addEventListener(CONTACT_MESSAGES_ARRIVED_EVENT, onArrived);
    return () => window.removeEventListener(CONTACT_MESSAGES_ARRIVED_EVENT, onArrived);
  }, [filter, load]);

  async function setStatus(message: ContactMessage, status: ContactMessage['status']) {
    setUpdating(message.id);
    try {
      const res = await fetch('/api/admin/contact-messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: message.id, status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Mise à jour impossible');
      setMessages((current) => current?.map((m) => (m.id === message.id ? { ...m, status } : m)) ?? current);
      notifyContactMessagesChanged(); // compteur du menu à jour sans attendre
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {messages ? `${messages.length} message${messages.length > 1 ? 's' : ''}` : 'Chargement…'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <BrowserAlertsToggle />
          <SelectFilter value={filter} onChange={setFilter} options={FILTERS} />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Une alerte s’affiche dans l’administration dès qu’un message arrive. Le compteur du menu « Messages » indique les
        messages non encore pris en charge.
      </p>

      {error && <ErrorBanner message={error} onRetry={() => void load(filter)} />}

      {messages && messages.length === 0 && (
        <AdminCard>
          <EmptyState icon={Inbox} title="Aucun message" description="Les messages envoyés depuis la page Contact apparaîtront ici." />
        </AdminCard>
      )}

      <ul className="space-y-3">
        {messages?.map((message) => (
          <li key={message.id}>
            <AdminCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge variant={STATUS_VARIANT[message.status]}>{STATUS_LABELS[message.status]}</StatusBadge>
                    <span className="font-mono text-xs text-slate-500">{message.reference}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(message.created_at)}</span>
                  </div>
                  <h3 className="mt-2 text-[15px] font-extrabold text-[#0B1220]">
                    {message.subject || CONTACT_CATEGORY_LABELS[message.category] || message.category}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {message.name} · {CONTACT_CATEGORY_LABELS[message.category] ?? message.category}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {message.status !== 'IN_PROGRESS' && message.status !== 'CLOSED' && (
                    <button
                      type="button"
                      disabled={updating === message.id}
                      onClick={() => void setStatus(message, 'IN_PROGRESS')}
                      className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Prendre en charge
                    </button>
                  )}
                  {message.status !== 'CLOSED' ? (
                    <button
                      type="button"
                      disabled={updating === message.id}
                      onClick={() => void setStatus(message, 'CLOSED')}
                      className="inline-flex min-h-9 items-center rounded-lg bg-[#0B1220] px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Marquer comme traité
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={updating === message.id}
                      onClick={() => void setStatus(message, 'NEW')}
                      className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Rouvrir
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-line rounded-xl bg-[#F5F6F8] p-3 text-sm leading-6 text-slate-700">{message.message}</p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                <a
                  href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject || 'Votre message'} (${message.reference})`)}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#0B1220] underline-offset-4 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {message.email}
                </a>
                {message.phone && (
                  <a href={`tel:${message.phone.replace(/[^+0-9]/g, '')}`} className="inline-flex items-center gap-1.5 font-semibold text-[#0B1220] underline-offset-4 hover:underline">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {message.phone}
                  </a>
                )}
                <span>
                  Équipe prévenue : {message.team_notified_at ? 'oui' : 'non'} · Accusé de réception : {message.acknowledged_at ? 'envoyé' : 'non envoyé'}
                </span>
              </div>
            </AdminCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
