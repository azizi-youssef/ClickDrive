import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminBookingsClient } from '@/components/admin/bookings/AdminBookingsClient';

export const metadata: Metadata = { title: 'Réservations' };

export default function AdminBookingsPage() {
  return (
    <AdminShell
      title="Réservations"
      subtitle="Toutes les réservations de la marketplace ClickDrive"
    >
      <AdminBookingsClient />
    </AdminShell>
  );
}
