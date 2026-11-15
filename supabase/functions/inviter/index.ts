// Supabase Edge Function: the office creates a student (or the manager a staff member).
// Runs on Supabase's servers with the service key, which never reaches the browser.
//
// Two modes (secret INVITE_MODE):
//  - "password" (default): the account is created with a temporary password shown once to the office,
//    who gives it to the student. Works without any e-mail service.
//  - "email": Supabase sends an invitation e-mail (needs SMTP, e.g. Resend, configured in Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function tempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHODE' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Who is calling?
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller?.user) return json({ error: 'NON_CONNECTE' }, 401);
  const { data: me } = await admin.from('profils').select('role, auto_ecole_id, actif').eq('id', caller.user.id).single();
  if (!me?.actif || !['gerant', 'secretariat'].includes(me.role)) return json({ error: 'INTERDIT' }, 403);

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? '').trim().toLowerCase();
  const prenom = String(b.prenom ?? '').trim();
  const nom = String(b.nom ?? '').trim();
  const role = String(b.role ?? 'eleve');
  const langue = ['fr', 'en', 'pt'].includes(b.langue) ? b.langue : 'fr';
  const regime = b.regime === 'accompagnee' ? 'accompagnee' : 'classique';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !prenom || !nom) return json({ error: 'CHAMPS_INVALIDES' }, 400);
  if (!['eleve', 'moniteur', 'secretariat', 'lecture'].includes(role)) return json({ error: 'ROLE_INVALIDE' }, 400);
  if (role !== 'eleve' && me.role !== 'gerant') return json({ error: 'INTERDIT' }, 403);

  const mode = Deno.env.get('INVITE_MODE') ?? 'password';
  let id: string; let motDePasse: string | undefined;
  if (mode === 'email') {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: Deno.env.get('SITE_URL') ?? undefined });
    if (error) return json({ error: /already/i.test(error.message) ? 'EMAIL_DEJA_UTILISE' : error.message }, 400);
    id = data.user.id;
  } else {
    motDePasse = tempPassword();
    const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
    if (error) return json({ error: /already/i.test(error.message) ? 'EMAIL_DEJA_UTILISE' : error.message }, 400);
    id = data.user.id;
  }

  const { error: e1 } = await admin.from('profils').insert({
    id, auto_ecole_id: me.auto_ecole_id, role, prenom, nom, telephone: b.telephone || null, langue,
  });
  if (!e1 && role === 'eleve') {
    const { error: e2 } = await admin.from('eleves').insert({ id, auto_ecole_id: me.auto_ecole_id, regime });
    if (e2) { await admin.auth.admin.deleteUser(id); return json({ error: e2.message }, 500); }
  }
  if (e1) { await admin.auth.admin.deleteUser(id); return json({ error: e1.message }, 500); }

  await admin.from('journal').insert({ auto_ecole_id: me.auto_ecole_id, utilisateur_id: caller.user.id, action: 'compte_cree', element: id, details: { role } });
  return json({ id, motDePasse });
});
