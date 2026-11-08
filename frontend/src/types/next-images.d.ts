// Types des imports statiques d'images (`import logo from '…/logo.png'`).
// `next-env.d.ts` les fournit aussi, mais il est généré par `next dev` / `next build` et ignoré par Git :
// sans ce fichier versionné, le typecheck de la CI (lancé avant le build) ne les connaît pas.
/// <reference types="next/image-types/global" />
