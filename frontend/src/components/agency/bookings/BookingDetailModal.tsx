'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, XCircle } from 'lucide-react';
import { canPerformAgencyBookingAction } from '@clickdrive/shared';
import { cn } from '@/lib/utils';
import { button } from '@/lib/design/tokens';
import { Modal } from '@/components/agency/shell/Dialog';
import {
  bookingReference,
  money,
  type AgencyBookingRow,
} from './BookingsPanel';
import { StatusBadge } from '@/components/ui/StatusBadge';

export type BookingEvent = {
  id: string;
  event_type: string;
  actor_role: string | null;
  created_at: string;
};

export type BookingDetail = AgencyBookingRow & {
  pickup_time?: string | null;
  dropoff_time?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  total_days?: number | null;
  events?: BookingEvent[];
};

export type BookingAction = 'approve' | 'reject' | 'propose_alternative';

/**
 * Transitions autorisées par la machine à états partagée.
 * Le composant ne décide jamais d'une transition : il consulte @clickdrive/shared.
 */
export function allowedActions(status: string): BookingAction[] {
  const actions: BookingAction[] = [];
  if (canPerformAgencyBookingAction(status, 'approve')) actions.push('approve');
  if (canPerformAgencyBookingAction(status, 'reject')) actions.push('reject');
  if (canPerformAgencyBookingAction(status, 'propose_alternative')) {
    actions.push('propose_alternative');
  }
  return actions;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="shrink-0 text-sm text-[#64748B]">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-[#0F172A]">{value}</dd>
    </div>
  );
}

