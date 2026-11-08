import type { Metadata } from 'next';
import { NotFoundView } from '@/components/not-found/NotFoundView';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: "Cette page n'existe pas ou a été déplacée. Retrouvez nos véhicules en location à Nador.",
  robots: { index: false, follow: true },
};

/**
 * 404 du site public (URL inconnue, annonce ou agence retirée).
 * Le message s'adapte à l'adresse demandée ; voir NotFoundView.
 */
export default function NotFound() {
  return <NotFoundView />;
}
