import { ImageResponse } from 'next/og';

/** Image de partage (Open Graph / réseaux sociaux), générée : aucun fichier binaire à maintenir. */
export const alt = 'ClickDrive — Location de voitures et motos à Nador';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0B1220 0%, #121B2E 60%, #3A1219 100%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: '#E63946' }} />
          <div style={{ fontSize: 30, letterSpacing: 6, textTransform: 'uppercase', color: '#CBD5E1' }}>Nador · Oriental</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 108, fontWeight: 800, letterSpacing: -3 }}>ClickDrive</div>
          <div style={{ fontSize: 46, fontWeight: 600, color: '#E2E8F0', maxWidth: 980 }}>
            Location de voitures et motos auprès d’agences vérifiées
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28, fontSize: 28, color: '#CBD5E1' }}>
          <span>Aéroport Nador-Al Aroui</span>
          <span style={{ color: '#E63946' }}>•</span>
          <span>Port Beni Ansar</span>
        </div>
      </div>
    ),
    size
  );
}
