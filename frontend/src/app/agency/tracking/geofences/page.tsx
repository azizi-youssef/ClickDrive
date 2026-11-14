import { GeofencesPanel } from '@/components/agency/tracking/GeofencesPanel';
import { TrackingPageFrame } from '@/components/agency/tracking/TrackingPageFrame';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function TrackingGeofencesPage({ searchParams }: Props) {
  return (
    <TrackingPageFrame searchParams={searchParams}>
      <GeofencesPanel />
    </TrackingPageFrame>
  );
}
