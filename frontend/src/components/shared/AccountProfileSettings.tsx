'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, ImagePlus, Loader2, Save, Trash2, UserRound } from 'lucide-react';

type AccountProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export function AccountProfileSettings() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/account/profile', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const body = (await response.json()) as {
          success?: boolean;
          error?: string;
          data?: AccountProfile;
        };
        if (!response.ok || !body.success || !body.data) {
          throw new Error(body.error || 'Impossible de charger le profil.');
        }
        if (active) {
          setProfile(body.data);
          setName(body.data.full_name ?? '');
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Impossible de charger le profil.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setSuccess(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choisissez une image JPEG, PNG ou WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError('La photo ne peut pas dépasser 5 Mo.');
      event.target.value = '';
      return;
    }

    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const objectUrl = URL.createObjectURL(file);
    previewUrl.current = objectUrl;
    setPreview(objectUrl);
    setSelectedFile(file);
    setRemoveAvatar(false);
  };

  const clearSelectedPhoto = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPreview(null);
    setSelectedFile(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleRemovePhoto = () => {
    clearSelectedPhoto();
    setRemoveAvatar(Boolean(profile?.avatar_url));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    const formData = new FormData();
    formData.set('full_name', name.trim());
    formData.set('remove_avatar', String(removeAvatar));
    if (selectedFile) formData.set('avatar', selectedFile);

    try {
      const response = await fetch('/api/account/profile', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: AccountProfile;
      };
      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error || 'Impossible d’enregistrer le profil.');
      }
      setProfile(body.data);
      setName(body.data.full_name ?? '');
      setSuccess('Votre profil a été mis à jour.');
      setRemoveAvatar(false);
      clearSelectedPhoto();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clickdrive:profile-updated'));
      }
      router.refresh();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  };

  const currentAvatar = removeAvatar ? null : preview ?? profile?.avatar_url ?? null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-bold text-slate-900">Profil du compte</h2>
        <p className="mt-1 text-sm text-slate-500">
          Modifiez votre nom et la photo affichée dans votre espace ClickDrive.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#0B1220]" aria-hidden="true" />
          Chargement du profil…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {currentAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentAvatar} alt="Aperçu de la photo de profil" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-10 w-10 text-slate-400" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                  aria-label="Choisir une photo de profil"
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1220]"
                >
                  {currentAvatar ? <Camera className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                  {currentAvatar ? 'Changer la photo' : 'Ajouter une photo'}
                </button>
                {profile?.avatar_url && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                )}
                {selectedFile && (
                  <button
                    type="button"
                    onClick={clearSelectedPhoto}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1220]"
                  >
                    Annuler la photo
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">JPEG, PNG ou WebP · 5 Mo maximum.</p>
              {selectedFile && <p className="text-xs font-medium text-slate-600">{selectedFile.name}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="account-profile-name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Nom affiché
              </label>
              <input
                id="account-profile-name"
                type="text"
                required
                maxLength={100}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#0B1220] focus:ring-2 focus:ring-[#0B1220]/10"
              />
            </div>
            <div>
              <label htmlFor="account-profile-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Adresse e-mail
              </label>
              <input
                id="account-profile-email"
                type="email"
                disabled
                value={profile?.email ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500">L’e-mail de connexion n’est pas modifiable ici.</p>
            </div>
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {success && (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {success}
            </p>
          )}

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
