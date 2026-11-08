import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminAgenciesClient } from '@/components/admin/agencies/AdminAgenciesClient';

export const metadata: Metadata = { title: 'Agences' };

export default async function AdminAgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const { filter } = await searchParams;
  const initialStatus = typeof filter === 'string' ? filter.toUpperCase() : undefined;

  return (
    <AdminShell title="Agences partenaires" subtitle="Gérez les agences de la marketplace ClickDrive">
      <AdminAgenciesClient initialStatus={initialStatus} />
    </AdminShell>
  );
}