export function BookingDetailModal({
  booking,
  detail,
  loadingDetail,
  detailError,
  canAct,
  busy,
  alternatives,
  loadingAlternatives,
  onClose,
  onReload,
  onAction,
  onDownloadPdf,
}: {
  booking: BookingDetail;
  detail: BookingDetail | null;
  loadingDetail: boolean;
  detailError: string | null;
  canAct: boolean;
  busy: boolean;
  alternatives: readonly { id: string; brand: string; model: string; daily_price: number }[];
  loadingAlternatives: boolean;
  onClose: () => void;
  onReload: () => void;
  onAction: (action: BookingAction, payload: { reason?: string; alternativeVehicleId?: string }) => void;
  onDownloadPdf: () => void;
}) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [alternativeId, setAlternativeId] = useState('');
  const [pending, setPending] = useState<BookingAction | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setReason('');
    setReasonError(null);
    setAlternativeId('');
    setPending(null);
  }, [booking.id]);

  const actions = useMemo(() => allowedActions(booking.status), [booking.status]);
  const loaded = detail ?? booking;
  const events = detail?.events ?? [];

  const submit = (action: BookingAction) => {
    // Motif obligatoire : le bouton reste actif et conduit au champ manquant,
    // au lieu d'être grisé sans explication (le champ est plus haut dans le dossier).
    if (action === 'reject' && !reason.trim()) {
      setReasonError('Indiquez le motif du refus : il sera transmis au client.');
      reasonRef.current?.scrollIntoView({ block: 'center' });
      reasonRef.current?.focus({ preventScroll: true });
      return;
    }
    setPending(action);
    onAction(action, {
      reason: action === 'reject' ? reason : undefined,
      alternativeVehicleId: action === 'propose_alternative' ? alternativeId : undefined,
    });
  };

  return (
    <Modal
      title={`Dossier ${bookingReference(loaded)}`}
      description={`${loaded.customer_name} - ${loaded.vehicle ? `${loaded.vehicle.brand} ${loaded.vehicle.model}` : 'Vehicule'}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={button.secondary} onClick={onClose} disabled={busy}>
            Fermer
          </button>
          <button type="button" className={button.secondary} onClick={onDownloadPdf} disabled={busy}>
            <FileText aria-hidden="true" className="h-4 w-4" />
            Telecharger le PDF
          </button>
          {canAct && actions.includes('reject') && (
            <button
              type="button"
              className={button.danger}
              onClick={() => submit('reject')}
              disabled={busy}
            >
              {busy && pending === 'reject' ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle aria-hidden="true" className="h-4 w-4" />
              )}
              Refuser
            </button>
          )}
          {canAct && actions.includes('approve') && (
            <button
              type="button"
              className={button.primary}
              onClick={() => submit('approve')}
              disabled={busy}
            >
              {busy && pending === 'approve' ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              )}
              Approuver
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {detailError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {detailError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={loaded.status} audience="business" />
          <button
            type="button"
            onClick={onReload}
            className="text-xs font-medium text-[#64748B] underline hover:text-[#0F172A]"
          >
            Rafraichir le dossier
          </button>
          {loadingDetail && (
            <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
              Chargement...
            </span>
          )}
        </div>

        <section>
          <h3 className="mb-2 text-sm font-bold text-[#0F172A]">Location</h3>
          <dl>
            <Row label="Periode" value={`${loaded.start_date} -> ${loaded.end_date}`} />
            {typeof loaded.total_days === 'number' && (
              <Row label="Duree" value={`${loaded.total_days} jour(s)`} />
            )}
            {loaded.pickup_time && <Row label="Heure de depart" value={loaded.pickup_time} />}
            {loaded.dropoff_time && <Row label="Heure de retour" value={loaded.dropoff_time} />}
            {loaded.pickup_location && <Row label="Lieu de depart" value={loaded.pickup_location} />}
            {loaded.dropoff_location && <Row label="Lieu de retour" value={loaded.dropoff_location} />}
          </dl>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-[#0F172A]">Montants</h3>
          <dl>
            <Row label="Montant total" value={money(loaded.total_price)} />
            <Row
              label={`Taux de commission${loaded.commission_rate ? ` (${loaded.commission_rate} %)` : ''}`}
              value={money(loaded.commission_amount)}
            />
            <Row label="Net agence" value={money(loaded.agency_amount)} />
          </dl>
          <p className="mt-2 text-xs text-[#64748B]">
            Montants et taux figes au moment de la demande. Le taux global de la plateforme ne peut
            pas etre modifie par l'agence.
          </p>
        </section>

        {canAct && actions.includes('reject') && (
          <section>
            <label htmlFor="reject-reason" className="mb-1.5 block text-sm font-bold text-[#0F172A]">
              Motif du refus <span className="font-normal text-accent-text">(obligatoire)</span>
            </label>
            <textarea
              ref={reasonRef}
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (event.target.value.trim()) setReasonError(null);
              }}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? 'reject-reason-error' : undefined}
              placeholder="Expliquez au client pourquoi la demande ne peut pas être acceptée."
              className={cn(
                'w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#E63946] focus:ring-2 focus:ring-[#E63946]/25',
                reasonError ? 'border-[#E63946] bg-[#FFF6F7]' : 'border-slate-300'
              )}
            />
            {reasonError && (
              <p id="reject-reason-error" role="alert" className="mt-1.5 text-sm font-medium text-red-700">
                {reasonError}
              </p>
            )}
          </section>
        )}

        {canAct && actions.includes('propose_alternative') && (
          <section>
            <h3 className="mb-1.5 text-sm font-bold text-[#0F172A]">Proposer une alternative</h3>
            <p className="mb-2 text-xs text-[#64748B]">
              Seuls vos vehicules disponibles sur cette periode sont proposes.
            </p>
            {loadingAlternatives ? (
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ) : alternatives.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#64748B]">
                Aucun vehicule de remplacement disponible sur ces dates.
              </p>
            ) : (
              <div className="space-y-2">
                {alternatives.map((vehicle) => (
                  <label
                    key={vehicle.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
                      alternativeId === vehicle.id
                        ? 'border-[#E63946] bg-[#E63946]/5'
                        : 'border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="alternative"
                      value={vehicle.id}
                      checked={alternativeId === vehicle.id}
                      onChange={() => setAlternativeId(vehicle.id)}
                      className="h-4 w-4 accent-[#E63946]"
                    />
                    <span className="min-w-0 flex-1 text-sm font-medium text-[#0F172A]">
                      {vehicle.brand} {vehicle.model}
                    </span>
                    <span className="text-sm tabular-nums text-[#64748B]">
                      {money(vehicle.daily_price)} / jour
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  className={button.primary}
                  onClick={() => submit('propose_alternative')}
                  disabled={busy || !alternativeId}
                >
                  {busy && pending === 'propose_alternative' ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : null}
                  Proposer une alternative
                </button>
              </div>
            )}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-bold text-[#0F172A]">Historique</h3>
          {events.length === 0 ? (
            <p className="text-sm text-[#64748B]">Aucun evenement enregistre pour ce dossier.</p>
          ) : (
            <ol className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-[#0F172A]">{event.event_type}</span>
                    {event.actor_role && (
                      <span className="text-[#64748B]"> - {event.actor_role}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[#64748B]">
                    {new Date(event.created_at).toLocaleString('fr-FR')}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}
