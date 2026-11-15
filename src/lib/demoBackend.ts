// Demo mode: the real LuxDrive database (schema.sql) running in the browser with PGlite.
// Same rules, same security (RLS) as production. Data stays in this browser only.
import { PGlite, type Transaction } from '@electric-sql/pglite';
import stubSql from '../../supabase/demo/stub.sql?raw';
import schemaSql from '../../supabase/schema.sql?raw';
import seedSql from '../../supabase/demo/seed.sql?raw';
import type { Backend, Filter } from './backend';

// The demo runs without the btree_gist extension (one file fewer to host). The overlap
// rules stay enforced by the booking functions; production keeps the extra database guard.
const demoSchema = schemaSql
  .replace(/create extension if not exists btree_gist[^;]*;/, '')
  .replace(/,\s*-- Jamais deux leçons[^\n]*\n\s*constraint lecons_moniteur_sans_chevauchement[\s\S]*?constraint lecons_eleve_sans_chevauchement[\s\S]*?where \(statut in \('reservee','effectuee','absence'\)\)/, '');

const DB_NAME = 'luxdrive-demo-5';
const USER_KEY = 'luxdrive-demo-user';
const SETOF = new Set(['creneaux_libres']);
const AE = '00000000-0000-4000-8000-000000000001';

const isoTz = (v: string) => {
  let s = v.replace(' ', 'T');
  if (/[+-]\d\d$/.test(s)) s += ':00';
  return s;
};
const ident = (k: string) => { if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error('bad identifier'); return k; };

const CERTIF_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300"><rect width="420" height="300" fill="#fff" stroke="#111"/>` +
  `<text x="24" y="50" font-family="serif" font-size="22">Certificat médical (exemple)</text>` +
  `<text x="24" y="100" font-family="sans-serif" font-size="14">Dr. Exemple — Differdange</text>` +
  `<text x="24" y="130" font-family="sans-serif" font-size="14">Incapacité de conduire pendant 3 jours.</text>` +
  `<text x="24" y="260" font-family="sans-serif" font-size="12" fill="#888">Document de démonstration</text></svg>`);

