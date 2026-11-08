'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  Copy,
  Check,
  ShieldAlert,
  ExternalLink,
  X,
  Share2,
  Lock,
  Mail,
} from 'lucide-react';
import { Btn } from '@/components/admin/AdminUI';
import { useModalDialog } from '@/lib/a11y/useModalDialog';

interface AgencyCredentialsSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: {
    email: string;
    temporaryPassword: string;
    agencyName: string;
    manager_name?: string;
    loginUrl?: string;
  } | null;
}

export function AgencyCredentialsSuccessModal({
  isOpen,
  onClose,
  credentials,
}: AgencyCredentialsSuccessModalProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const dialogRef = useModalDialog<HTMLDivElement>(Boolean(isOpen && credentials), { onClose });

  if (!isOpen || !credentials) return null;

  const copyToClipboard = (text: string, type: 'email' | 'password' | 'all') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else if (type === 'password') {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const fullMessage = `🚗 Accès Partenaire ClickDrive — ${credentials.agencyName}

Bonjour ${credentials.manager_name || 'Monsieur/Madame'},
Votre agence a été configurée avec succès sur la marketplace ClickDrive.

Voici vos identifiants de connexion officiels :
• E-mail : ${credentials.email}
• Mot de passe temporaire : ${credentials.temporaryPassword}
• Portail de connexion : https://clickdrive.ma/login?portal=agency

Pour votre sécurité, nous vous invitons à modifier votre mot de passe dès votre première connexion.
Équipe ClickDrive — Nador & Oriental`;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-credentials-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5 bg-emerald-50/70 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-500 p-2 text-white shadow-sm">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 id="agency-credentials-title" className="text-base font-bold text-slate-900">
                Compte agence opérationnel !
              </h3>
              <p className="text-xs text-slate-600">
                L'agence <strong>{credentials.agencyName}</strong> a été enregistrée avec succès.
              </p>
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
        <div className="p-6 space-y-5">
          {/* Security alert */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Information de sécurité importante :</strong>
              <p className="mt-0.5 text-amber-800">
                Ce mot de passe temporaire ne sera plus jamais affiché. Veuillez le transmettre
                directement au responsable de l'agence ou le conserver dans votre gestionnaire de clés.
              </p>
            </div>
          </div>

          {/* Credentials Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-4 space-y-3.5">
            {/* Email Row */}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Identifiant de connexion
              </span>
              <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="font-mono text-sm text-slate-900 truncate">
                    {credentials.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentials.email, 'email')}
                  className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 transition border border-slate-200"
                >
                  {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedEmail ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Password Row */}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Mot de passe temporaire
              </span>
              <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="font-mono text-sm font-semibold text-slate-900 tracking-wider">
                    {credentials.temporaryPassword}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentials.temporaryPassword, 'password')}
                  className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 transition border border-slate-200"
                >
                  {copiedPassword ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedPassword ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Portal Link */}
            <div className="pt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>Portail de connexion :</span>
              <a
                href="/login?portal=agency"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium"
              >
                <span>/login?portal=agency</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => copyToClipboard(fullMessage, 'all')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
          >
            {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copiedAll ? 'Message copié !' : 'Copier tout le message'}</span>
          </button>

          <Btn variant="primary" onClick={onClose}>
            Terminer
          </Btn>
        </div>
      </div>
    </div>
  );
}
