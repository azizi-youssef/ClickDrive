// @vitest-environment jsdom
import '@/tests/setup/dom';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blobBytes, readXlsx } from '@/tests/setup/xlsx-reader';
import { useXlsxExport } from './use-xlsx-export';
import type { XlsxSheet } from './spreadsheet';

let saved: { name: string; blob: Blob }[];

beforeEach(() => {
  saved = [];
  const blobs = new Map<string, Blob>();
  Object.assign(URL, {
    createObjectURL: vi.fn((blob: Blob) => {
      const url = `blob:test-${blobs.size}`;
      blobs.set(url, blob);
      return url;
    }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ name: this.download, blob: blobs.get(this.getAttribute('href') ?? '')! });
  });
});

afterEach(() => vi.restoreAllMocks());

const sheet: XlsxSheet = {
  kind: 'table',
  name: 'Clients',
  columns: [{ header: 'Nom' }, { header: 'Total dépensé (DH)', format: 'money' }],
  rows: [['Hélène Dupont', 5200]],
};

describe('useXlsxExport', () => {
  it('télécharge un .xlsx (type MIME, nom, contenu) et réactive le bouton', async () => {
    const { result } = renderHook(() => useXlsxExport());
    await act(() => result.current.exportXlsx('clickdrive-clients-2026-11-09.xlsx', () => sheet));

    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('clickdrive-clients-2026-11-09.xlsx');
    expect(saved[0].blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const read = readXlsx(await blobBytes(saved[0].blob));
    expect(read.values).toEqual([
      ['Nom', 'Total dépensé (DH)'],
      ['Hélène Dupont', 5200],
    ]);
    expect(result.current.exporting).toBe(false);
    expect(result.current.exportError).toBeNull();
    // Le lien temporaire est retiré du document
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('échec de génération : message affichable, aucun fichier', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useXlsxExport());
    await act(() =>
      result.current.exportXlsx('x.xlsx', () => {
        throw new Error('boom');
      })
    );
    expect(saved).toHaveLength(0);
    expect(result.current.exportError).toBe('Le fichier Excel n’a pas pu être généré. Réessayez.');
    expect(result.current.exporting).toBe(false);
  });
});
