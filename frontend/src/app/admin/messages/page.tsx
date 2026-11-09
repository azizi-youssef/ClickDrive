import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminContactMessagesClient } from '@/components/admin/messages/AdminContactMessagesClient';

export const metadata: Metadata = { title: 'Messages de contact' };

export default function AdminMessagesPage() {
  return (
    <AdminShell title="Messages de contact" subtitle="Messages envoyés depuis la page Contact : lecture, réponse et suivi">
      <AdminContactMessagesClient />
    </AdminShell>
  );
}
