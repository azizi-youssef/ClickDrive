import { describe, expect, it } from 'vitest';
import { csvCell, csvDate, csvFileContent, csvFileName, toCsv } from './csv';

describe('Export CSV (Excel en français)', () => {
  it('point-virgule, CRLF et marque UTF-8 en tête', () => {
    const content = csvFileContent([
      ['Dossier', 'Client'],
      ['CD-1', 'Hélène'],
    ]);
    expect(content.startsWith('﻿')).toBe(true);
    expect(content).toBe('﻿Dossier;Client\r\nCD-1;Hélène\r\n');
  });

  it('guillemets autour des cellules qui contiennent ; " ou un saut de ligne', () => {
    expect(csvCell('Agence; Nador')).toBe('"Agence; Nador"');
    expect(csvCell('Dit "rapide"')).toBe('"Dit ""rapide"""');
    expect(csvCell('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"');
    expect(csvCell('Nador, Maroc')).toBe('Nador, Maroc');
  });

  it('neutralise les formules venues des clients ; les nombres restent des nombres', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+212 661 00 00 00')).toBe("'+212 661 00 00 00");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-350)).toBe('-350');
    expect(csvCell(1250.5)).toBe('1250.5');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(null)).toBe('');
  });

  it('dates AAAA-MM-JJ et nom de fichier daté', () => {
    expect(csvDate('2026-12-01')).toBe('2026-12-01');
    expect(csvDate('2026-12-01T22:30:00.000Z')).toBe('2026-12-01');
    expect(csvDate('pas une date')).toBe('');
    expect(csvDate(undefined)).toBe('');
    expect(csvFileName('clickdrive-finances', new Date('2026-11-09T10:00:00Z'))).toBe('clickdrive-finances-2026-11-09.csv');
    expect(toCsv([[1, 'a'], [2, 'b']])).toBe('1;a\r\n2;b');
  });
});
