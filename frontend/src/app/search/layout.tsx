import type { Metadata } from 'next';
import React from 'react';
import { localizedPageMetadata } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return localizedPageMetadata('search', '/search');
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
