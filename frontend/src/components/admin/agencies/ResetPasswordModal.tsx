'use client';

import React, { useState } from 'react';
import {
  X,
  KeyRound,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { Btn } from '@/components/admin/AdminUI';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import type { Agency } from '@/types';
import { resetAgencyPassword } from '@/lib/api/admin-dashboard.api';
import { generateTemporaryPassword } from '@/lib/utils/agency-credentials';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: Agency | null;
  onSuccess: (credentials: { email: string; temporaryPassword: string; agencyName: string }) => void;
}

export function ResetPasswordModal({
  isOpen,
  onClose,
  agency,
  onSuccess,
}: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useModalDialog<HTMLDivElement>(Boolean(isOpen && agency), { onClose, closeDisabled: loading });

  if (!isOpen || !agency) return null;

  const handleGenerate = () => {
    setPassword(generateTemporaryPassword(14));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const creds = await resetAgencyPassword(agency.id, password.trim() || undefined);
      onSuccess(creds);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm motion-safe:animate-cd-fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 motion-safe:animate-cd-slide-up overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 border border-amber-100">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 id="reset-password-title" className="text-base font-bold text-slate-900">Réinitialiser le mot de passe</h2>
              <p className="text-xs text-slate-500">{agency.name}</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <strong>Agence :</strong> {agency.name}
            </div>
            <div>
              <strong>Compte d'accès :</strong>{' '}
              <span className="font-mono text-slate-900">{agency.email}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Nouveau mot de passe temporaire
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                <span>Générer automatiquement</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Laisser vide pour générer aléatoirement"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm font-mono text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Le nouveau mot de passe remplacera immédiatement l'ancien dans Supabase Auth.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Btn variant="secondary" type="button" onClick={onClose} disabled={loading}>
              Annuler
            </Btn>
            <Btn variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Réinitialiser
                </>
              )}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
