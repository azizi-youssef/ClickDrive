import { TrackingPageFrame } from '@/components/agency/tracking/TrackingPageFrame';
import { TrackingSettingsPanel } from '@/components/agency/tracking/TrackingSettingsPanel';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function TrackingSettingsPage({ searchParams }: Props) {
  return (
    <TrackingPageFrame searchParams={searchParams}>
      <TrackingSettingsPanel />
    </TrackingPageFrame>
  );
}
