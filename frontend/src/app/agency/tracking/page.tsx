import { TrackingDashboard } from '@/components/agency/tracking/TrackingDashboard';
import { TrackingPageFrame } from '@/components/agency/tracking/TrackingPageFrame';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function TrackingPage({ searchParams }: Props) {
  return (
    <TrackingPageFrame searchParams={searchParams}>
      <TrackingDashboard />
    </TrackingPageFrame>
  );
}
