import { describe, expect, it } from 'vitest';
import { canPerformAgencyBookingAction } from '@clickdrive/shared/booking-state-machine';
import { BOOKING_STATUSES } from '@clickdrive/shared/booking-status';
import { AGENCY_TO_PROCESS_STATUSES } from './agency-queue';

describe('File « à traiter » de l’agence', () => {
  it('correspond exactement aux statuts depuis lesquels l’agence peut valider une demande', () => {
    const approvable = BOOKING_STATUSES.filter((status) => canPerformAgencyBookingAction(status, 'approve'));
    expect(new Set(AGENCY_TO_PROCESS_STATUSES)).toEqual(new Set(approvable));
  });

  it('correspond à la définition SQL de l’indicateur « À traiter » (statistiques de l’agence)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const sql = readFileSync(
      resolve(process.cwd(), '../backend/supabase/migrations/20261012000200_agency_dashboard_vehicle_schema_compatibility.sql'),
      'utf8'
    );
    const match = /'pendingBookings',\s*\(\s*SELECT count\(\*\) FROM public\.bookings\s*WHERE agency_id = p_agency_id\s*AND status IN \(([^)]*)\)/.exec(sql);
    expect(match).not.toBeNull();
    const sqlStatuses = match![1]!.split(',').map((value) => value.trim().replace(/'/g, ''));
    expect(new Set(AGENCY_TO_PROCESS_STATUSES)).toEqual(new Set(sqlStatuses));
  });
});
