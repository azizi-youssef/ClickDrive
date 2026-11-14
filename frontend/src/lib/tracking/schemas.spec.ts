import { describe, expect, it } from 'vitest';
import {
  alertPatchSchema,
  alertsQuerySchema,
  decodeCursor,
  encodeCursor,
  fleetQuerySchema,
  geofenceSchema,
  historyQuerySchema,
  settingsPatchSchema,
  supportGrantSchema,
  trackerCreateSchema,
  trackerPatchSchema,
  tripsQuerySchema,
} from './schemas';
import { mapDbError } from './errors';

const UUID = '10000000-0000-4000-8000-00000000000a';

describe('requêtes de lecture', () => {
  it('flotte : valeurs par défaut, état normalisé en majuscules, bornes de pagination', () => {
    expect(fleetQuerySchema.parse({})).toMatchObject({ limit: 200, offset: 0 });
    expect(fleetQuerySchema.parse({ state: 'moving' }).state).toBe('MOVING');
    expect(fleetQuerySchema.parse({ state: 'alerts' }).state).toBe('ALERTS');
    expect(fleetQuerySchema.safeParse({ state: 'inconnu' }).success).toBe(false);
    expect(fleetQuerySchema.safeParse({ limit: '501' }).success).toBe(false);
    expect(fleetQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(fleetQuerySchema.safeParse({ offset: '-1' }).success).toBe(false);
    expect(fleetQuerySchema.safeParse({ agency_id: 'pas-un-uuid' }).success).toBe(false);
    expect(fleetQuerySchema.safeParse({ q: 'x'.repeat(81) }).success).toBe(false);
  });

  it('historique : période obligatoire, 31 jours maximum, 1 000 points par page', () => {
    const base = { from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z' };
    expect(historyQuerySchema.parse(base)).toMatchObject({ limit: 500 });
    expect(historyQuerySchema.safeParse({ ...base, limit: '1001' }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ from: base.from }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ from: 'hier', to: base.to }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ from: base.to, to: base.from }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ from: '2026-10-01T00:00:00Z', to: '2026-11-02T00:00:00Z' }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ from: '2026-10-02T00:00:00Z', to: '2026-11-02T00:00:00Z' }).success).toBe(true);
    expect(historyQuerySchema.parse({ ...base, include_suspect: 'true' })).toMatchObject({ include_suspect: true });
    expect(historyQuerySchema.safeParse({ ...base, include_suspect: 'peut-être' }).success).toBe(false);
  });

  it('trajets : 93 jours maximum, pagination bornée', () => {
    const base = { from: '2026-09-01T00:00:00Z', to: '2026-11-01T00:00:00Z' };
    expect(tripsQuerySchema.parse(base)).toMatchObject({ page: 1, page_size: 25 });
    expect(tripsQuerySchema.safeParse({ from: '2026-01-01T00:00:00Z', to: '2026-11-01T00:00:00Z' }).success).toBe(false);
    expect(tripsQuerySchema.safeParse({ ...base, page_size: '101' }).success).toBe(false);
    expect(tripsQuerySchema.safeParse({ ...base, page: '0' }).success).toBe(false);
    expect(tripsQuerySchema.safeParse({ ...base, vehicle_id: 'x' }).success).toBe(false);
  });

  it('alertes : filtres énumérés uniquement', () => {
    expect(alertsQuerySchema.parse({ status: 'OPEN', type: 'SPEED_LIMIT', severity: 'CRITICAL' })).toMatchObject({ page: 1 });
    expect(alertsQuerySchema.safeParse({ status: 'CLOSED' }).success).toBe(false);
    expect(alertsQuerySchema.safeParse({ type: 'DROP TABLE' }).success).toBe(false);
  });

  it('curseur : aller-retour, et refus de toute valeur forgée', () => {
    const cursor = { recorded_at: '2026-11-14T10:00:00.123Z', id: 42 };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor('pas-un-curseur')).toBeNull();
    expect(decodeCursor(Buffer.from('hier|1').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('2026-11-14T10:00:00Z|-3').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('2026-11-14T10:00:00Z|1; DROP TABLE x').toString('base64url'))).toBeNull();
  });
});

