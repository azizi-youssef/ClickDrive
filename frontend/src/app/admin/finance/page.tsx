import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminFinanceClient } from '@/components/admin/finance/AdminFinanceClient';
import { AdminPlanRequestsCard } from '@/components/admin/finance/AdminPlanRequestsCard';

export const metadata: Metadata = { title: 'Abonnements & finances' };
export const dynamic = 'force-dynamic';

export default function AdminFinancePage() {
  return (
    <AdminShell
      title="Abonnements & Finances"
      subtitle="Revenus récurrents des abonnements mensuels (MRR), capacité des flottes et volume des concessions"
    >
      <div className="space-y-6">
        <AdminPlanRequestsCard />
        <AdminFinanceClient />
      </div>
    </AdminShell>
  );
}
