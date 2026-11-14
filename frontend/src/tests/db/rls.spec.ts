import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Isolation des données en base (RLS + privilèges de colonnes), testée comme le ferait PostgREST :
 * chaque requête s'exécute sous le rôle anon / authenticated avec les claims JWT de l'utilisateur.
 * Aucune fonction d'autorisation n'est simulée : ce sont les politiques réelles des migrations.
 */

const ID = {
  customerA: '00000000-0000-4000-8000-0000000000a1',
  customerB: '00000000-0000-4000-8000-0000000000b1',
  adminA: '00000000-0000-4000-8000-0000000000a2',
  agentA: '00000000-0000-4000-8000-0000000000a3',
  viewerA: '00000000-0000-4000-8000-0000000000a4',
  revokedA: '00000000-0000-4000-8000-0000000000a5',
  adminB: '00000000-0000-4000-8000-0000000000b2',
  memberC: '00000000-0000-4000-8000-0000000000c2',
  superAdmin: '00000000-0000-4000-8000-0000000000f1',
  legacyAdmin: '00000000-0000-4000-8000-0000000000f2',
  agencyA: '10000000-0000-4000-8000-00000000000a',
  agencyB: '10000000-0000-4000-8000-00000000000b',
  agencyC: '10000000-0000-4000-8000-00000000000c',
  vehicleA: '20000000-0000-4000-8000-00000000000a',
  vehicleB: '20000000-0000-4000-8000-00000000000b',
  vehicleC: '20000000-0000-4000-8000-00000000000c',
  vehicleHidden: '20000000-0000-4000-8000-0000000000aa',
  bookingA: '30000000-0000-4000-8000-00000000000a',
  bookingB: '30000000-0000-4000-8000-00000000000b',
  bookingC: '30000000-0000-4000-8000-00000000000c',
} as const;

const PII_COLUMNS = ['cin', 'license_number', 'birth_date', 'customer_notes', 'flight_number', 'customer_phone', 'customer_email'];

async function seed(db: PGlite) {
  const users: [string, string][] = [
    [ID.customerA, 'customer.a@test.invalid'],
    [ID.customerB, 'customer.b@test.invalid'],
    [ID.adminA, 'admin.a@test.invalid'],
    [ID.agentA, 'agent.a@test.invalid'],
    [ID.viewerA, 'viewer.a@test.invalid'],
    [ID.revokedA, 'revoked.a@test.invalid'],
    [ID.adminB, 'admin.b@test.invalid'],
    [ID.memberC, 'member.c@test.invalid'],
    [ID.superAdmin, 'super@test.invalid'],
    [ID.legacyAdmin, 'legacy@test.invalid'],
  ];
  for (const [id, email] of users) {
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, email]);
  }
  // Le déclencheur d'inscription crée les profils en CUSTOMER : les rôles plateforme sont posés par l'administration
  await db.query(`UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = $1`, [ID.superAdmin]);
  await db.query(`UPDATE public.profiles SET role = 'ADMIN' WHERE id = $1`, [ID.legacyAdmin]);

  const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                  VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', $5)`;
  await db.query(agency, [ID.agencyA, 'Agence A', 'agence-a', 'a@test.invalid', 'ACTIVE']);
  await db.query(agency, [ID.agencyB, 'Agence B', 'agence-b', 'b@test.invalid', 'ACTIVE']);
  await db.query(agency, [ID.agencyC, 'Agence C', 'agence-c', 'c@test.invalid', 'SUSPENDED']);

  const member = `INSERT INTO public.agency_members (agency_id, user_id, role, status, revoked_at)
                  VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'REVOKED' THEN now() END)`;
  await db.query(member, [ID.agencyA, ID.adminA, 'agency_admin', 'ACTIVE']);
  await db.query(member, [ID.agencyA, ID.agentA, 'agency_agent', 'ACTIVE']);
  await db.query(member, [ID.agencyA, ID.viewerA, 'viewer', 'ACTIVE']);
  await db.query(member, [ID.agencyA, ID.revokedA, 'agency_admin', 'REVOKED']);
  await db.query(member, [ID.agencyB, ID.adminB, 'agency_admin', 'ACTIVE']);
  await db.query(member, [ID.agencyC, ID.memberC, 'agency_admin', 'ACTIVE']);

  const vehicle = `INSERT INTO public.vehicles (id, agency_id, unit_number, brand, model, slug, year, category, transmission, fuel, daily_price, published)
                   VALUES ($1, $2, $3, 'Dacia', 'Logan', $4, 2025, 'Économique', 'MANUAL', 'DIESEL', 300, $5)`;
  await db.query(vehicle, [ID.vehicleA, ID.agencyA, 'A-1', 'dacia-logan-a', true]);
  await db.query(vehicle, [ID.vehicleB, ID.agencyB, 'B-1', 'dacia-logan-b', true]);
  await db.query(vehicle, [ID.vehicleC, ID.agencyC, 'C-1', 'dacia-logan-c', true]);
  await db.query(vehicle, [ID.vehicleHidden, ID.agencyA, 'A-2', 'dacia-logan-hidden', false]);

  const booking = `INSERT INTO public.bookings (id, booking_ref, reference, vehicle_id, agency_id, customer_id,
                     customer_name, customer_email, customer_phone, cin, license_number, birth_date,
                     customer_notes, flight_number, start_date, end_date, total_days, daily_price, total_price,
                     deposit_amount, status)
                   VALUES ($1, $2, $2, $3, $4, $5, $6, $7, '0600000000', 'S123456', 'L-98765', '1990-01-01',
                     'note privée', 'AT1402', '2026-12-10', '2026-12-14', 4, 300, 1200, 3000, 'REQUESTED')`;
  await db.query(booking, [ID.bookingA, 'CD-2026-100001', ID.vehicleA, ID.agencyA, ID.customerA, 'Client A', 'customer.a@test.invalid']);
  await db.query(booking, [ID.bookingB, 'CD-2026-100002', ID.vehicleB, ID.agencyB, ID.customerB, 'Client B', 'customer.b@test.invalid']);
  await db.query(booking, [ID.bookingC, 'CD-2026-100003', ID.vehicleC, ID.agencyC, ID.customerB, 'Client B', 'customer.b@test.invalid']);
}

