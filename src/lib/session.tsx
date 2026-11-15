import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { backend, getBackend } from './backend';
import { useI18n, type Lang } from './i18n';

export type Role = 'gerant' | 'secretariat' | 'moniteur' | 'eleve' | 'lecture';
export type Profil = { id: string; role: Role; prenom: string; nom: string; telephone: string | null; langue: Lang; actif: boolean; auto_ecole_id: string };
export type AutoEcole = {
  id: string; nom: string; adresse: string | null; telephone: string | null; email: string | null; iban: string | null; beneficiaire: string | null;
  delai_annulation_h: number; max_lecons_semaine: number; delai_reservation_h: number; jours_ouverture: number[]; heures_lecons: number[];
  numero_tva: string | null; numero_agrement: string | null;
};

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'signedOut' }
  | { status: 'inactive'; email: string }
  | { status: 'ready'; email: string; profil: Profil; ecole: AutoEcole };

type Ctx = { state: State; reload: () => Promise<void>; demo: boolean };
const SessionCtx = createContext<Ctx>({ state: { status: 'loading' }, reload: async () => {}, demo: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [demo, setDemo] = useState(false);
  const { setLang } = useI18n();

  const reload = useCallback(async () => {
    const b = backend();
    const u = await b.currentUser();
    if (!u) { setState({ status: 'signedOut' }); return; }
    const [p] = await b.select<Profil>('profils', { eq: { id: u.id } });
    if (!p || !p.actif) { setState({ status: 'inactive', email: u.email }); return; }
    const [ecole] = await b.select<AutoEcole>('auto_ecoles', { eq: { id: p.auto_ecole_id } });
    if (p.langue) setLang(p.langue);
    setState({ status: 'ready', email: u.email, profil: p, ecole });
  }, [setLang]);

  useEffect(() => {
    let off = () => {};
    getBackend()
      .then(b => { setDemo(b.demo); off = b.onAuthChange(() => { reload(); }); return reload(); })
      .catch(e => setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => off();
  }, [reload]);

  return <SessionCtx.Provider value={{ state, reload, demo }}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);

/** For screens rendered only once signed in */
export function useMe() {
  const { state, reload } = useSession();
  if (state.status !== 'ready') throw new Error('not ready');
  return { ...state, reload };
}

export const isBureau = (r: Role) => r === 'gerant' || r === 'secretariat' || r === 'lecture';
