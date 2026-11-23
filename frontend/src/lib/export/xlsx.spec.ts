import { describe, expect, it } from 'vitest';
import { readXlsx, unzip } from '@/tests/setup/xlsx-reader';
import { buildXlsx, sheetName } from './xlsx';
import { XLSX_MIME, tableSheet, xlsxFileName, type XlsxSheet } from './spreadsheet';

const NOW = new Date('2026-11-09T10:00:00Z');

const table: XlsxSheet = {
  kind: 'table',
  name: 'Réservations',
  columns: [
    { header: 'Dossier', format: 'text' },
    { header: 'Client' },
    { header: 'Téléphone', format: 'text' },
    { header: 'Début', format: 'date' },
    { header: 'Créé le', format: 'date' },
    { header: 'Jours', format: 'integer' },
    { header: 'Montant (DH)', format: 'money' },
  ],
  rows: [
    ['CD-2026-001842', 'Hélène Dupont', '+212 661 00 00 00', '2026-12-01', '2026-11-09T22:30:00.000Z', 3, 1250.5],
    ['CD-2026-001843', '=HYPERLINK("http://x")', '0612345678', 'pas une date', null, Number.NaN, 900],
  ],
};

describe('Classeur .xlsx', () => {
  it('archive Office Open XML complète, lisible (CRC vérifiés), compressée ou non', async () => {
    for (const compress of [true, false]) {
      const files = unzip(await buildXlsx(table, { now: NOW, compress }));
      expect([...files.keys()]).toEqual([
        '[Content_Types].xml',
        '_rels/.rels',
        'docProps/core.xml',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/worksheets/sheet1.xml',
        'xl/sharedStrings.xml',
      ]);
      expect(files.get('[Content_Types].xml')).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml');
      expect(files.get('docProps/core.xml')).toContain('<dcterms:created xsi:type="dcterms:W3CDTF">2026-11-09T10:00:00Z</dcterms:created>');
    }
    // Deflate natif utilisé quand il est disponible
    const compressed = await buildXlsx(table, { now: NOW });
    const stored = await buildXlsx(table, { now: NOW, compress: false });
    expect(compressed.length).toBeLessThan(stored.length);
    expect(XLSX_MIME).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(xlsxFileName('clickdrive-finances', NOW)).toBe('clickdrive-finances-2026-11-09.xlsx');
  });

  it('en-têtes en gras, figés et filtrables ; une ligne de données typée', async () => {
    const sheet = readXlsx(await buildXlsx(table, { now: NOW }));
    expect(sheet.sheetName).toBe('Réservations');
    expect(sheet.values[0]).toEqual(['Dossier', 'Client', 'Téléphone', 'Début', 'Créé le', 'Jours', 'Montant (DH)']);
    expect(sheet.cells.get('A1')?.bold).toBe(true);
    expect(sheet.sheetXml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(sheet.sheetXml).toContain('<autoFilter ref="A1:G3"/>');
    expect(sheet.files.get('xl/workbook.xml')).toContain("'Réservations'!$A$1:$G$3");

    // Le jour d'un horodatage est celui écrit (UTC), comme l'ancien export
    expect(sheet.values[1]).toEqual(['CD-2026-001842', 'Hélène Dupont', '+212 661 00 00 00', '2026-12-01', '2026-11-09', 3, 1250.5]);
    expect(sheet.cells.get('D2')).toMatchObject({ type: 'number', value: 46357, format: 'dd/mm/yyyy', date: '2026-12-01' });
    expect(sheet.cells.get('F2')).toMatchObject({ type: 'number', format: '#,##0' });
    expect(sheet.cells.get('G2')).toMatchObject({ type: 'number', value: 1250.5, format: '#,##0.00' });
    expect(sheet.cells.get('C2')).toMatchObject({ type: 'string', value: '+212 661 00 00 00' });
  });

  it('texte d’un client jamais interprété comme formule ; date invalide et NaN laissés vides', async () => {
    const sheet = readXlsx(await buildXlsx(table, { now: NOW }));
    expect(sheet.cells.get('B3')).toMatchObject({ type: 'string', value: '=HYPERLINK("http://x")' });
    expect(sheet.sheetXml).not.toContain('<f>');
    expect(sheet.cells.get('C3')).toMatchObject({ type: 'string', value: '0612345678' });
    expect(sheet.values[2]).toEqual(['CD-2026-001843', '=HYPERLINK("http://x")', '0612345678', null, null, null, 900]);
  });

  it('caractères spéciaux échappés, contrôles retirés, accents et arabe conservés', async () => {
    const sheet = readXlsx(
      await buildXlsx(
        { kind: 'table', name: 'Notes', columns: [{ header: 'Message' }], rows: [['A & B <c> "d"\u0007'], ['  espace '], ['مرحبا Nador'], ['ligne 1\r\nligne 2']] },
        { now: NOW }
      )
    );
    expect(sheet.values.slice(1).map((row) => row[0])).toEqual(['A & B <c> "d"', '  espace ', 'مرحبا Nador', 'ligne 1\nligne 2']);
  });

  it('largeur des colonnes d’après le contenu, bornée', async () => {
    const sheet = readXlsx(
      await buildXlsx(
        {
          kind: 'table',
          name: 'Largeurs',
          columns: [{ header: 'A' }, { header: 'Long', width: 30 }, { header: 'Date', format: 'date' }, { header: 'Texte' }],
          rows: [['x', 'y', '2026-01-01', 'z'.repeat(200)]],
        },
        { now: NOW }
      )
    );
    expect(sheet.widths).toEqual([8, 30, 12, 60]);
  });

  it('rapport en sections : titre, en-têtes de section en gras, mois en vraies dates', async () => {
    const sheet = readXlsx(
      await buildXlsx(
        {
          kind: 'report',
          name: 'Statistiques',
          rows: [
            ['Statistiques ClickDrive — Agence Alpha'],
            ['Période', { value: '2026-10-01', format: 'date' }, { value: '2026-10-30', format: 'date' }, '30 jours'],
            [],
            ['Mois', 'Demandes', 'Chiffre d’affaires (DH)'],
            [{ value: '2026-10', format: 'month' }, 21, { value: 31000, format: 'integer' }],
          ],
        },
        { now: NOW }
      )
    );
    expect(sheet.cells.get('A1')?.bold).toBe(true);
    expect(sheet.cells.get('A2')?.bold).toBe(false);
    expect(sheet.cells.get('A4')?.bold).toBe(true);
    expect(sheet.values[1]).toEqual(['Période', '2026-10-01', '2026-10-30', '30 jours']);
    expect(sheet.values[2]).toEqual([]);
    expect(sheet.values[4]).toEqual(['2026-10-01', 21, 31000]);
    expect(sheet.cells.get('A5')?.format).toBe('mmm yyyy');
    expect(sheet.sheetXml).not.toContain('autoFilter');
  });

  it('nom d’onglet valide pour Excel', () => {
    expect(sheetName('Finances : 2026/11 [agence]')).toBe('Finances 2026 11 agence');
    expect(sheetName('x'.repeat(40))).toHaveLength(31);
    expect(sheetName("''")).toBe('Feuille1');
  });

  it('tableSheet : en-têtes et valeurs dans l’ordre des colonnes', () => {
    const sheet = tableSheet<{ a: string; b: number }>('T', [{ header: 'A', value: (r) => r.a }, { header: 'B', format: 'money', value: (r) => r.b }], [{ a: 'x', b: 2 }]);
    expect(sheet).toEqual({ kind: 'table', name: 'T', columns: [{ header: 'A' }, { header: 'B', format: 'money' }], rows: [['x', 2]] });
  });
});
