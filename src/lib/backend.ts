// One interface, two implementations: the real Supabase project, or the demo
// (the same database running inside the browser).

export type Filter = {
  eq?: Record<string, unknown>;
  neq?: Record<string, unknown>;
  gte?: Record<string, unknown>;
  lt?: Record<string, unknown>;
  in?: Record<string, unknown[]>;
  isNull?: string[];
  notNull?: string[];
  order?: [string, 'asc' | 'desc'][];
  limit?: number;
};

export type Invitation = {
  email: string;
  prenom: string;
  nom: string;
  role: 'eleve' | 'moniteur' | 'secretariat' | 'lecture';
  telephone?: string;
  langue?: string;
  regime?: 'classique' | 'accompagnee';
};

export interface Backend {
  demo: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /** true when the user arrived from an invitation or reset link and must choose a password */
  passwordSetupPending: boolean;
  currentUser(): Promise<{ id: string; email: string } | null>;
  onAuthChange(cb: () => void): () => void;
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;
  select<T = Record<string, any>>(table: string, f?: Filter): Promise<T[]>;
  update(table: string, values: Record<string, unknown>, eq: Record<string, unknown>): Promise<void>;
  insert(table: string, rows: Record<string, unknown>[]): Promise<void>;
  remove(table: string, eq: Record<string, unknown>): Promise<void>;
  upload(bucket: string, path: string, file: File): Promise<void>;
  fileUrl(bucket: string, path: string): Promise<string>;
  removeFile(bucket: string, path: string): Promise<void>;
  /** Creates the account. motDePasse = temporary password to give to the person (when no e-mail is sent) */
  invite(inv: Invitation): Promise<{ id: string; motDePasse?: string }>;
  payWero(factureId: string): Promise<'redirect' | 'paid' | 'unavailable'>;
  reset?(): Promise<void>;
  demoAccounts?: { email: string; label: string }[];
}

let instance: Backend | null = null;

export async function getBackend(): Promise<Backend> {
  if (instance) return instance;
  if (import.meta.env.MODE === 'demo') {
    const m = await import('./demoBackend');
    instance = await m.createDemoBackend();
  } else {
    const m = await import('./supabaseBackend');
    instance = m.createSupabaseBackend();
  }
  return instance;
}

export function backend(): Backend {
  if (!instance) throw new Error('Backend not ready');
  return instance;
}
