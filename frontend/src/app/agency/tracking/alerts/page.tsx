import { TrackingAlerts } from '@/components/agency/tracking/TrackingAlerts';
import { TrackingPageFrame } from '@/components/agency/tracking/TrackingPageFrame';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TrackingAlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const vehicle = typeof params.vehicle_id === 'string' ? params.vehicle_id : '';
  return (
    <TrackingPageFrame searchParams={searchParams}>
      <TrackingAlerts initialVehicleId={/^[0-9a-f-]{36}$/i.test(vehicle) ? vehicle : ''} />
    </TrackingPageFrame>
  );
}
