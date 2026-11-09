/**
 * Protection contre les traducteurs de navigateur (Google Traduction, Microsoft Translator d'Edge).
 *
 * Pour traduire une page, ils remplacent ou enveloppent ses nœuds de texte (<font>…</font>). React,
 * qui garde ses propres références à ces nœuds, appelle ensuite removeChild / insertBefore sur un
 * parent qui ne les contient plus : le navigateur lève « NotFoundError » et la page plante (problème
 * connu de React, facebook/react#11538). Les deux méthodes sont rendues tolérantes :
 * - removeChild : un nœud déjà retiré par le traducteur est ignoré ; un nœud déplacé plus bas
 *   (dans l'enveloppe du traducteur) est retiré de son vrai parent ;
 * - insertBefore : si le repère a été enveloppé, l'insertion se fait avant l'enveloppe ; s'il a disparu,
 *   le nœud est ajouté en fin de parent (le contenu reste affiché, au lieu d'un plantage).
 * Sans traducteur, rien ne change : le cas normal appelle les méthodes d'origine.
 */
const GUARD = Symbol.for('clickdrive.translation-guard');

type GuardedPrototype = Node & { [GUARD]?: () => void };

function isInside(node: Node | null, ancestor: Node): boolean {
  for (let current = node?.parentNode ?? null; current; current = current.parentNode) {
    if (current === ancestor) return true;
  }
  return false;
}

/** Installe la protection (une seule fois) ; renvoie la fonction qui la retire (tests) */
export function installTranslationGuard(proto: Node = Node.prototype): () => void {
  const target = proto as GuardedPrototype;
  const existing = target[GUARD];
  if (existing) return existing;

  const originalRemoveChild = proto.removeChild;
  const originalInsertBefore = proto.insertBefore;

  proto.removeChild = function removeChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode === this) return originalRemoveChild.call(this, child) as T;
    // Déplacé dans l'enveloppe du traducteur : retiré de son vrai parent ; déjà retiré : ignoré
    if (child.parentNode && isInside(child, this)) child.parentNode.removeChild(child);
    return child;
  };

  proto.insertBefore = function insertBefore<T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (!reference || reference.parentNode === this) {
      return originalInsertBefore.call(this, node, reference) as T;
    }
    // Repère enveloppé : on remonte jusqu'à l'enfant direct de ce parent (l'enveloppe) ; disparu : en fin
    let anchor: Node | null = reference;
    while (anchor && anchor.parentNode !== this) anchor = anchor.parentNode;
    return originalInsertBefore.call(this, node, anchor) as T;
  };

  const restore = () => {
    proto.removeChild = originalRemoveChild;
    proto.insertBefore = originalInsertBefore;
    delete target[GUARD];
  };
  target[GUARD] = restore;
  return restore;
}
