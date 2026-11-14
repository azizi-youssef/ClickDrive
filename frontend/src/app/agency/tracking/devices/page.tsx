import { TrackerManagement } from '@/components/agency/tracking/TrackerManagement';
import { TrackingPageFrame } from '@/components/agency/tracking/TrackingPageFrame';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function TrackingDevicesPage({ searchParams }: Props) {
  return (
    <TrackingPageFrame searchParams={searchParams}>
      <TrackerManagement />
    </TrackingPageFrame>
  );
}
