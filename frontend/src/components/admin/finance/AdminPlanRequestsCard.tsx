'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminCard, ErrorBanner } from '@/components/admin/AdminUI';
import { formatPrice } from '@/lib/utils';
import type { PlanChangeRequest } from '@/types';

/**
 * Demandes de changement de formule des agences : la nouvelle formule n'est appliquée
 * qu'après réception du paiement, référence du règlement à l'appui.
 */
export function AdminPlanRequestsCard() {
  const [requests, setRequests] = useState<PlanChangeRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [references, setReferences] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/subscription-requests?status=PENDING_PAYMENT', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Chargement impossible');
      setRequests(json.data as PlanChangeRequest[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(request: PlanChangeRequest, decision: 'APPROVED' | 'REJECTED') {
    const paymentReference = (references[request.id] ?? '').trim();
    if (decision === 'APPROVED' && !paymentReference) {
      setError('Indiquez la référence du paiement reçu avant de valider.');
      return;
    }
    setBusyId(request.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/subscription-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id, decision, ...(paymentReference ? { paymentReference } : {}) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Décision non enregistrée');
      setRequests((current) => current?.filter((r) => r.id !== request.id) ?? current);
      setNotice(
        decision === 'APPROVED'
          ? `Formule ${request.requested_plan.name} appliquée à ${request.agency_name ?? 'l’agence'}. Actualisez le tableau des abonnements.`
          : `Demande de ${request.agency_name ?? 'l’agence'} refusée : sa formule actuelle est conservée.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Décision non enregistrée');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminCard title="Demandes de changement de formule">
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {requests === null && !error && <p className="text-sm text-slate-500">Chargement…</p>}
      {requests?.length === 0 && (
        <p className="text-sm text-slate-500">Aucune demande en attente de paiement.</p>
      )}
      {requests && requests.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0B1220]">{request.agency_name ?? 'Agence'}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {request.current_plan_name ?? 'Sans formule'} → <strong>{request.requested_plan.name}</strong> ·{' '}
                  {formatPrice(request.amount_due)} / mois · demandé le{' '}
                  {new Date(request.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`payment-${request.id}`}>
                  Référence du paiement de {request.agency_name ?? 'l’agence'}
                </label>
                <input
                  id={`payment-${request.id}`}
                  value={references[request.id] ?? ''}
                  onChange={(e) => setReferences((current) => ({ ...current, [request.id]: e.target.value }))}
                  placeholder="Référence du virement"
                  maxLength={120}
                  className="h-10 w-48 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => void decide(request, 'APPROVED')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0B1220] px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busyId === request.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  Paiement reçu : appliquer
                </button>
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => void decide(request, 'REJECTED')}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Refuser
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
