import brandLogo from '../../../public/logo_12.png';

/**
 * Logo ClickDrive (import statique) :
 * - Next.js lit les dimensions réelles du fichier : remplacer le PNG ne désaligne plus les proportions
 *   (avertissement « width or height modified, but not the other ») ;
 * - l'URL générée contient une empreinte du fichier : un nouveau logo n'est jamais masqué par un cache.
 * Le fichier source reste `public/logo_12.png` (également utilisé par le PDF de réservation).
 */
export { brandLogo };

export const BRAND_NAME = 'ClickDrive';
