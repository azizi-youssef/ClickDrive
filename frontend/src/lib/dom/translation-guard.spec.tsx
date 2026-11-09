// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { installTranslationGuard } from './translation-guard';

// React 19 : act() dans un environnement de test
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Libellé qui disparaît (removeChild) et badge qui apparaît avant un texte (insertBefore) */
function Status({ checking }: { checking: boolean }) {
  return (
    <p>
      {checking && 'Wird geprüft'}
      {!checking && <b>Konto</b>}
      {' Nador'}
    </p>
  );
}

/** Ce que fait un traducteur : le nœud de texte d'origine est remplacé par <font>texte traduit</font> */
function translate(container: HTMLElement, original: string, translated: string) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue === original) {
      const font = document.createElement('font');
      font.textContent = translated;
      (node as Text).replaceWith(font);
      return;
    }
  }
  throw new Error(`texte introuvable : ${original}`);
}

let root: Root | null = null;
let container: HTMLElement | null = null;
let restore: (() => void) | null = null;

function mount(checking: boolean) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(<Status checking={checking} />));
  return container;
}

afterEach(() => {
  try {
    act(() => root?.unmount());
  } catch {
    // arbre déjà abîmé par le scénario sans protection
  }
  container?.remove();
  restore?.();
  root = null;
  container = null;
  restore = null;
});

describe('Traduction automatique du navigateur', () => {
  it('sans protection : React plante quand il met à jour un texte traduit (le bug corrigé)', () => {
    const node = mount(true);
    translate(node, 'Wird geprüft', 'Vérification');
    expect(() => act(() => root!.render(<Status checking={false} />))).toThrow();
  });

  it('avec protection : plus de plantage, le contenu suivant s’affiche', () => {
    restore = installTranslationGuard();
    const node = mount(true);
    translate(node, 'Wird geprüft', 'Vérification');
    act(() => root!.render(<Status checking={false} />));
    expect(node.querySelector('b')?.textContent).toBe('Konto');
  });

  it('insertion avant un texte enveloppé : placée avant l’enveloppe, pas en vrac', () => {
    restore = installTranslationGuard();
    const node = mount(true);
    // Le traducteur déplace le texte « Nador » dans une enveloppe au lieu de le remplacer
    const nador = Array.from(node.querySelector('p')!.childNodes).find((child) => child.nodeValue === ' Nador')!;
    const wrapper = document.createElement('font');
    nador.replaceWith(wrapper);
    wrapper.append(nador);
    act(() => root!.render(<Status checking={false} />));
    const children = Array.from(node.querySelector('p')!.childNodes);
    expect(children.indexOf(node.querySelector('b')!)).toBeLessThan(children.indexOf(wrapper));
  });

  it('sans traducteur : comportement d’origine, installation idempotente', () => {
    restore = installTranslationGuard();
    expect(installTranslationGuard()).toBe(restore);
    const node = mount(true);
    act(() => root!.render(<Status checking={false} />));
    expect(node.querySelector('p')?.textContent).toBe('Konto Nador');
    const orphan = document.createElement('span');
    expect(() => node.removeChild(orphan)).not.toThrow();
  });
});
