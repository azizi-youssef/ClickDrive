'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Btn } from '@/components/admin/AdminUI';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import type { Agency } from '@/types';
import { updateAdminAgency } from '@/lib/api/admin-dashboard.api';
import { AgencyLogoUploader } from '@/components/agency/settings/AgencyLogoUploader';

const MOROCCAN_CITIES = [
  'Nador',
  'Oujda',
  'Berkane',
  'Al Hoceima',
  'Driouch',
  'Selouane',
  'Zaïo',
  'Taourirt',
  'Guercif',
  'Tanger',
  'Fès',
  'Casablanca',
  'Rabat',
];

interface EditAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agency: Agency | null;
  onSuccess: (updated: Agency) => void;
}

export function EditAgencyModal({
  isOpen,
  onClose,
  agency,
  onSuccess,
}: EditAgencyModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Nador');
  const [latitude, setLatitude] = useState(35.1688);
  const [longitude, setLongitude] = useState(-2.9335);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'PENDING' | 'SUSPENDED'>('ACTIVE');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agency) {
      setName(agency.name);
      setPhone(agency.phone);
      setWhatsapp(agency.whatsapp || agency.phone);
      setAddress(agency.address);
      setCity(agency.city || 'Nador');
      setLatitude(Number(agency.latitude ?? 35.1688));
      setLongitude(Number(agency.longitude ?? -2.9335));
      setEmail(agency.email);
      setStatus((agency.status as any) || 'ACTIVE');
      setDescription(agency.description || '');
      setLogoUrl(agency.logo_url || '');
      setError(null);
    }
  }, [agency]);

  const dialogRef = useModalDialog<HTMLDivElement>(Boolean(isOpen && agency), { onClose, closeDisabled: loading });

  if (!isOpen || !agency) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom de l’agence est requis.');
      return;
    }
    if (!phone.trim()) {
      setError('Le téléphone est requis.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Un email valide est requis.');
      return;
    }

    setLoading(true);

    try {
      const updated = await updateAdminAgency(agency.id, {
        name: name.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        address: address.trim(),
        city: city.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        email: email.trim().toLowerCase(),
        status,
        description: description.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de modification.');
    } finally {
      setLoading(false);
    }
  };

  const emailChanged = email.trim().toLowerCase() !== agency.email.toLowerCase();

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-agency-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 border border-blue-100">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-agency-title" className="text-lg font-bold text-slate-900">Modifier l'agence</h2>
              <p className="text-xs text-slate-500">{agency.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <AgencyLogoUploader
            agencyId={agency.id}
            agencyName={agency.name}
            imageUrl={logoUrl}
            disabled={loading}
            onUploaded={setLogoUrl}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom commercial <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Téléphone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse physique <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ville</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              >
                {MOROCCAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Statut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white font-medium"
              >
                <option value="ACTIVE">Actif (Accès autorisé)</option>
                <option value="SUSPENDED">Suspendu (Accès bloqué)</option>
                <option value="PENDING">En attente d'activation</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse e-mail officielle <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              {emailChanged && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    La modification de cet e-mail sera synchronisée directement avec le compte
                    d'authentification Supabase.
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Btn variant="secondary" type="button" onClick={onClose} disabled={loading}>
              Annuler
            </Btn>
            <Btn variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Enregistrer les modifications
                </>
              )}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
