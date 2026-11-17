'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Archive,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Car,
  CheckCircle,
} from 'lucide-react';
import { Btn } from '@/components/admin/AdminUI';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import type { AdminAgency } from '@/lib/api/admin-dashboard.api';
import { deleteAdminAgency } from '@/lib/api/admin-dashboard.api';

interface DeleteAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: AdminAgency | null;
  onSuccess: (result: { mode: 'archived' | 'deleted'; message: string }) => void;
}

export function DeleteAgencyModal({
  isOpen,
  onClose,
  agency,
  onSuccess,
}: DeleteAgencyModalProps) {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmationInput('');
      setError(null);
    }
  }, [isOpen, agency?.id]);

  const dialogRef = useModalDialog<HTMLDivElement>(Boolean(isOpen && agency), { onClose, closeDisabled: loading });

  if (!isOpen || !agency) return null;

  const hasBookings = (agency.booking_count ?? 0) > 0;
  const isMatch = confirmationInput.trim().toLowerCase() === agency.name.trim().toLowerCase();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch) {
      setError(`Veuillez saisir ou cliquer sur le nom exact "${agency.name}" pour confirmer.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await deleteAdminAgency(agency.id, confirmationInput.trim());
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-agency-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm motion-safe:animate-cd-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 motion-safe:animate-cd-slide-up overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-red-50/70">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-100 p-2 text-red-600">
              {hasBookings ? <Archive className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="delete-agency-title" className="text-base font-bold text-red-900">
                {hasBookings ? 'Archivage de l’agence' : 'Suppression définitive de l’agence'}
              </h2>
              <p className="text-xs text-red-700 font-medium">{agency.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleDelete} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dependencies Box */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <div>
                <span className="text-slate-500 block">Réservations :</span>
                <span className="font-semibold text-slate-900">
                  {agency.booking_count ?? 0} historique(s)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-slate-400" />
              <div>
                <span className="text-slate-500 block">Véhicules :</span>
                <span className="font-semibold text-slate-900">
                  {agency.vehicle_count == null ? 'Nombre non transmis' : `${agency.vehicle_count} véhicule(s)`}
                </span>
              </div>
            </div>
          </div>

          {/* Impact message */}
          {hasBookings ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-1">
              <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
                <span>Règle d'intégrité comptable & contractuelle :</span>
              </p>
              <p className="text-amber-800 leading-relaxed">
                Cette agence possède des réservations enregistrées. Pour préserver les factures,
                commissions et preuves contractuelles, <strong>l'agence sera archivée et suspendue</strong>,
                ses accès seront immédiatement révoqués, mais ses données historiques resteront
                consultables.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-900 space-y-1">
              <p className="font-semibold text-red-950 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>Suppression irréversible :</span>
              </p>
              <p className="text-red-800 leading-relaxed">
                Cette agence ne possède aucune réservation. L'agence, ses véhicules et son compte
                d'accès Supabase Auth seront <strong>définitivement supprimés</strong> de la plateforme.
              </p>
            </div>
          )}

          {/* Confirmation input */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Pour confirmer, confirmez le nom :
              </label>
              <button
                type="button"
                onClick={() => setConfirmationInput(agency.name)}
                className="text-[11px] font-semibold text-red-600 hover:text-red-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Copier & insérer "{agency.name}"
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                required
                placeholder={`Tapez "${agency.name}" pour confirmer`}
                value={confirmationInput}
                onChange={(e) => {
                  setConfirmationInput(e.target.value);
                  if (error) setError(null);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition ${
                  isMatch
                    ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500'
                    : 'border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                }`}
              />
              {isMatch && (
                <div className="absolute right-3 top-2.5 text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                </div>
              )}
            </div>

            {/* Helper status text */}
            {isMatch ? (
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Nom vérifié. Cliquez sur le bouton ci-dessous pour exécuter la suppression.</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  Recopiez <strong className="text-red-700 font-mono select-all">{agency.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmationInput(agency.name)}
                  className="text-red-600 hover:underline font-semibold"
                >
                  Remplir automatiquement
                </button>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Btn variant="secondary" type="button" onClick={onClose} disabled={loading}>
              Annuler
            </Btn>
            <Btn
              variant="danger"
              type="submit"
              onClick={handleDelete}
              disabled={loading}
              className={!isMatch ? 'opacity-60 cursor-pointer' : ''}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : hasBookings ? (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver l'agence
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer définitivement
                </>
              )}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
