import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import fs from 'node:fs';

const db = await PGlite.create({ extensions: { btree_gist } });
await db.exec(fs.readFileSync(new URL('../supabase/demo/stub.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

const U = {
  gerant: 'a0000000-0000-4000-8000-000000000001',
  secr:   'a0000000-0000-4000-8000-000000000002',
  marc:   'a0000000-0000-4000-8000-000000000003',
  sofia:  'a0000000-0000-4000-8000-000000000004',
  ana:    'a0000000-0000-4000-8000-000000000005',
  lucas:  'a0000000-0000-4000-8000-000000000006',
};
const AE = '00000000-0000-4000-8000-000000000001';
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, k + '@test.lu']);
await db.query(`select public.creer_gerant('gerant@test.lu', 'Gérant', 'Lisboa')`);
const prof = [[U.secr, 'secretariat', 'Sara'], [U.marc, 'moniteur', 'Marc'], [U.sofia, 'moniteur', 'Sofia'], [U.ana, 'eleve', 'Ana'], [U.lucas, 'eleve', 'Lucas']];
for (const [id, role, p] of prof) await db.query('insert into profils (id, auto_ecole_id, role, prenom, nom) values ($1,$2,$3,$4,$5)', [id, AE, role, p, 'Test']);
await db.query(`insert into eleves (id, auto_ecole_id, theorie_reussie_le, moniteur_referent_id) values ($1,$2,current_date - 10,$3), ($4,$2,current_date - 5,null)`, [U.ana, AE, U.marc, U.lucas]);

// Run as a given user (or anon / service_role)
async function as(who, sql, params = []) {
  const role = who === 'anon' ? 'anon' : who === 'service' ? 'service_role' : 'authenticated';
  const claims = who === 'anon' ? { role: 'anon' } : who === 'service' ? { role: 'service_role' } : { sub: U[who], role: 'authenticated' };
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false); set role ${role};`);
  try { return await db.query(sql, params); }
  finally { await db.exec('reset role'); }
}
async function err(who, sql, params = []) {
  try { await as(who, sql, params); return null; } catch (e) { return e.message; }
}
const one = async (who, sql, params) => (await as(who, sql, params)).rows[0];
const solde = async (who) => Number((await one(who, 'select solde_heures from soldes where eleve_id = auth.uid()')).solde_heures);

// Lux local date helpers
const luxDay = async (offsetDays) => (await db.query(`select ((now() at time zone 'Europe/Luxembourg')::date + $1::int)::text d, extract(isodow from (now() at time zone 'Europe/Luxembourg')::date + $1::int)::int dow`, [offsetDays])).rows[0];
async function nextWeekday(fromOffset) { for (let i = fromOffset; ; i++) { const d = await luxDay(i); if (d.dow <= 5) return d.d; } }

console.log('\n1. Achat et solde');
ok((await err('ana', `select public.reserver_lecon(now() + interval '5 days')`))?.includes('SOLDE_INSUFFISANT'), 'Réservation refusée sans heures');
const f1 = (await one('ana', `select public.creer_facture(auth.uid(), 'f4', 'wero') id`)).id;
const fac1 = await one('ana', 'select * from factures where id = $1', [f1]);
ok(fac1.statut === 'a_payer' && Number(fac1.total_ttc) === 352 && Number(fac1.total_ht) === 300.85 && Number(fac1.total_tva) === 51.15, `Forfait 4 : 352 € TTC = ${fac1.total_ht} HT + ${fac1.total_tva} TVA, n° ${fac1.numero}`);
ok((await one('ana', `select public.creer_facture(auth.uid(), 'f4', 'virement') id`)).id === f1, 'Pas de doublon : même facture réutilisée');
ok((await err('ana', `select public.encaisser_facture($1, 'wero')`, [f1]))?.includes('INTERDIT'), "L'élève ne peut pas se marquer payé");
await as('service', `select public.encaisser_facture($1, 'wero', 'pi_test')`, [f1]);
ok(await solde('ana') === 4, 'Paiement Wero confirmé : 4 h créditées');
await as('service', `select public.encaisser_facture($1, 'wero', 'pi_test')`, [f1]);
ok(await solde('ana') === 4, 'Confirmation reçue deux fois : pas de double crédit');
const f2 = (await one('ana', `select public.creer_facture(auth.uid(), 'f8', 'virement') id`)).id;
ok(await solde('ana') === 4, 'Virement annoncé : pas encore crédité');
await as('secr', `select public.encaisser_facture($1, 'virement', 'extrait 12/11')`, [f2]);
ok(await solde('ana') === 12, 'Virement reçu par le bureau : 8 h créditées (12 h)');

console.log('\n2. Réservation');
const d1 = await nextWeekday(4);
const slots = (await as('ana', `select * from public.creneaux_libres($1::date)`, [d1])).rows;
ok(slots.length === 10 && slots.every(s => s.moniteur_id === U.marc), `${slots.length} créneaux libres le ${d1}, moniteur référent proposé en premier`);
const l1 = (await one('ana', `select public.reserver_lecon($1) id`, [slots[0].debut])).id;
ok(await solde('ana') === 11, 'Leçon réservée : solde 11 h');
ok((await err('lucas', `select public.ajuster_solde(auth.uid(), 10, 'test')`))?.includes('INTERDIT'), "L'élève ne peut pas s'ajouter des heures");
ok((await err('secr', `select public.ajuster_solde($1, 2, '')`, [U.lucas]))?.includes('MOTIF_OBLIGATOIRE'), 'Ajustement sans motif refusé');
await as('secr', `select public.ajuster_solde($1, 2, 'Reprise ancien dossier')`, [U.lucas]);
ok((await err('lucas', `select public.reserver_lecon($1, $2)`, [slots[0].debut, U.marc]))?.includes('CRENEAU_INDISPONIBLE'), 'Lucas ne peut pas prendre Marc sur le même créneau');
const l2 = (await one('lucas', `select public.reserver_lecon($1) id`, [slots[0].debut])).id;
const l2m = (await one('secr', 'select moniteur_id from lecons where id = $1', [l2])).moniteur_id;
ok(l2m === U.sofia, 'Lucas obtient le même créneau avec Sofia');
ok((await err('ana', `select public.reserver_lecon($1)`, [slots[0].debut]))?.includes('CRENEAU_INDISPONIBLE'), 'Ana ne peut pas réserver deux leçons en même temps');
ok((await err('secr', `insert into lecons (auto_ecole_id, eleve_id, moniteur_id, debut, fin) values ($1,$2,$3,$4,$4::timestamptz + interval '1 hour')`, [AE, U.lucas, U.marc, slots[0].debut])) !== null, 'Insertion directe refusée (même pour le bureau)');
let exclErr = null; try { await db.query(`insert into lecons (auto_ecole_id, eleve_id, moniteur_id, debut, fin) values ($1,$2,$3,$4::timestamptz + interval '30 minutes',$4::timestamptz + interval '90 minutes')`, [AE, U.lucas, U.marc, slots[0].debut]); } catch (e) { exclErr = e.message; }
ok(exclErr?.includes('lecons_moniteur_sans_chevauchement'), 'La base elle-même bloque un chevauchement moniteur');

console.log('\n3. Maximum 4 leçons par semaine');
const wk = await one('postgres', `select (date_trunc('week', (now() at time zone 'Europe/Luxembourg')::date + 14))::date::text m`);
const days = (await db.query(`select (($1::date + g))::text d from generate_series(0,4) g`, [wk.m])).rows.map(r => r.d);
for (let k = 0; k < 4; k++) {
  const s = (await as('ana', `select * from public.creneaux_libres($1::date)`, [days[k]])).rows[0];
  await as('ana', `select public.reserver_lecon($1)`, [s.debut]);
}
const s5 = (await as('ana', `select * from public.creneaux_libres($1::date)`, [days[4]])).rows[0];
ok((await err('ana', `select public.reserver_lecon($1)`, [s5.debut]))?.includes('MAXIMUM_SEMAINE'), '5e leçon de la même semaine refusée');
ok((await one('secr', `select public.reserver_lecon($1, null, $2) id`, [s5.debut, U.ana])).id, 'Le bureau peut dépasser le maximum');
ok(await solde('ana') === 6, 'Solde après 6 réservations : 6 h');

console.log('\n4. Annulation (48 h)');
ok((await one('ana', `select public.annuler_lecon($1) r`, [l1])).r === 'libre', 'Annulation à plus de 48 h : gratuite');
ok(await solde('ana') === 7, 'Heure recréditée : 7 h');
ok((await err('lucas', `select public.annuler_lecon($1)`, [l1]))?.includes('INTERDIT'), "Lucas ne peut pas annuler la leçon d'Ana");
// a lesson within 48 h
let late = null;
for (let off = 0; off <= 2 && !late; off++) {
  const d = await luxDay(off);
  const r = (await as('ana', `select * from public.creneaux_libres($1::date) where debut < now() + interval '47 hours'`, [d.d])).rows;
  if (r.length) late = r[r.length - 1];
}
if (late) {
  const l3 = (await one('ana', `select public.reserver_lecon($1) id`, [late.debut])).id;
  ok((await one('ana', `select public.annuler_lecon($1) r`, [l3])).r === 'tardive', 'Annulation à moins de 48 h : heure due');
  ok(await solde('ana') === 6, 'Pas de remboursement : 6 h');
  ok((await err('ana', `select public.deposer_certificat($1, $2)`, [l3, U.lucas + '/certif.pdf']))?.includes('CHEMIN_INVALIDE'), 'Certificat dans le dossier d\'un autre élève refusé');
  ok((await err('ana', `insert into storage.objects (bucket_id, name) values ('certificats', $1)`, [U.lucas + '/x.pdf'])) !== null, "Fichier dans le dossier d'un autre élève refusé");
  await as('ana', `insert into storage.objects (bucket_id, name) values ('certificats', $1)`, [U.ana + '/certif.pdf']);
  await as('ana', `select public.deposer_certificat($1, $2)`, [l3, U.ana + '/certif.pdf']);
  ok((await as('lucas', `select * from storage.objects`)).rows.length === 0, "Lucas ne voit pas le certificat d'Ana");
  ok((await as('secr', `select * from storage.objects`)).rows.length === 1, 'Le bureau voit le certificat');
  ok((await err('secr', `select public.decider_certificat($1, false, '')`, [l3]))?.includes('MOTIF_OBLIGATOIRE'), 'Refus sans motif impossible');
  const path = (await one('secr', `select public.decider_certificat($1, true) p`, [l3])).p;
  ok(path === U.ana + '/certif.pdf', 'Certificat accepté, fichier à supprimer renvoyé');
  ok(await solde('ana') === 7, '1 h recréditée : 7 h');
  ok((await err('secr', `select public.decider_certificat($1, true)`, [l3]))?.includes('DEJA_TRAITE'), 'Pas de double décision');
} else console.log('  (pas de créneau dans les 48 h aujourd\'hui, test sauté)');

console.log('\n5. Moniteur : validation, absence, théorie');
const past = (await db.query(`insert into lecons (auto_ecole_id, eleve_id, moniteur_id, debut, fin) values ($1,$2,$3, now() - interval '70 minutes', now() - interval '10 minutes'), ($1,$2,$3, now() - interval '5 hours', now() - interval '4 hours') returning id`, [AE, U.ana, U.marc])).rows;
ok((await err('sofia', `select public.valider_lecon($1, 'x', null, '{}'::jsonb)`, [past[0].id]))?.includes('INTERDIT'), "Sofia ne peut pas valider la leçon de Marc");
ok((await err('marc', `select public.valider_lecon($1, 'x', null, null)`, [past[0].id]))?.includes('SIGNATURE_MANQUANTE'), 'Signature obligatoire');
await as('marc', `select public.valider_lecon($1, 'Bon créneau d''insertion', '{giratoire,autoroute}', '{"t":[[1,2,3,4]]}'::jsonb)`, [past[0].id]);
ok((await one('ana', 'select statut from lecons where id = $1', [past[0].id])).statut === 'effectuee', 'Leçon validée avec signature');
ok((await err('marc', `select public.valider_lecon($1, 'x', null, '{}'::jsonb)`, [slots[1].debut ? l2 : l2]))?.includes('INTERDIT'), "Marc ne peut pas valider la leçon de Sofia");
await as('marc', `select public.marquer_absence($1)`, [past[1].id]);
ok((await one('ana', 'select statut from lecons where id = $1', [past[1].id])).statut === 'absence', 'Absence enregistrée');
const sm = await one('marc', 'select * from soldes where eleve_id = $1', [U.ana]);
ok(sm && Number(sm.pratique_faites) === 1, 'Le moniteur voit la progression d\'Ana');
ok((await as('lucas', 'select * from soldes where eleve_id = $1', [U.ana])).rows.length === 0, "Lucas ne voit pas la progression d'Ana");
const se = (await one('secr', `insert into seances_theorie (auto_ecole_id, moniteur_id, debut, fin, theme) values ($1,$2, now() - interval '2 hours', now() - interval '1 hour', 'Priorités') returning id`, [AE, U.marc])).id;
await as('secr', `insert into presences_theorie (seance_id, eleve_id) values ($1,$2), ($1,$3)`, [se, U.ana, U.lucas]);
await as('marc', `select public.pointer_seance($1, $2::uuid[])`, [se, [U.ana]]);
ok(Number((await one('ana', 'select theorie_faites from soldes where eleve_id = auth.uid()')).theorie_faites) === 1, 'Théorie pointée : Ana présente');
ok(Number((await one('lucas', 'select theorie_faites from soldes where eleve_id = auth.uid()')).theorie_faites) === 0, 'Lucas absent');

console.log('\n6. Inscription et factures');
const fi = (await one('secr', `select public.creer_facture($1, 'inscription', 'especes') id`, [U.lucas])).id;
const fiv = await one('secr', 'select * from factures where id = $1', [fi]);
const lines = (await as('secr', 'select libelle, montant_ht, taux_tva, montant_tva, montant_ttc from lignes_facture where facture_id = $1 order by ordre', [fi])).rows;
ok(Number(fiv.total_ttc) === 295, `Inscription : ${fiv.total_ttc} € TTC (${lines.map(l => `${l.libelle} ${l.montant_ht} + ${l.montant_tva}`).join(' ; ')})`);
ok((await err('lucas', `select public.creer_facture(auth.uid(), 'inscription')`))?.includes('INTERDIT'), "L'élève ne crée pas lui-même la facture d'inscription");
await as('secr', `select public.encaisser_facture($1, 'especes')`, [fi]);
ok(Number((await one('lucas', 'select solde_heures from soldes where eleve_id = auth.uid()')).solde_heures) === 1, 'Inscription payée : aucune heure ajoutée');
const nums = (await as('secr', 'select numero from factures order by numero')).rows.map(r => r.numero);
ok(nums.length === 3 && nums.every((n, i) => n.endsWith('-000' + (i + 1))), 'Numéros continus : ' + nums.join(', '));
const f3 = (await one('ana', `select public.creer_facture(auth.uid(), 'unite', 'virement') id`)).id;
ok((await err('secr', `select public.annuler_facture($1, '')`, [f3]))?.includes('MOTIF_OBLIGATOIRE'), 'Annulation de facture : motif obligatoire');
await as('secr', `select public.annuler_facture($1, 'Erreur de formule')`, [f3]);
ok((await one('ana', 'select statut from factures where id = $1', [f3])).statut === 'annulee', 'Facture annulée (numéro conservé)');

console.log('\n7. Droits et confidentialité');
ok((await as('ana', 'select * from lecons')).rows.every(l => l.eleve_id === U.ana), 'Ana ne voit que ses leçons');
ok((await as('ana', 'select * from factures')).rows.every(f => f.eleve_id === U.ana), 'Ana ne voit que ses factures');
ok((await as('lucas', 'select * from eleves')).rows.length === 1, 'Un élève ne voit pas les autres élèves');
ok((await as('lucas', 'select * from profils')).rows.every(p => p.id === U.lucas || p.role === 'moniteur'), 'Un élève ne voit que lui-même et les moniteurs');
ok((await as('anon', 'select * from lecons')).rows.length === 0 && (await as('anon', 'select * from profils')).rows.length === 0, 'Sans connexion : rien de visible');
ok((await err('anon', `select public.reserver_lecon(now())`))?.includes('permission denied'), 'Sans connexion : aucune action');
ok((await err('ana', `update profils set role = 'gerant' where id = auth.uid()`))?.includes('permission denied'), "Ana ne peut pas se donner le rôle de gérant");
await as('ana', `update profils set telephone = '+352 621 000 000' where id = auth.uid()`);
ok((await one('ana', 'select telephone from profils where id = auth.uid()')).telephone === '+352 621 000 000', 'Ana peut modifier son téléphone');
ok((await err('ana', `select public.notifier(auth.uid(), 'x', 'spam')`))?.includes('permission denied'), 'Fonctions internes inaccessibles (notifications)');
ok((await err('ana', `select public.prochain_numero('${AE}')`))?.includes('permission denied'), 'Fonctions internes inaccessibles (numéros de facture)');
ok((await err('secr', `update formules set prix_ttc = 1 where code = 'unite'`)) === null && Number((await one('secr', `select prix_ttc from formules where code = 'unite'`)).prix_ttc) === 88, 'Le secrétariat ne peut pas changer les prix');
await as('gerant', `update formules set prix_ttc = 90 where code = 'unite'`);
ok(Number((await one('ana', `select prix_ttc from formules where code = 'unite'`)).prix_ttc) === 90, 'Le gérant peut changer les prix');
ok((await err('secr', `select public.definir_acces($1, 'gerant', true)`, [U.marc]))?.includes('INTERDIT'), 'Le secrétariat ne peut pas nommer un gérant');
await as('secr', `select public.definir_acces($1, null, false)`, [U.lucas]);
ok((await err('lucas', `select public.reserver_lecon(now() + interval '6 days')`))?.includes('ELEVE_INCONNU'), 'Compte désactivé : plus aucune action');
ok((await as('ana', 'select * from notifications')).rows.length > 0 && (await as('ana', 'select * from notifications')).rows.every(n => n.utilisateur_id === U.ana), 'Ana reçoit ses notifications, et seulement les siennes');
ok((await as('gerant', 'select * from journal')).rows.length >= 3 && (await as('secr', 'select * from journal')).rows.length === 0, 'Journal visible par le gérant seulement');

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