export async function createDemoBackend(): Promise<Backend> {
  const useMemory = new URLSearchParams(location.search).has('memoire');
  const opts = {
    parsers: { 1700: (v: string) => Number(v), 1184: isoTz, 1082: (v: string) => v, 1114: (v: string) => v },
  };
  let persistent = !useMemory;
  let db: PGlite;
  try {
    db = await PGlite.create({ ...opts, dataDir: persistent ? `idb://${DB_NAME}` : undefined });
  } catch {
    persistent = false; // browser storage refused: the demo still works, but starts fresh on each visit
    db = await PGlite.create(opts);
  }
  await db.exec(`set timezone = 'UTC'`);

  const listeners = new Set<() => void>();
  const store = {
    get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
    del: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  let uid: string | null = persistent ? store.get(USER_KEY) : null;

  async function run<T = any>(who: string | null | 'service', sql: string, params: unknown[] = []): Promise<T[]> {
    const role = who === 'service' ? 'service_role' : who ? 'authenticated' : 'anon';
    const claims = who === 'service' ? { role: 'service_role' } : who ? { sub: who, role: 'authenticated' } : { role: 'anon' };
    return db.transaction(async (tx: Transaction) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      await tx.exec(`set local role ${role}`);
      const r = await tx.query<T>(sql, params);
      return r.rows;
    });
  }
  const rpcAs = async (who: string | 'service', fn: string, args: Record<string, unknown> = {}) => {
    const keys = Object.keys(args);
    const call = `public.${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')})`;
    const vals = keys.map(k => args[k] ?? null);
    if (SETOF.has(fn)) return run(who, `select * from ${call}`, vals);
    const rows = await run<{ r: unknown }>(who, `select ${call} as r`, vals);
    return rows[0]?.r;
  };

  // First start: create the database and fill it with demo data
  const exists = (await db.query(`select to_regclass('public.auto_ecoles') as t`)).rows[0] as { t: string | null };
  if (!exists.t) {
    await db.exec(stubSql);
    await db.exec(demoSchema);
    await db.exec(seedSql);
    await db.query(`insert into public.demo_files (chemin, data_url) values ($1, $2)`,
      ['d0000000-0000-4000-8000-000000000006/certificat-exemple.svg', CERTIF_SVG]);
    const ana = 'd0000000-0000-4000-8000-000000000006', lucas = 'd0000000-0000-4000-8000-000000000007',
      ines = 'd0000000-0000-4000-8000-000000000008', sara = 'd0000000-0000-4000-8000-000000000002';
    const f16 = await rpcAs(ana, 'creer_facture', { p_eleve: ana, p_code: 'f16', p_moyen: 'wero' });
    await rpcAs('service', 'encaisser_facture', { p_facture: f16, p_moyen: 'wero', p_reference: 'demo' });
    let booked = 0;
    for (let d = 3; booked < 2 && d < 20; d++) {
      const jour = (await db.query<{ j: string }>(`select ((now() at time zone 'Europe/Luxembourg')::date + $1::int)::text j`, [d])).rows[0].j;
      const slots = await rpcAs(ana, 'creneaux_libres', { p_jour: jour }) as { debut: string }[];
      const pick = slots.find(s => s.debut.includes('T09') || s.debut.includes('T08')) ?? slots[0];
      if (pick) { await rpcAs(ana, 'reserver_lecon', { p_debut: pick.debut }); booked++; d += 3; }
    }
    await rpcAs(sara, 'ajuster_solde', { p_eleve: lucas, p_heures: 2, p_motif: 'Reprise de dossier' });
    await rpcAs(sara, 'creer_facture', { p_eleve: lucas, p_code: 'inscription', p_moyen: 'especes' });
    await rpcAs(sara, 'creer_facture', { p_eleve: lucas, p_code: 'f8', p_moyen: 'virement' });
    const fi = await rpcAs(sara, 'creer_facture', { p_eleve: ines, p_code: 'inscription', p_moyen: 'especes' });
    await rpcAs(sara, 'encaisser_facture', { p_facture: fi, p_moyen: 'especes' });
  }

  const notify = () => listeners.forEach(l => l());

  return {
    demo: true,
    passwordSetupPending: false,
    async updatePassword() { /* no passwords in demo */ },
    demoAccounts: [
      { email: 'ana@demo.lu', label: 'Ana Silva — élève' },
      { email: 'lucas@demo.lu', label: 'Lucas Muller — élève' },
      { email: 'ines@demo.lu', label: 'Inês Rodrigues — élève (conduite accompagnée)' },
      { email: 'marc@demo.lu', label: 'Marc Weber — moniteur' },
      { email: 'bureau@demo.lu', label: 'Sara Mendes — secrétariat' },
      { email: 'gerant@demo.lu', label: 'Carla Lisboa — gérante' },
    ],
    async signIn(email) {
      const r = (await db.query<{ id: string }>(`select id from auth.users where lower(email) = lower($1)`, [email.trim()])).rows[0];
      if (!r) throw new Error('IDENTIFIANTS_INVALIDES');
      uid = r.id; store.set(USER_KEY, uid); notify();
    },
    async signOut() { uid = null; store.del(USER_KEY); notify(); },
    async resetPassword() { /* nothing to send in demo */ },
    async currentUser() {
      if (!uid) return null;
      const r = (await db.query<{ email: string }>(`select email from auth.users where id = $1`, [uid])).rows[0];
      return r ? { id: uid, email: r.email } : null;
    },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async rpc(fn, args = {}) { return rpcAs(uid ?? 'anon', fn, args) as any; },
    async select(table, f: Filter = {}) {
      const where: string[] = []; const params: unknown[] = [];
      const p = (v: unknown) => { params.push(v); return '$' + params.length; };
      for (const [k, v] of Object.entries(f.eq ?? {})) where.push(`${ident(k)} = ${p(v)}`);
      for (const [k, v] of Object.entries(f.neq ?? {})) where.push(`${ident(k)} is distinct from ${p(v)}`);
      for (const [k, v] of Object.entries(f.gte ?? {})) where.push(`${ident(k)} >= ${p(v)}`);
      for (const [k, v] of Object.entries(f.lt ?? {})) where.push(`${ident(k)} < ${p(v)}`);
      for (const [k, v] of Object.entries(f.in ?? {})) where.push(`${ident(k)} = any(${p(v)})`);
      for (const k of f.isNull ?? []) where.push(`${ident(k)} is null`);
      for (const k of f.notNull ?? []) where.push(`${ident(k)} is not null`);
      let sql = `select * from public.${ident(table)}`;
      if (where.length) sql += ' where ' + where.join(' and ');
      if (f.order?.length) sql += ' order by ' + f.order.map(([k, d]) => `${ident(k)} ${d === 'desc' ? 'desc' : 'asc'}`).join(', ');
      if (f.limit) sql += ` limit ${Math.floor(f.limit)}`;
      return run(uid, sql, params) as any;
    },
    async update(table, values, eq) {
      const params: unknown[] = []; const p = (v: unknown) => { params.push(v); return '$' + params.length; };
      const set = Object.entries(values).map(([k, v]) => `${ident(k)} = ${p(v)}`).join(', ');
      const where = Object.entries(eq).map(([k, v]) => `${ident(k)} = ${p(v)}`).join(' and ');
      await run(uid, `update public.${ident(table)} set ${set} where ${where}`, params);
    },
    async insert(table, rows) {
      for (const row of rows) {
        const keys = Object.keys(row);
        await run(uid, `insert into public.${ident(table)} (${keys.map(ident).join(', ')}) values (${keys.map((_, i) => '$' + (i + 1)).join(', ')})`, keys.map(k => row[k]));
      }
    },
    async remove(table, eq) {
      const keys = Object.keys(eq);
      await run(uid, `delete from public.${ident(table)} where ${keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(' and ')}`, keys.map(k => eq[k]));
    },
    async upload(bucket, path, file) {
      await run(uid, `insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, path]);
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(file); });
      await db.query(`insert into public.demo_files (chemin, data_url) values ($1, $2) on conflict (chemin) do update set data_url = excluded.data_url`, [path, dataUrl]);
    },
    async fileUrl(bucket, path) {
      const ok = await run(uid, `select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, path]);
      if (!ok.length) throw new Error('INTERDIT');
      const r = (await db.query<{ data_url: string }>(`select data_url from public.demo_files where chemin = $1`, [path])).rows[0];
      return r?.data_url ?? CERTIF_SVG;
    },
    async removeFile(bucket, path) {
      await run(uid, `delete from storage.objects where bucket_id = $1 and name = $2`, [bucket, path]);
      await db.query(`delete from public.demo_files where chemin = $1`, [path]);
    },
    async invite(inv) {
      const bureau = await run<{ b: boolean }>(uid, `select public.est_bureau() b`);
      if (!bureau[0]?.b) throw new Error('INTERDIT');
      if (inv.role !== 'eleve' && (await run<{ r: string }>(uid, `select public.mon_role() r`))[0].r !== 'gerant') throw new Error('INTERDIT');
      const id = crypto.randomUUID();
      await db.transaction(async tx => {
        const dup = await tx.query(`select 1 from auth.users where lower(email) = lower($1)`, [inv.email]);
        if (dup.rows.length) throw new Error('EMAIL_DEJA_UTILISE');
        await tx.query(`insert into auth.users (id, email) values ($1, $2)`, [id, inv.email.trim()]);
        await tx.query(`insert into public.profils (id, auto_ecole_id, role, prenom, nom, telephone, langue) values ($1,$2,$3,$4,$5,$6,$7)`,
          [id, AE, inv.role, inv.prenom, inv.nom, inv.telephone ?? null, inv.langue ?? 'fr']);
        if (inv.role === 'eleve') await tx.query(`insert into public.eleves (id, auto_ecole_id, regime) values ($1,$2,$3)`, [id, AE, inv.regime ?? 'classique']);
      });
      return { id };
    },
    async payWero(factureId) {
      await rpcAs('service', 'encaisser_facture', { p_facture: factureId, p_moyen: 'wero', p_reference: 'demo-' + Date.now() });
      return 'paid';
    },
    async reset() {
      store.del(USER_KEY);
      await db.close();
      if (persistent) await new Promise(res => { try { const r = indexedDB.deleteDatabase(`/pglite/${DB_NAME}`); r.onsuccess = r.onerror = r.onblocked = () => res(null); } catch { res(null); } });
      location.reload();
    },
  };
}
