import { createClient } from '@supabase/supabase-js';
import type { Backend, Filter } from './backend';

class DbError extends Error {}
const fail = (e: { message: string } | null) => { if (e) throw new DbError(e.message); };

export function createSupabaseBackend(): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!url || !key) throw new Error('CONFIG_MANQUANTE');
  const fromLink = new URLSearchParams(location.search).has('code');
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce', detectSessionInUrl: true } });

  return {
    demo: false,
    passwordSetupPending: fromLink,
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new DbError('IDENTIFIANTS_INVALIDES');
    },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      fail(error);
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      fail(error);
      this.passwordSetupPending = false;
      history.replaceState(null, '', location.pathname + location.hash);
    },
    async currentUser() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? '' } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },
    async rpc(fn, args = {}) {
      const { data, error } = await sb.rpc(fn, args);
      fail(error);
      return data as any;
    },
    async select(table, f: Filter = {}) {
      let q: any = sb.from(table).select('*');
      for (const [k, v] of Object.entries(f.eq ?? {})) q = q.eq(k, v);
      for (const [k, v] of Object.entries(f.neq ?? {})) q = q.neq(k, v);
      for (const [k, v] of Object.entries(f.gte ?? {})) q = q.gte(k, v);
      for (const [k, v] of Object.entries(f.lt ?? {})) q = q.lt(k, v);
      for (const [k, v] of Object.entries(f.in ?? {})) q = q.in(k, v);
      for (const k of f.isNull ?? []) q = q.is(k, null);
      for (const k of f.notNull ?? []) q = q.not(k, 'is', null);
      for (const [k, dir] of f.order ?? []) q = q.order(k, { ascending: dir === 'asc' });
      if (f.limit) q = q.limit(f.limit);
      const { data, error } = await q;
      fail(error);
      return data ?? [];
    },
    async update(table, values, eq) {
      let q: any = sb.from(table).update(values);
      for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
      const { error } = await q; fail(error);
    },
    async insert(table, rows) { const { error } = await sb.from(table).insert(rows); fail(error); },
    async remove(table, eq) {
      let q: any = sb.from(table).delete();
      for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
      const { error } = await q; fail(error);
    },
    async upload(bucket, path, file) {
      const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
      fail(error);
    },
    async fileUrl(bucket, path) {
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 300);
      fail(error);
      return data!.signedUrl;
    },
    async removeFile(bucket, path) { const { error } = await sb.storage.from(bucket).remove([path]); fail(error); },
    async invite(inv) {
      const { data, error } = await sb.functions.invoke('inviter', { body: inv });
      if (error) throw new DbError((data as any)?.error ?? error.message);
      return data as { id: string; motDePasse?: string };
    },
    async payWero(factureId) {
      const { data, error } = await sb.functions.invoke('wero-checkout', { body: { facture_id: factureId } });
      if (error || !(data as any)?.url) return 'unavailable';
      location.href = (data as any).url;
      return 'redirect';
    },
  };
}
