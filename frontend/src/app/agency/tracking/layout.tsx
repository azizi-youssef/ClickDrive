import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Les positions de la flotte sont strictement privées : jamais indexées, jamais mises en cache partagé
export const metadata: Metadata = {
  title: 'Suivi GPS',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default function TrackingLayout({ children }: { children: ReactNode }) {
  return children;
}
