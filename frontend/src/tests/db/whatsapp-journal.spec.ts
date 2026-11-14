import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, createTestDatabase, errorOf } from './harness';

/**
 * Migration 20261117000100 : journal des messages WhatsApp.
 * - un message entrant n'est enregistré qu'une fois (dédoublonnage des renvois de Meta) ;
 * - un accusé de réception ne fait jamais reculer un statut ;
 * - un envoi enregistré après son accusé de réception garde le meilleur statut ;
 * - table et fonctions réservées au serveur.
 */
describe('Journal des messages WhatsApp', () => {
  let db: PGlite;

  beforeAll(async () => {
    const created = await createTestDatabase();
    const failed = created.migrations.find((report) => !report.ok);
    if (failed) throw new Error(`Migration en échec : ${failed.file} — ${failed.error}`);
    db = created.db;
  });

  afterAll(async () => {
    await db?.close();
  });

  const statusOf = async (wamid: string) =>
    (await db.query<{ status: string }>(`SELECT status FROM public.whatsapp_messages WHERE wamid = $1`, [wamid])).rows[0]?.status;

  it('message entrant : une seule insertion par wamid (ON CONFLICT DO NOTHING)', async () => {
    const insert = () =>
      db.query<{ id: string }>(
        `INSERT INTO public.whatsapp_messages (wamid, direction, status, phone, message_type)
         VALUES ('wamid.in-1', 'INBOUND', 'RECEIVED', '212612345678', 'INBOUND')
         ON CONFLICT (wamid) DO NOTHING RETURNING id`
      );
    expect((await insert()).rows).toHaveLength(1);
    expect((await insert()).rows).toHaveLength(0);
  });

  it('accusés de réception : SENT → READ, puis un « delivered » tardif ne fait pas reculer', async () => {
    await db.query(`SELECT public.record_whatsapp_outbound('wamid.out-1', 'SENT', '212612345678', 'TEMPLATE', 'clickdrive_demande_recue')`);
    await db.query(`SELECT public.record_whatsapp_status('wamid.out-1', 'READ')`);
    const late = await db.query<{ status: string }>(`SELECT public.record_whatsapp_status('wamid.out-1', 'DELIVERED') AS status`);
    expect(late.rows[0].status).toBe('READ');
    expect(await statusOf('wamid.out-1')).toBe('READ');
    await db.query(`SELECT public.record_whatsapp_status('wamid.out-1', 'FAILED', NULL, '131047 Re-engagement message')`);
    expect(await statusOf('wamid.out-1')).toBe('FAILED');
  });

  it('accusé arrivé avant l’enregistrement de l’envoi : statut conservé, détails complétés', async () => {
    await db.query(`SELECT public.record_whatsapp_status('wamid.out-2', 'DELIVERED', '212600000000')`);
    await db.query(`SELECT public.record_whatsapp_outbound('wamid.out-2', 'SENT', '212600000000', 'TEMPLATE', 'clickdrive_etat_des_lieux', NULL, 'CD-2026-123456')`);
    const { rows } = await db.query<{ status: string; template_name: string; booking_ref: string; message_type: string }>(
      `SELECT status, template_name, booking_ref, message_type FROM public.whatsapp_messages WHERE wamid = 'wamid.out-2'`
    );
    expect(rows).toEqual([{ status: 'DELIVERED', template_name: 'clickdrive_etat_des_lieux', booking_ref: 'CD-2026-123456', message_type: 'TEMPLATE' }]);
  });

  it('envois refusés avant Meta (sans wamid) : plusieurs lignes possibles', async () => {
    await db.query(`SELECT public.record_whatsapp_outbound(NULL, 'FAILED', '212600000001', 'TEXT', NULL, NULL, NULL, NULL, 'Numéro invalide')`);
    await db.query(`SELECT public.record_whatsapp_outbound(NULL, 'FAILED', '212600000001', 'TEXT', NULL, NULL, NULL, NULL, 'Numéro invalide')`);
    const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.whatsapp_messages WHERE wamid IS NULL`);
    expect(rows[0].n).toBe(2);
  });

  it('réservé au serveur : ni lecture ni fonctions pour anon et authenticated', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const statement of [
        `SELECT id FROM public.whatsapp_messages`,
        `SELECT public.record_whatsapp_status('wamid.out-1', 'READ')`,
        `SELECT public.record_whatsapp_outbound('x', 'SENT', '1', 'TEXT')`,
      ]) {
        const error = await errorOf(asRole(db, role, null, (tx) => tx.query(statement)));
        expect(error, `${role} : ${statement}`).toMatch(/permission denied/i);
      }
    }
  });
});
