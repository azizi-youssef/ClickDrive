import { TrackingPageFrame } from '@/components/agency/tracking/TrackingPageFrame';
import { TripHistory } from '@/components/agency/tracking/TripHistory';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TrackingHistoryPage({ searchParams }: Props) {
  const params = await searchParams;
  const vehicle = typeof params.vehicle_id === 'string' ? params.vehicle_id : '';
  return (
    <TrackingPageFrame searchParams={searchParams}>
      <TripHistory initialVehicleId={/^[0-9a-f-]{36}$/i.test(vehicle) ? vehicle : ''} />
    </TrackingPageFrame>
  );
}
