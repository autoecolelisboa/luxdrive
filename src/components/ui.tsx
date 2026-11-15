import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { errorText, useI18n } from '../lib/i18n';

/* ---------- Toast ---------- */
type ToastCtx = (msg: string, bad?: boolean) => void;
const ToastC = createContext<ToastCtx>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; bad: boolean } | null>(null);
  const timer = useRef<number>();
  const show = useCallback<ToastCtx>((msg, bad = false) => {
    setT({ msg, bad }); window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), 3500);
  }, []);
  return <ToastC.Provider value={show}>{children}{t && <div className={'toast' + (t.bad ? ' bad' : '')} role="status">{t.msg}</div>}</ToastC.Provider>;
}
export const useToast = () => useContext(ToastC);

/** Run an action, show the translated error if it fails */
export function useAction() {
  const toast = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <R,>(fn: () => Promise<R>, okMsg?: string): Promise<R | undefined> => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { console.error(e); toast(errorText(t, e), true); return undefined; }
    finally { setBusy(false); }
  }, [toast, t]);
  return { run, busy };
}

/** Load data, with a reload function */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then(d => { if (alive) { setData(d); setError(null); } }).catch(e => { console.error(e); if (alive) setError(e); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, reload: () => setN(x => x + 1) };
}

export function Loading({ error }: { error?: unknown }) {
  const { t } = useI18n();
  if (error) return <div className="alert bad">{errorText(t, error)}</div>;
  return <p className="muted">{t('chargement')}</p>;
}

/* ---------- Sheet (modal) ---------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, group }: { label: string; children: ReactNode; group?: boolean }) {
  if (group) return <div className="field" role="group" aria-label={label}><span>{label}</span>{children}</div>;
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function Empty({ text }: { text?: string }) {
  const { t } = useI18n();
  return <div className="card center muted">{text ?? t('aucun')}</div>;
}

/* ---------- Icons (simple strokes) ---------- */
const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  card: 'M2 7h20v12H2zM2 11h20',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  book: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM18 20h2V6',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM1 21a8 8 0 0 1 16 0M17 3a4 4 0 0 1 0 8M19 14a6 6 0 0 1 4 7',
  file: 'M6 2h9l5 5v15H6zM14 2v6h6',
  check: 'M20 6L9 17l-5-5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  pin: 'M12 21s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  chevron: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
};
export function Icon({ name, size = 22 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  );
}
