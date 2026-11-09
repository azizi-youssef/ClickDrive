import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminOverviewClient } from '@/components/admin/overview/AdminOverviewClient';
import { statsService } from '@/lib/services/stats.service';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: "Vue d'ensemble",
};

export const dynamic = 'force-dynamic';

// Server-side data fetching
async function getOverviewData() {
  const [stats] = await Promise.allSettled([statsService.getAdminStats()]);

  return {
    stats: stats.status === 'fulfilled' ? stats.value : null,
    statsError: stats.status === 'rejected' ? (stats.reason as Error).message : null,
  };
}

export default async function AdminOverviewPage() {
  const data = await getOverviewData();

  return (
    <AdminShell
      title="Vue d'ensemble"
      subtitle="Activité de la marketplace ClickDrive — Nador & Oriental"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        }
      >
        <AdminOverviewClient
          initialStats={data.stats}
          statsError={data.statsError}
        />
      </Suspense>
    </AdminShell>
  );
}
