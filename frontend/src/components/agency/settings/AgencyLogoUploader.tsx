'use client';

import { useState, type ChangeEvent } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';

const MAX_LOGO_SIZE = 5 * 1024 * 1024;

export function AgencyLogoUploader({
  agencyId,
  imageUrl,
  agencyName,
  brandingType = 'logo',
  disabled = false,
  onUploaded,
}: {
  agencyId: string;
  imageUrl: string;
  agencyName: string;
  brandingType?: 'logo' | 'banner';
  disabled?: boolean;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageLabel = brandingType === 'banner' ? 'bannière' : 'logo';

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (file.size > MAX_LOGO_SIZE) {
      setError(`L’image ne peut pas dépasser 5 Mo.`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set(brandingType, file);
      const response = await fetch(`/api/agencies/${agencyId}/branding`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      const field = brandingType === 'banner' ? 'banner_url' : 'logo_url';
      if (!response.ok || !result.success || typeof result.data?.[field] !== 'string') {
        throw new Error(result.error || `Impossible d’enregistrer l’image.`);
      }
      onUploaded(result.data[field]);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clickdrive:profile-updated'));
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Échec du téléversement.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${brandingType === 'banner' ? 'h-16 w-28' : 'h-16 w-16'}`}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- agency branding is a database-backed public URL
          <img src={imageUrl} alt={`${imageLabel} ${agencyName}`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl font-bold text-slate-400">
            {brandingType === 'banner' ? 'Aperçu' : agencyName.trim().charAt(0).toLocaleUpperCase('fr-FR') || '?'}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{brandingType === 'banner' ? 'Bannière de l’agence' : 'Logo de l’agence'}</p>
        <p className="mt-0.5 text-xs text-slate-500">JPEG, PNG ou WebP — 5 Mo maximum.</p>
        <label className={`mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${disabled || uploading ? 'pointer-events-none opacity-50' : ''}`}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {uploading ? 'Enregistrement…' : imageUrl ? `Remplacer ${imageLabel}` : `Ajouter ${imageLabel}`}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={handleFileChange}
          />
        </label>
        {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
