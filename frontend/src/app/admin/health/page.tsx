import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminHealthClient } from '@/components/admin/health/AdminHealthClient';

export const metadata: Metadata = { title: 'État du système' };

export default function AdminHealthPage() {
  return (
    <AdminShell title="État du système" subtitle="État des services de la plateforme ClickDrive">
      <AdminHealthClient />
    </AdminShell>
  );
}
