import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd, jsonLdScript } from './structured-data';

describe('jsonLdScript — sérialisation sûre dans <script type="application/ld+json">', () => {
  it('une valeur ne peut pas fermer la balise script', () => {
    const output = jsonLdScript({ description: '</script><script>alert(1)</script>' });
    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
    expect(output).toContain('\\u003c/script\\u003e');
  });

  it('reste du JSON valide et restitue la valeur d’origine', () => {
    const data = { name: 'Agence <A> & fils', note: 'ligne\u2028suivante' };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });
});

describe('breadcrumbJsonLd', () => {
  it('positions et URL absolues', () => {
    const crumbs = breadcrumbJsonLd([
      { name: 'Accueil', path: '/' },
      { name: 'Motos', path: '/motos' },
    ]);
    expect(crumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://clickdrive.ma' },
      { '@type': 'ListItem', position: 2, name: 'Motos', item: 'https://clickdrive.ma/motos' },
    ]);
  });
});