const visibleBookingIds = async (db: PGlite, userId: string | null, role: 'anon' | 'authenticated' = 'authenticated') =>
  asRole(db, role, userId, async (tx) =>
    (await tx.query<{ id: string }>(`SELECT id FROM public.bookings ORDER BY id`)).rows.map((row) => row.id)
  );

describe('RLS — isolation des réservations et des données personnelles', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;
    await seed(db);
  });

  afterAll(async () => {
    await db?.close();
  });

  describe('Clients', () => {
    it('un client ne voit que ses propres réservations', async () => {
      expect(await visibleBookingIds(db, ID.customerA)).toEqual([ID.bookingA]);
      expect(await visibleBookingIds(db, ID.customerB)).toEqual([ID.bookingB, ID.bookingC]);
    });

    it('un client ne peut pas lire la réservation d’un autre client, même par son identifiant ou sa référence', async () => {
      const rows = await asRole(db, 'authenticated', ID.customerA, async (tx) =>
        (await tx.query(`SELECT id FROM public.bookings WHERE id = $1 OR reference = 'CD-2026-100002'`, [ID.bookingB])).rows
      );
      expect(rows).toEqual([]);
    });

    it.each(PII_COLUMNS)('la colonne sensible « %s » n’est pas lisible par l’API (même sur sa propre réservation)', async (column) => {
      const error = await errorOf(
        asRole(db, 'authenticated', ID.customerA, (tx) => tx.query(`SELECT ${column} FROM public.bookings WHERE id = $1`, [ID.bookingA]))
      );
      expect(error).toMatch(/permission denied/i);
    });

    it('un client ne peut ni créer, ni modifier, ni supprimer une réservation directement', async () => {
      const insert = await errorOf(
        asRole(db, 'authenticated', ID.customerA, (tx) =>
          tx.query(`INSERT INTO public.bookings (booking_ref, vehicle_id, agency_id, customer_name, customer_email, customer_phone,
                      start_date, end_date, total_days, daily_price, total_price, deposit_amount)
                    VALUES ('CD-2026-999999', $1, $2, 'X', 'x@test.invalid', '0600000000', '2027-01-01', '2027-01-03', 2, 1, 2, 0)`,
          [ID.vehicleA, ID.agencyA])
        )
      );
      expect(insert).toMatch(/permission denied/i);

      const update = await errorOf(
        asRole(db, 'authenticated', ID.customerA, (tx) =>
          tx.query(`UPDATE public.bookings SET customer_id = $1, status = 'APPROVED' WHERE id = $2`, [ID.customerB, ID.bookingA])
        )
      );
      expect(update).toMatch(/permission denied/i);

      const remove = await errorOf(
        asRole(db, 'authenticated', ID.customerA, (tx) => tx.query(`DELETE FROM public.bookings WHERE id = $1`, [ID.bookingA]))
      );
      expect(remove).toMatch(/permission denied/i);
    });

    it('un client ne lit pas l’historique d’une réservation d’un autre client', async () => {
      await db.query(
        `INSERT INTO public.booking_events (booking_id, actor_role, event_type) VALUES ($1, 'CUSTOMER', 'REQUEST_CREATED')`,
        [ID.bookingB]
      );
      const rows = await asRole(db, 'authenticated', ID.customerA, async (tx) =>
        (await tx.query(`SELECT id FROM public.booking_events WHERE booking_id = $1`, [ID.bookingB])).rows
      );
      expect(rows).toEqual([]);
    });

    it('un client ne lit pas le profil (e-mail) d’un autre utilisateur', async () => {
      const rows = await asRole(db, 'authenticated', ID.customerA, async (tx) =>
        (await tx.query(`SELECT id, email FROM public.profiles WHERE id <> $1`, [ID.customerA])).rows
      );
      expect(rows).toEqual([]);
    });

    it('un client ne peut pas s’attribuer un rôle plateforme', async () => {
      const error = await errorOf(
        asRole(db, 'authenticated', ID.customerA, (tx) =>
          tx.query(`UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = $1`, [ID.customerA])
        )
      );
      const { rows } = await db.query<{ role: string }>(`SELECT role FROM public.profiles WHERE id = $1`, [ID.customerA]);
      expect(rows[0].role).toBe('CUSTOMER');
      expect(error ?? 'aucune erreur mais rôle inchangé').toBeTruthy();
    });
  });

  describe('Visiteurs anonymes', () => {
    it('aucune réservation n’est lisible sans session', async () => {
      const error = await errorOf(visibleBookingIds(db, null, 'anon'));
      expect(error).toMatch(/permission denied/i);
    });

    it('le catalogue public n’expose que les véhicules publiés d’agences actives', async () => {
      const ids = await asRole(db, 'anon', null, async (tx) =>
        (await tx.query<{ id: string }>(`SELECT id FROM public.vehicles ORDER BY id`)).rows.map((row) => row.id)
      );
      expect(ids).toContain(ID.vehicleA);
      expect(ids).toContain(ID.vehicleB);
      expect(ids).not.toContain(ID.vehicleHidden);
      expect(ids, 'véhicule d’une agence suspendue visible publiquement').not.toContain(ID.vehicleC);
    });

    it('la fonction de disponibilité est appelable sans session et ne renvoie que des booléens', async () => {
      const rows = await asRole(db, 'anon', null, async (tx) =>
        (await tx.query<{ vehicle_id: string; available: boolean }>(
          `SELECT * FROM public.vehicle_availability(ARRAY[$1, $2]::uuid[], '2026-12-11', '2026-12-12')`,
          [ID.vehicleA, ID.vehicleHidden]
        )).rows
      );
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.vehicle_id === ID.vehicleHidden)?.available).toBe(false);
    });
  });

  describe('Membres d’agence', () => {
    it('chaque agence ne voit que ses propres réservations', async () => {
      expect(await visibleBookingIds(db, ID.adminA)).toEqual([ID.bookingA]);
      expect(await visibleBookingIds(db, ID.adminB)).toEqual([ID.bookingB]);
    });

    it('agent et lecteur actifs lisent les réservations de leur agence uniquement', async () => {
      expect(await visibleBookingIds(db, ID.agentA)).toEqual([ID.bookingA]);
      expect(await visibleBookingIds(db, ID.viewerA)).toEqual([ID.bookingA]);
    });

    it('un membre révoqué perd immédiatement tout accès', async () => {
      expect(await visibleBookingIds(db, ID.revokedA)).toEqual([]);
    });

    it('la suspension d’une agence retire l’accès de ses membres', async () => {
      expect(await visibleBookingIds(db, ID.memberC)).toEqual([]);
    });

    it('la révocation prend effet sans délai (aucun cache de droits)', async () => {
      expect(await visibleBookingIds(db, ID.agentA)).toEqual([ID.bookingA]);
      await db.query(`UPDATE public.agency_members SET status = 'REVOKED', revoked_at = now() WHERE user_id = $1`, [ID.agentA]);
      try {
        expect(await visibleBookingIds(db, ID.agentA)).toEqual([]);
      } finally {
        await db.query(`UPDATE public.agency_members SET status = 'ACTIVE', revoked_at = NULL WHERE user_id = $1`, [ID.agentA]);
      }
    });

    it('les membres d’agence ne lisent pas non plus les colonnes d’identité des clients en SQL direct', async () => {
      const error = await errorOf(
        asRole(db, 'authenticated', ID.adminA, (tx) => tx.query(`SELECT cin, license_number FROM public.bookings`))
      );
      expect(error).toMatch(/permission denied/i);
    });

    it('un membre ne peut pas modifier son rôle ni s’ajouter à une autre agence', async () => {
      const update = await errorOf(
        asRole(db, 'authenticated', ID.agentA, (tx) =>
          tx.query(`UPDATE public.agency_members SET role = 'agency_admin' WHERE user_id = $1`, [ID.agentA])
        )
      );
      expect(update).toMatch(/permission denied/i);
      const insert = await errorOf(
        asRole(db, 'authenticated', ID.agentA, (tx) =>
          tx.query(`INSERT INTO public.agency_members (agency_id, user_id, role, status) VALUES ($1, $2, 'agency_admin', 'ACTIVE')`, [
            ID.agencyB,
            ID.agentA,
          ])
        )
      );
      expect(insert).toMatch(/permission denied/i);
    });

    it('aucune écriture directe sur la flotte (agent, autre agence, ni même l’administrateur de l’agence)', async () => {
      // Migration 20261115000100 : les écritures de flotte passent exclusivement par l'API serveur
      for (const [userId, vehicleId] of [
        [ID.agentA, ID.vehicleA],
        [ID.adminA, ID.vehicleB],
        [ID.adminA, ID.vehicleA],
      ]) {
        const error = await errorOf(
          asRole(db, 'authenticated', userId, (tx) =>
            tx.query(`UPDATE public.vehicles SET daily_price = 1 WHERE id = $1 RETURNING id`, [vehicleId])
          )
        );
        expect(error).toMatch(/permission denied/i);
      }
    });
  });

  describe('Administration plateforme', () => {
    it('SUPER_ADMIN lit toutes les réservations (colonnes non sensibles)', async () => {
      expect(await visibleBookingIds(db, ID.superAdmin)).toEqual([ID.bookingA, ID.bookingB, ID.bookingC]);
    });

    it('le rôle historique ADMIN n’obtient aucun droit global', async () => {
      expect(await visibleBookingIds(db, ID.legacyAdmin)).toEqual([]);
    });
  });

  describe('Fonctions et politiques (durcissement 20261107000100)', () => {
    it.each([
      [`SELECT public.invite_agency_member('${ID.agencyA}', '${ID.customerA}', 'agency_admin')`],
      [`SELECT public.change_agency_member_role('${ID.agencyA}', 'agency_admin')`],
      [`SELECT public.revoke_agency_member('${ID.agencyA}')`],
      [`SELECT public.accept_agency_invitation('${ID.agencyA}')`],
      [`SELECT public.count_agency_customers('${ID.agencyA}')`],
      [`SELECT * FROM public.admin_agency_overview('${ID.agencyA}')`],
      [`SELECT public.expire_completed_bookings()`],
    ])('sans session, %s est refusé', async (sql) => {
      const error = await errorOf(asRole(db, 'anon', null, (tx) => tx.query(sql)));
      expect(error).toMatch(/permission denied/i);
    });

    it('aucune politique d’écriture permissive (WITH CHECK true) ne subsiste sur les réservations', async () => {
      const { rows } = await db.query<{ polname: string }>(
        `SELECT polname FROM pg_policy
          WHERE polrelid IN ('public.bookings'::regclass, 'public.booking_events'::regclass)
            AND polcmd IN ('a', 'w', '*') AND pg_get_expr(polwithcheck, polrelid) = 'true'`
      );
      expect(rows).toEqual([]);
    });

    it('un client connecté ne peut pas inviter un membre dans une agence', async () => {
      const error = await errorOf(
        asRole(db, 'authenticated', ID.customerA, (tx) =>
          tx.query(`SELECT public.invite_agency_member($1, $2, 'agency_admin')`, [ID.agencyA, ID.customerA])
        )
      );
      expect(error).toMatch(/not authorized|permission denied/i);
    });
  });

  describe('Contrainte anti-chevauchement', () => {
    it('deux réservations confirmées ne peuvent pas se chevaucher sur le même véhicule', async () => {
      await db.query(`UPDATE public.bookings SET status = 'APPROVED' WHERE id = $1`, [ID.bookingA]);
      const error = await errorOf(
        db.query(
          `INSERT INTO public.bookings (booking_ref, reference, vehicle_id, agency_id, customer_name, customer_email, customer_phone,
             start_date, end_date, total_days, daily_price, total_price, deposit_amount, status)
           VALUES ('CD-2026-100009', 'CD-2026-100009', $1, $2, 'Client C', 'c@test.invalid', '0600000000',
             '2026-12-12', '2026-12-16', 4, 300, 1200, 3000, 'APPROVED')`,
          [ID.vehicleA, ID.agencyA]
        )
      );
      expect(error).toMatch(/no_overlapping_confirmed_bookings|exclusion|conflicting key/i);
    });
  });
});
