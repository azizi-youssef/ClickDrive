import { describe, expect, it } from 'vitest';
import { getMessages, pickMessages, CORE_NAMESPACES } from './messages';
import { PREFIXED_LOCALES } from './config';

type Node = unknown;
const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

function isPluralForms(value: Node): value is Record<string, string> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && 'other' in (value as object) &&
    Object.keys(value as object).every((key) => PLURAL_KEYS.has(key));
}

const variables = (text: string) => [...(text.match(/\{\w+\}/g) ?? [])].sort();

/**
 * Compare une traduction au français : mêmes clés, mêmes longueurs de listes, aucun texte vide,
 * mêmes variables {…}. Les formes du pluriel varient selon la langue (l'arabe en a six) : seule la
 * forme « other » est exigée, et le singulier peut écrire le nombre en toutes lettres.
 */
function differences(reference: Node, candidate: Node, path: string, out: string[]) {
  if (typeof reference === 'string') {
    // Vide en français (pas de badge, note « 0 » inutilisée) : vide aussi dans la traduction
    if (!reference.trim()) {
      if (candidate !== reference) out.push(`${path} : devrait rester vide`);
      return;
    }
    if (typeof candidate !== 'string' || !candidate.trim()) {
      out.push(`${path} : vide ou absent`);
      return;
    }
    const unknown = variables(candidate).filter((name) => !variables(reference).includes(name));
    if (unknown.length) out.push(`${path} : variables inconnues ${unknown}`);
    // Singulier (clé « …One ») : le nombre peut être écrit en toutes lettres (« مركبة واحدة »)
    else if (!path.endsWith('One') && variables(reference).join() !== variables(candidate).join()) {
      out.push(`${path} : variables ${variables(candidate)} ≠ ${variables(reference)}`);
    }
    return;
  }
  if (Array.isArray(reference)) {
    if (!Array.isArray(candidate) || candidate.length !== reference.length) out.push(`${path} : liste de longueur différente`);
    else reference.forEach((item, index) => differences(item, candidate[index], `${path}[${index}]`, out));
    return;
  }
  if (isPluralForms(reference)) {
    if (!isPluralForms(candidate)) out.push(`${path} : formes du pluriel absentes`);
    else {
      const expected = variables(reference.other).filter((name) => name !== '{count}');
      for (const [form, text] of Object.entries(candidate)) {
        const extra = variables(text).filter((name) => name !== '{count}' && !expected.includes(name));
        if (extra.length) out.push(`${path}.${form} : variables inconnues ${extra}`);
      }
      if (variables(candidate.other).join() !== variables(reference.other).join()) out.push(`${path}.other : variables différentes`);
    }
    return;
  }
  if (reference && typeof reference === 'object') {
    if (!candidate || typeof candidate !== 'object') {
      out.push(`${path} : absent`);
      return;
    }
    const keys = new Set([...Object.keys(reference as object), ...Object.keys(candidate as object)]);
    for (const key of keys) {
      if (!(key in (candidate as object))) out.push(`${path}.${key} : manquant`);
      else if (!(key in (reference as object))) out.push(`${path}.${key} : clé inconnue du français`);
      else differences((reference as Record<string, Node>)[key], (candidate as Record<string, Node>)[key], `${path}.${key}`, out);
    }
  }
}

describe('Espaces de noms traduits (référence : français)', () => {
  const french = getMessages('fr');

  it.each(PREFIXED_LOCALES)('%s : traduction complète, mêmes variables', (locale) => {
    const out: string[] = [];
    differences(french, getMessages(locale), locale, out);
    expect(out).toEqual([]);
  });

  it('le navigateur ne reçoit que la langue de la page et les espaces demandés', () => {
    const core = pickMessages('nl', CORE_NAMESPACES);
    expect(Object.keys(core).sort()).toEqual([...CORE_NAMESPACES].sort());
    expect(JSON.stringify(core)).not.toContain('Rechercher une voiture');
    expect(JSON.stringify(core)).not.toContain('ابحث');
  });
});
