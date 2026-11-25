import Image from 'next/image';
import { brandLogo } from '@/lib/brand/logo';
import { cn } from '@/lib/utils';

/*
 * Logo ClickDrive pour les espaces (tableaux de bord, pied de page…).
 *
 * « Filtré » = silhouette blanche (brightness-0 invert), sans pastille, sur fond graphite : même rendu que
 * le pied de page (commit « filtrer logo en footer »). Les découpes du fichier (curseur, route) restent
 * transparentes, donc lisibles. Sur fond clair, version couleur.
 *
 * Symbole seul (carré réduit) : le fichier public/logo_12.png (819 × 161) place le symbole sur
 * les 242 premières colonnes, puis le mot « ClickDrive » à partir de la colonne 260. On affiche l'image
 * entière, agrandie pour que ces 242 colonnes remplissent le cadre, et on masque le reste.
 */
const SYMBOL_WIDTH_SHARE = 242 / 819;

/**
 * Dimensions du fichier : lues sur l'import statique (Next les mesure au build) ; repli 819 × 161 quand
 * l'import n'est qu'une chaîne (tests Vitest), sinon next/image exige width/height.
 */
const LOGO_SIZE =
  typeof brandLogo === 'object' && brandLogo !== null
    ? { width: brandLogo.width, height: brandLogo.height }
    : { width: 819, height: 161 };

type Tone = 'white' | 'color';

/** Logo complet (symbole + mot), hauteur fixée par className (ex. « h-7 w-auto ») */
export function BrandLogo({
  tone = 'white',
  className,
  sizes = '160px',
  priority = false,
}: {
  tone?: Tone;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={brandLogo}
      alt="ClickDrive"
      width={LOGO_SIZE.width}
      height={LOGO_SIZE.height}
      sizes={sizes}
      priority={priority}
      className={cn(tone === 'white' && 'brightness-0 invert', className)}
    />
  );
}

/** Symbole seul, centré dans un cadre carré de `size` px (barre latérale réduite, pastilles) */
export function BrandSymbol({ tone = 'white', size, label }: { tone?: Tone; size: number; label?: string }) {
  const imageWidth = size / SYMBOL_WIDTH_SHARE;
  const imageHeight = (imageWidth * LOGO_SIZE.height) / LOGO_SIZE.width;
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="relative block shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <Image
        src={brandLogo}
        alt=""
        width={LOGO_SIZE.width}
        height={LOGO_SIZE.height}
        sizes={`${Math.ceil(imageWidth)}px`}
        className={cn('absolute max-w-none', tone === 'white' && 'brightness-0 invert')}
        // left explicite (pas start) : le symbole est à gauche du fichier, en arabe comme en français
        style={{ left: 0, top: (size - imageHeight) / 2, width: imageWidth, height: imageHeight }}
      />
    </span>
  );
}
