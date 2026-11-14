import { notFound } from 'next/navigation';
import { TrackingPageFrame } from '@/components/agency/tracking/TrackingPageFrame';
import { VehicleTrackingDetail } from '@/components/agency/tracking/VehicleTrackingDetail';

type Props = {
  params: Promise<{ vehicleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TrackingVehiclePage({ params, searchParams }: Props) {
  const { vehicleId } = await params;
  if (!UUID.test(vehicleId)) notFound();
  return (
    <TrackingPageFrame searchParams={searchParams}>
      <VehicleTrackingDetail vehicleId={vehicleId} />
    </TrackingPageFrame>
  );
}
