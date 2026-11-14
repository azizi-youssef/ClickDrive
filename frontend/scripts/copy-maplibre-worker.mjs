/**
 * Copie le worker de MapLibre GL JS dans public/maplibre/ (servi depuis la même origine).
 *
 * Pourquoi : le bundler réécrit l'URL interne du worker (import.meta.url) et la carte échoue avec
 * « Worker failed to load ». MapLibre propose setWorkerUrl() pour pointer vers un fichier hébergé ;
 * la copie depuis node_modules garantit que le worker est TOUJOURS de la même version que la bibliothèque.
 * Exécuté automatiquement avant `npm run dev` et `npm run build` (le fichier copié n'est pas versionné).
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const packageJson = require.resolve('maplibre-gl/package.json');
  const source = path.join(path.dirname(packageJson), 'dist', 'maplibre-gl-worker.mjs');
  const targetDir = path.join(root, 'public', 'maplibre');
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, path.join(targetDir, 'maplibre-gl-worker.mjs'));
  console.log('[maplibre] worker copié dans public/maplibre/');
} catch (error) {
  console.error('[maplibre] copie du worker impossible :', error instanceof Error ? error.message : error);
  process.exit(1);
}
