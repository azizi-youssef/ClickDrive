import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261108000100 : messages de contact et demandes de changement de formule.
 * Politiques réelles exécutées sous les rôles anon / authenticated / service_role, comme via PostgREST.
 */

const ID = {
  customer: '00000000-0000-4000-8000-0000000001a1',
  superAdmin: '00000000-0000-4000-8000-0000000001f1',
  adminA: '00000000-0000-4000-8000-0000000001a2',
  adminB: '00000000-0000-4000-8000-0000000001b2',
  agencyA: '10000000-0000-4000-8000-0000000001aa',
  agencyB: '10000000-0000-4000-8000-0000000001bb',
} as const;

const MESSAGE = `INSERT INTO public.contact_messages (reference, name, email, category, message)
                 VALUES ($1, 'Karim Benali', 'karim@test.invalid', 'reservation', 'Bonjour, une voiture est-elle libre en décembre ?')`;

async function seed(db: PGlite) {
  const users: [string, string][] = [
    [ID.customer, 'client@test.invalid'],
    [ID.superAdmin, 'super@test.invalid'],
    [ID.adminA, 'admin.a@test.invalid'],
    [ID.adminB, 'admin.b@test.invalid'],
  ];
  for (const [id, email] of users) {
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, email]);
  }
  await db.query(`UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = $1`, [ID.superAdmin]);

  const agency = `INSERT INTO public.agencies (id, name, slug, phone, whatsapp, email, address, status)
                  VALUES ($1, $2, $3, '0536000000', '0661000000', $4, 'Nador', 'ACTIVE')`;
  await db.query(agency, [ID.agencyA, 'Agence A', 'agence-a-plans', 'a@test.invalid']);
  await db.query(agency, [ID.agencyB, 'Agence B', 'agence-b-plans', 'b@test.invalid']);
  const member = `INSERT INTO public.agency_members (agency_id, user_id, role, status) VALUES ($1, $2, 'agency_admin', 'ACTIVE')`;
  await db.query(member, [ID.agencyA, ID.adminA]);
  await db.query(member, [ID.agencyB, ID.adminB]);

  await db.query(MESSAGE, ['MSG-20261108-AAAAAA']);
}

async function planId(db: PGlite, slug: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM public.subscription_plans WHERE slug = $1`, [slug]);
  if (!rows[0]) throw new Error(`Formule ${slug} absente du schéma de test`);
  return rows[0].id;
}

describe('Messages de contact et demandes de changement de formule (20261108000100)', () => {
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

  describe('contact_messages', () => {
    it('sans session : ni lecture ni écriture directe (le formulaire passe par l’API serveur)', async () => {
      expect(await errorOf(asRole(db, 'anon', null, (tx) => tx.query(`SELECT id FROM public.contact_messages`)))).toMatch(/permission denied/i);
      expect(await errorOf(asRole(db, 'anon', null, (tx) => tx.query(MESSAGE, ['MSG-20261108-BBBBBB'])))).toMatch(/permission denied/i);
    });

    it('un client connecté ne lit aucun message et ne peut pas en écrire directement', async () => {
      const rows = await asRole(db, 'authenticated', ID.customer, async (tx) => (await tx.query(`SELECT id FROM public.contact_messages`)).rows);
      expect(rows).toEqual([]);
      expect(await errorOf(asRole(db, 'authenticated', ID.customer, (tx) => tx.query(MESSAGE, ['MSG-20261108-CCCCCC'])))).toMatch(/permission denied/i);
    });

    it('le serveur (service_role) enregistre ; l’administration lit et suit le traitement', async () => {
      await asRole(db, 'service_role', null, (tx) => tx.query(MESSAGE, ['MSG-20261108-DDDDDD']));
      const read = await asRole(db, 'authenticated', ID.superAdmin, async (tx) =>
        (await tx.query<{ reference: string }>(`SELECT reference FROM public.contact_messages ORDER BY reference`)).rows.map((r) => r.reference)
      );
      expect(read).toContain('MSG-20261108-AAAAAA');
      const updated = await asRole(db, 'authenticated', ID.superAdmin, async (tx) =>
        (await tx.query(`UPDATE public.contact_messages SET status = 'CLOSED' WHERE reference = 'MSG-20261108-AAAAAA' RETURNING id`)).rows
      );
      expect(updated).toHaveLength(1);
    });

    it('contraintes : référence au bon format, message de 20 caractères minimum', async () => {
      expect(await errorOf(asRole(db, 'service_role', null, (tx) => tx.query(MESSAGE, ['MSG-1'])))).toMatch(/check constraint/i);
      expect(
        await errorOf(
          asRole(db, 'service_role', null, (tx) =>
            tx.query(`INSERT INTO public.contact_messages (reference, name, email, category, message)
                      VALUES ('MSG-20261108-EEEEEE', 'Karim', 'karim@test.invalid', 'other', 'Trop court')`)
          )
        )
      ).toMatch(/check constraint/i);
    });
  });

  describe('subscription_change_requests', () => {
    const request = `INSERT INTO public.subscription_change_requests (agency_id, requested_plan_id, amount_due, requested_by)
                     VALUES ($1, $2, 500, $3) RETURNING id`;

    it('aucune écriture directe par un membre d’agence : la demande passe par l’API serveur', async () => {
      const pro = await planId(db, 'pro');
      const error = await errorOf(asRole(db, 'authenticated', ID.adminA, (tx) => tx.query(request, [ID.agencyA, pro, ID.adminA])));
      expect(error).toMatch(/permission denied/i);
    });

    it('une seule demande en attente par agence ; chaque agence ne lit que les siennes', async () => {
      const pro = await planId(db, 'pro');
      const business = await planId(db, 'business');
      await db.query(request, [ID.agencyA, pro, ID.adminA]);
      expect(await errorOf(db.query(request, [ID.agencyA, business, ID.adminA]))).toMatch(/duplicate key|unique/i);

      const seenByA = await asRole(db, 'authenticated', ID.adminA, async (tx) =>
        (await tx.query(`SELECT agency_id FROM public.subscription_change_requests`)).rows
      );
      const seenByB = await asRole(db, 'authenticated', ID.adminB, async (tx) =>
        (await tx.query(`SELECT agency_id FROM public.subscription_change_requests`)).rows
      );
      expect(seenByA).toEqual([{ agency_id: ID.agencyA }]);
      expect(seenByB).toEqual([]);
      expect(await errorOf(asRole(db, 'anon', null, (tx) => tx.query(`SELECT id FROM public.subscription_change_requests`)))).toMatch(/permission denied/i);
    });

    it('une décision porte toujours sa date ; une demande traitée libère la place', async () => {
      const business = await planId(db, 'business');
      expect(
        await errorOf(db.query(`UPDATE public.subscription_change_requests SET status = 'APPROVED' WHERE agency_id = $1`, [ID.agencyA]))
      ).toMatch(/check constraint/i);
      await db.query(
        `UPDATE public.subscription_change_requests SET status = 'APPROVED', decided_at = now(), decided_by = $2 WHERE agency_id = $1`,
        [ID.agencyA, ID.superAdmin]
      );
      await db.query(request, [ID.agencyA, business, ID.adminA]);
      const { rows } = await db.query<{ status: string }>(
        `SELECT status FROM public.subscription_change_requests WHERE agency_id = $1 ORDER BY created_at, status`,
        [ID.agencyA]
      );
      expect(rows.map((r) => r.status).sort()).toEqual(['APPROVED', 'PENDING_PAYMENT']);
    });
  });
});
