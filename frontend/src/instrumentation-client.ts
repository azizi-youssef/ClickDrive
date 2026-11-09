/**
 * Exécuté par Next.js avant que l'application ne devienne interactive (avant l'hydratation React).
 *
 * Nettoie les attributs injectés par certaines extensions navigateur (ex. Bitdefender « bis_skin_checked »)
 * qui provoqueraient des écarts d'hydratation. Ce code vivait dans un <Script beforeInteractive> du layout
 * racine : quand Next reconstruit le document côté client (404 levée par notFound()), React recréait cette
 * balise et signalait « Encountered a script tag ». Ici, aucune balise <script> n'entre dans l'arbre React.
 */
import { installTranslationGuard } from '@/lib/dom/translation-guard';

// Traduction automatique du navigateur (Edge, Chrome) : React ne doit pas planter quand le
// traducteur a remplacé un texte qu'il met ensuite à jour. Installée avant l'hydratation.
try {
  installTranslationGuard();
} catch {
  // Protection de confort : ne jamais bloquer le démarrage de l'application
}

const EXTENSION_ATTRIBUTES = ['bis_skin_checked'];

try {
  const selector = EXTENSION_ATTRIBUTES.map((name) => `[${name}]`).join(',');
  const clean = () => {
    document.querySelectorAll(selector).forEach((element) => {
      for (const name of EXTENSION_ATTRIBUTES) element.removeAttribute(name);
    });
  };
  clean();
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(clean).observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: EXTENSION_ATTRIBUTES,
    });
  }
} catch {
  // Nettoyage purement cosmétique : ne jamais bloquer le démarrage de l'application
}
