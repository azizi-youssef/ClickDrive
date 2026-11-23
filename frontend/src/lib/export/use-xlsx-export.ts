'use client';

import { useCallback, useState } from 'react';
import { downloadXlsx, type XlsxSheet } from './spreadsheet';

const EXPORT_ERROR = 'Le fichier Excel n’a pas pu être généré. Réessayez.';

/**
 * Bouton « Exporter en Excel » : le générateur est chargé au premier clic, le bouton est
 * désactivé pendant la génération et un échec (chargement du module, navigateur) est signalé.
 * La feuille est construite au clic : rien n'est calculé pendant le rendu.
 */
export function useXlsxExport() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportXlsx = useCallback(async (fileName: string, buildSheet: () => XlsxSheet) => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadXlsx(fileName, buildSheet());
    } catch (error) {
      console.error('[export Excel]', error);
      setExportError(EXPORT_ERROR);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, exportError, exportXlsx };
}
