'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  MapPin,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Phone,
  User,
  Globe,
  Compass,
} from 'lucide-react';
import { Btn } from '@/components/admin/AdminUI';
import { useModalDialog } from '@/lib/a11y/useModalDialog';
import {
  generateAgencyCredentials,
  createAdminAgency,
  type CreateAgencyInput,
  type CreatedAgencyResponse,
} from '@/lib/api/admin-dashboard.api';
import {
  generateBaseAgencyEmail,
  generateTemporaryPassword,
  normalizeAgencySlug,
} from '@/lib/utils/agency-credentials';

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

const PRESET_COORDINATES = [
  { name: 'Nador - Aéroport Al Aroui', lat: 34.9897, lng: -3.0286 },
  { name: 'Nador - Centre Ville (Boulevard)', lat: 35.1740, lng: -2.9287 },
  { name: 'Nador - Port Beni Ensar', lat: 35.2592, lng: -2.9328 },
  { name: 'Oujda - Aéroport Angads', lat: 34.7872, lng: -1.9239 },
  { name: 'Berkane - Centre', lat: 34.9200, lng: -2.3200 },
];

interface AddAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (response: CreatedAgencyResponse) => void;
}

export function AddAgencyModal({ isOpen, onClose, onSuccess }: AddAgencyModalProps) {
  const [name, setName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Nador');
  const [region, setRegion] = useState('Oriental');
  const [latitude, setLatitude] = useState(35.1688);
  const [longitude, setLongitude] = useState(-2.9335);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'ACTIVE' | 'PENDING'>('ACTIVE');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualEmailEdit, setManualEmailEdit] = useState(false);

  // Auto-génération de l'email et du mot de passe lors de la saisie du nom
  useEffect(() => {
    if (!isOpen) {
      // Reset form on close
      setName('');
      setManagerName('');
      setPhone('');
      setWhatsapp('');
      setAddress('');
      setCity('Nador');
      setRegion('Oriental');
      setLatitude(35.1688);
      setLongitude(-2.9335);
      setEmail('');
      setPassword('');
      setStatus('ACTIVE');
      setDescription('');
      setLogoUrl('');
      setError(null);
      setManualEmailEdit(false);
      return;
    }

    // Initialisation d'un mot de passe par défaut à l'ouverture
    setPassword(generateTemporaryPassword(14));
  }, [isOpen]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!manualEmailEdit && val.trim().length >= 2) {
      const generated = generateBaseAgencyEmail(val);
      setEmail(generated);
    }
  };

  const handleRegenerateCredentials = async () => {
    if (!name.trim()) return;
    setGenerating(true);
    try {
      const creds = await generateAgencyCredentials(name);
      setEmail(creds.email);
      setPassword(creds.temporaryPassword);
      setManualEmailEdit(false);
    } catch {
      setEmail(generateBaseAgencyEmail(name));
      setPassword(generateTemporaryPassword(14));
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom commercial de l’agence est requis.');
      return;
    }
    if (!phone.trim()) {
      setError('Le numéro de téléphone est requis.');
      return;
    }
    if (!address.trim()) {
      setError('L’adresse physique de l’agence est requise.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Une adresse e-mail de connexion valide est requise.');
      return;
    }

    setLoading(true);

    const payload: CreateAgencyInput = {
      name: name.trim(),
      manager_name: managerName.trim() || undefined,
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim() || undefined,
      address: address.trim(),
      city: city.trim(),
      region: region.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      status,
      description: description.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
    };

    try {
      const result = await createAdminAgency(payload);
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de l’agence.');
    } finally {
      setLoading(false);
    }
  };

  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, { onClose, closeDisabled: loading });

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-agency-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-50 p-2.5 text-red-600 border border-red-100">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="add-agency-title" className="text-lg font-bold text-slate-900">Ajouter une nouvelle agence</h2>
              <p className="text-xs text-slate-500">
                Créez l'agence partenaire et configurez son compte d'accès ClickDrive
              </p>
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
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Informations Générales */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                1. Informations Générales
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom commercial de l'agence <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Rif Car Nador"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom du responsable (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Karim Benali"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Numéro de téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: +212 6 12 34 56 78"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp (optionnel, par défaut identique)
                </label>
                <input
                  type="tel"
                  placeholder="Ex: +212 6 12 34 56 78"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Localisation & Géolocalisation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                2. Localisation & Région
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adresse complète <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 45 Boulevard Mohammed V, Nador"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ville</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white"
                >
                  {MOROCCAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Région</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>

              {/* Coordonnées GPS avec préréglages */}
              <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Compass className="h-3.5 w-3.5 text-slate-500" />
                    <span>Coordonnées GPS (Carte ClickDrive)</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500">Préréglages :</span>
                    {PRESET_COORDINATES.slice(0, 3).map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setLatitude(preset.lat);
                          setLongitude(preset.lng);
                        }}
                        className="text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 transition"
                      >
                        {preset.name.split('-')[1]?.trim() || preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Accès & Sécurité */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  3. Identifiants & Accès Sécurisés
                </h3>
              </div>
              <button
                type="button"
                onClick={handleRegenerateCredentials}
                disabled={generating || !name.trim()}
                className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1 disabled:opacity-40"
              >
                <Sparkles className="h-3 w-3" />
                <span>Auto-générer</span>
              </button>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-800">
                    Email de connexion officiel <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Format : <span className="font-mono text-amber-900">nom.agence@Clickdrive.ma</span>
                  </span>
                </div>s
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setManualEmailEdit(true);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Cet identifiant servira à l'agence pour se connecter à son portail partenaire.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-800">
                    Mot de passe temporaire initial <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPassword(generateTemporaryPassword(14))}
                    className="text-[11px] text-slate-600 hover:text-slate-900 underline"
                  >
                    Nouveau mot de passe
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-amber-700">
                  Le mot de passe sera affiché à la confirmation pour transmission sécurisée au partenaire.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Statut initial du compte
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="agency-status"
                      checked={status === 'ACTIVE'}
                      onChange={() => setStatus('ACTIVE')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>Actif (accès immédiat au portail agence)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="agency-status"
                      checked={status === 'PENDING'}
                      onChange={() => setStatus('PENDING')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>En attente d'activation</span>
                  </label>
                </div>
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
                  Création du compte...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Créer l'agence
                </>
              )}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