describe('corps de requête : stricts', () => {
  it('boîtier : champs inconnus refusés (agency_id, status…), identifiant restreint', () => {
    const valid = { provider: 'klickdrive-gateway', external_device_id: 'IMEI-8650', label: 'Logan 12', vehicle_id: UUID };
    expect(trackerCreateSchema.safeParse(valid).success).toBe(true);
    expect(trackerCreateSchema.safeParse({ ...valid, agency_id: UUID }).success).toBe(false);
    expect(trackerCreateSchema.safeParse({ ...valid, status: 'ACTIVE' }).success).toBe(false);
    expect(trackerCreateSchema.safeParse({ ...valid, external_device_id: 'a b' }).success).toBe(false);
    expect(trackerCreateSchema.safeParse({ ...valid, external_device_id: "x'; --" }).success).toBe(false);
    expect(trackerCreateSchema.safeParse({ ...valid, provider: 'Fournisseur Inconnu!' }).success).toBe(false);
  });

  it('modification de boîtier : une seule opération par requête', () => {
    expect(trackerPatchSchema.safeParse({ label: 'Nouveau' }).success).toBe(true);
    expect(trackerPatchSchema.safeParse({ enabled: false }).success).toBe(true);
    expect(trackerPatchSchema.safeParse({ vehicle_id: UUID, reason: 'Déplacé' }).success).toBe(true);
    expect(trackerPatchSchema.safeParse({ vehicle_id: null }).success).toBe(true);
    expect(trackerPatchSchema.safeParse({ disconnect: true }).success).toBe(true);
    expect(trackerPatchSchema.safeParse({}).success).toBe(false);
    expect(trackerPatchSchema.safeParse({ label: 'x', vehicle_id: UUID }).success).toBe(false);
    expect(trackerPatchSchema.safeParse({ disconnect: true, enabled: true }).success).toBe(false);
    expect(trackerPatchSchema.safeParse({ agency_id: UUID, label: 'x' }).success).toBe(false);
  });

  it('zone : bornes du rayon et du centre, valeurs par défaut', () => {
    const valid = { name: 'Aéroport', center_latitude: 35.17, center_longitude: -2.93, radius_m: 500 };
    expect(geofenceSchema.parse(valid)).toMatchObject({ enabled: true, alert_on_enter: true, alert_on_exit: true, vehicle_ids: [] });
    expect(geofenceSchema.safeParse({ ...valid, radius_m: 24 }).success).toBe(false);
    expect(geofenceSchema.safeParse({ ...valid, radius_m: 100_001 }).success).toBe(false);
    expect(geofenceSchema.safeParse({ ...valid, radius_m: 100.5 }).success).toBe(false);
    expect(geofenceSchema.safeParse({ ...valid, center_latitude: 91 }).success).toBe(false);
    expect(geofenceSchema.safeParse({ ...valid, center_latitude: 0, center_longitude: 0 }).success).toBe(false);
    expect(geofenceSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
    expect(geofenceSchema.safeParse({ ...valid, agency_id: UUID }).success).toBe(false);
    expect(geofenceSchema.safeParse({ ...valid, vehicle_ids: ['pas-un-uuid'] }).success).toBe(false);
  });

  it('accusé de réception : action unique', () => {
    expect(alertPatchSchema.safeParse({ action: 'acknowledge' }).success).toBe(true);
    expect(alertPatchSchema.safeParse({ action: 'delete' }).success).toBe(false);
    expect(alertPatchSchema.safeParse({ action: 'acknowledge', status: 'OPEN' }).success).toBe(false);
  });

  it('paramètres : bornes de conservation, limite de vitesse requise pour l’alerte, clés inconnues refusées', () => {
    expect(settingsPatchSchema.safeParse({ retention_days: 30 }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ retention_days: 6 }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ retention_days: 731 }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ speed_alerts_enabled: true, speed_limit_kmh: null }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ speed_alerts_enabled: true, speed_limit_kmh: 90 }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ legal_basis: 'N_IMPORTE_QUOI' }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ quiet_hours_start: '25:00' }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ quiet_hours_start: '22:30' }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({}).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ agency_id: UUID }).success).toBe(false);
  });

  it('autorisation de support : motif de 10 caractères et durée de 5 à 120 minutes', () => {
    expect(supportGrantSchema.parse({ agency_id: UUID, reason: 'Ticket #4512 : localisation d’un véhicule' })).toMatchObject({ minutes: 30 });
    expect(supportGrantSchema.safeParse({ agency_id: UUID, reason: 'court' }).success).toBe(false);
    expect(supportGrantSchema.safeParse({ agency_id: UUID, reason: 'Motif suffisamment long', minutes: 121 }).success).toBe(false);
    expect(supportGrantSchema.safeParse({ agency_id: UUID, reason: 'Motif suffisamment long', minutes: 4 }).success).toBe(false);
  });
});

describe('traduction des erreurs de base de données', () => {
  it('codes SQLSTATE → statuts HTTP, messages neutres', () => {
    expect(mapDbError({ code: '42501', message: 'permission denied' }, 't')).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(mapDbError({ code: 'P0002', message: 'tracker not found' }, 't')).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint "uq_vehicle_trackers_vehicle"' }, 't')).toMatchObject({ status: 409, code: 'VEHICLE_ALREADY_HAS_TRACKER' });
    expect(mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint "uq_vehicle_trackers_device_active"' }, 't')).toMatchObject({ status: 409, code: 'DEVICE_ALREADY_REGISTERED' });
    expect(mapDbError({ code: '23505', message: 'violates unique constraint "uq_vehicle_geofences_name"' }, 't')).toMatchObject({ status: 409, code: 'GEOFENCE_NAME_TAKEN' });
    expect(mapDbError({ code: '23514', message: 'violates check constraint' }, 't')).toMatchObject({ status: 422, code: 'VALIDATION' });
    expect(mapDbError({ code: '22023', message: 'invalid date range (31 days maximum)' }, 't')).toMatchObject({ status: 422 });
    expect(mapDbError({ code: '54000', message: 'geofence limit reached' }, 't')).toMatchObject({ status: 409, code: 'LIMIT_REACHED' });
  });

  it('une erreur inattendue ne divulgue aucun détail technique', () => {
    const error = mapDbError({ code: 'XX000', message: 'relation "vehicle_locations" is corrupted at /var/lib/pg' }, 't');
    expect(error).toMatchObject({ status: 500, code: 'INTERNAL' });
    expect(error.message).not.toMatch(/vehicle_locations|var\/lib/);
  });

  it('un schéma incomplet (migration non appliquée) donne 503, pas 500', () => {
    expect(mapDbError({ code: 'PGRST202', message: 'Could not find the function' }, 't')).toMatchObject({ status: 503 });
  });
});
