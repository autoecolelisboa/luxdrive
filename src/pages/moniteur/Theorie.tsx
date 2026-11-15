import { useState } from 'react';
import { backend } from '../../lib/backend';
import { dateLong, luxDate, luxDayStart, time, TZ } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { isBureau, useMe } from '../../lib/session';
import { Empty, Field, Loading, Sheet, useAction, useLoad } from '../../components/ui';

type Seance = { id: string; debut: string; fin: string; theme: string; pointee: boolean; moniteur_id: string; langue: string; places: number | null };

/** Local Luxembourg date + time ("2026-11-20", "18:00") → ISO instant */
export const luxInstant = (jour: string, hhmm: string) => {
  const guess = new Date(`${jour}T${hhmm}:00Z`);
  const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).format(guess);
  const m = s.match(/GMT([+-]\d+)(?::(\d+))?/);
  const off = m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] ?? 0) : 0;
  return new Date(guess.getTime() - off * 60000).toISOString();
};

export function Theorie() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const [open, setOpen] = useState<Seance | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const bureau = isBureau(me.profil.role);
  const canWrite = me.profil.role === 'gerant' || me.profil.role === 'secretariat';

  const { data, error, reload } = useLoad(async () => {
    const [seances, moniteurs, inscrits] = await Promise.all([
      b.select<Seance>('seances_theorie', {
        ...(bureau ? {} : { eq: { moniteur_id: me.profil.id } }),
        gte: { debut: luxDayStart(luxDate(new Date(), -30)) }, lt: { debut: luxDayStart(luxDate(new Date(), 60)) }, order: [['debut', 'asc']],
      }),
      b.select('profils', { eq: { role: 'moniteur', actif: true }, order: [['prenom', 'asc']] }),
      b.select('presences_theorie'),
    ]);
    const count = new Map<string, number>();
    for (const p of inscrits as any[]) count.set(p.seance_id, (count.get(p.seance_id) ?? 0) + 1);
    return { seances, moniteurs, count };
  }, [me.profil.id]);

  if (!data) return <Loading error={error} />;
  const monName = (id: string) => data.moniteurs.find((m: any) => m.id === id)?.prenom ?? '';
  const now = Date.now();
  const avenir = data.seances.filter(s => new Date(s.fin).getTime() >= now);
  const passees = data.seances.filter(s => new Date(s.fin).getTime() < now).reverse();

  const Liste = ({ items }: { items: Seance[] }) => items.length === 0 ? <Empty /> : (
    <div className="list">
      {items.map(s => (
        <button key={s.id} className="item" onClick={() => setOpen(s)}>
          <div className="grow">
            <strong>{dateLong(s.debut, lang)}</strong> · {time(s.debut, lang)}–{time(s.fin, lang)}
            <div className="muted small">{s.theme}{bureau ? ` · ${monName(s.moniteur_id)}` : ''} · {t('inscrits_n', { n: data.count.get(s.id) ?? 0 })}{s.places ? ` / ${s.places}` : ''}</div>
          </div>
          {s.pointee ? <span className="badge ok">{t('pointee')}</span> : new Date(s.debut).getTime() <= now ? <span className="badge warn">{t('pointer')}</span> : null}
        </button>
      ))}
    </div>
  );

  return (
    <div className="stack">
      <div className="row between"><h1 style={{ margin: 0 }}>{t('seances_theorie')}</h1>{canWrite && <button className="btn" onClick={() => setNouvelle(true)}>{t('nouvelle_seance')}</button>}</div>
      <div className="section-title">{t('a_venir')}</div>
      <Liste items={avenir} />
      <div className="section-title">{t('passees')}</div>
      <Liste items={passees} />

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.theme}>
        {open && <SeanceDetail s={open} canWrite={canWrite} onDone={() => { setOpen(null); reload(); }} onChange={reload} />}
      </Sheet>
      <Sheet open={nouvelle} onClose={() => setNouvelle(false)} title={t('nouvelle_seance')}>
        {nouvelle && <NouvelleSeance moniteurs={data.moniteurs} onDone={() => { setNouvelle(false); reload(); }} />}
      </Sheet>
    </div>
  );
}

function NouvelleSeance({ moniteurs, onDone }: { moniteurs: any[]; onDone: () => void }) {
  const { t } = useI18n();
  const me = useMe();
  const { run, busy } = useAction();
  const [f, setF] = useState({ jour: luxDate(new Date(), 1), heure: '18:00', duree: '90', theme: '', moniteur: moniteurs[0]?.id ?? '', langue: 'fr', places: '' });
  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }));
  return (
    <form className="stack" onSubmit={e => {
      e.preventDefault();
      run(async () => {
        const debut = luxInstant(f.jour, f.heure);
        const fin = new Date(new Date(debut).getTime() + Number(f.duree) * 60000).toISOString();
        await backend().insert('seances_theorie', [{ auto_ecole_id: me.ecole.id, moniteur_id: f.moniteur, debut, fin, theme: f.theme.trim(), langue: f.langue, places: f.places ? Number(f.places) : null }]);
        onDone();
      }, t('enregistre'));
    }}>
      <Field label={t('theme')}><input className="input" required value={f.theme} onChange={e => set('theme', e.target.value)} placeholder="Priorités, signalisation…" /></Field>
      <div className="grid2">
        <Field label={t('date')}><input className="input" type="date" required min={luxDate()} value={f.jour} onChange={e => set('jour', e.target.value)} /></Field>
        <Field label={t('heure')}><input className="input" type="time" required step={900} value={f.heure} onChange={e => set('heure', e.target.value)} /></Field>
        <Field label={t('duree_min')}><input className="input" type="number" min={15} step={15} required value={f.duree} onChange={e => set('duree', e.target.value)} /></Field>
        <Field label={t('places')}><input className="input" type="number" min={1} value={f.places} onChange={e => set('places', e.target.value)} /></Field>
        <Field label={t('moniteur')}>
          <select className="input" required value={f.moniteur} onChange={e => set('moniteur', e.target.value)}>
            {moniteurs.map((m: any) => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
          </select>
        </Field>
        <Field label={t('langue')}>
          <select className="input" value={f.langue} onChange={e => set('langue', e.target.value)}>
            <option value="fr">Français</option><option value="pt">Português</option><option value="en">English</option>
          </select>
        </Field>
      </div>
      {moniteurs.length === 0 && <div className="alert warn">{t('aucun_moniteur')}</div>}
      <button className="btn block" disabled={busy || !f.moniteur}>{t('creer')}</button>
    </form>
  );
}

function SeanceDetail({ s, canWrite, onDone, onChange }: { s: Seance; canWrite: boolean; onDone: () => void; onChange: () => void }) {
  const { t, lang } = useI18n();
  const b = backend();
  const { run, busy } = useAction();
  const [present, setPresent] = useState<Set<string> | null>(null);
  const [ajout, setAjout] = useState('');
  const { data, error, reload } = useLoad(async () => {
    const rows = await b.select('presences_theorie', { eq: { seance_id: s.id } });
    const ids = rows.map((r: any) => r.eleve_id);
    const [profils, eleves] = await Promise.all([
      ids.length ? b.select('profils', { in: { id: ids }, order: [['prenom', 'asc']] }) : Promise.resolve([]),
      canWrite ? b.select('v_eleves', { eq: { actif: true }, order: [['prenom', 'asc']] }) : Promise.resolve([]),
    ]);
    setPresent(new Set(rows.filter((r: any) => r.present).map((r: any) => r.eleve_id)));
    return { profils, eleves, ids: new Set<string>(ids) };
  }, [s.id]);
  if (!data || !present) return <Loading error={error} />;
  const commencee = new Date(s.debut).getTime() <= Date.now() + 15 * 60000;
  const toggle = (id: string) => setPresent(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const libres = data.eleves.filter((e: any) => !data.ids.has(e.id));
  const complet = !!s.places && data.ids.size >= s.places;
  const refresh = () => { reload(); onChange(); };

  return (
    <div className="stack">
      <div className="muted">{dateLong(s.debut, lang)} · {time(s.debut, lang)}–{time(s.fin, lang)}</div>
      <div className="section-title">{t('inscrits_n', { n: data.ids.size })}{s.places ? ` / ${s.places}` : ''}</div>
      {data.profils.length === 0 ? <Empty /> : data.profils.map((p: any) => (
        <div className="row" key={p.id}>
          {commencee
            ? <label className="check grow"><input type="checkbox" checked={present.has(p.id)} onChange={() => toggle(p.id)} />{p.prenom} {p.nom}</label>
            : <span className="grow">{p.prenom} {p.nom}</span>}
          {canWrite && !s.pointee && <button className="btn ghost sm" aria-label={t('retirer')} onClick={() => run(async () => { await b.remove('presences_theorie', { seance_id: s.id, eleve_id: p.id }); refresh(); })}>✕</button>}
        </div>
      ))}
      {canWrite && !s.pointee && (
        <div className="row">
          <select className="input grow" value={ajout} onChange={e => setAjout(e.target.value)} disabled={complet} aria-label={t('ajouter_eleve')} data-testid="ajouter-eleve">
            <option value="">{complet ? t('complet') : t('ajouter_eleve')}</option>
            {libres.map((e: any) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
          </select>
          <button className="btn sm" disabled={!ajout || busy} onClick={() => run(async () => { await b.insert('presences_theorie', [{ seance_id: s.id, eleve_id: ajout }]); setAjout(''); refresh(); })}>{t('ajouter')}</button>
        </div>
      )}
      {commencee && data.profils.length > 0 && (
        <button className="btn block" disabled={busy} onClick={() => run(async () => { await b.rpc('pointer_seance', { p_seance: s.id, p_presents: [...present] }); onDone(); }, t('pointee'))}>{t('enregistrer_presences')}</button>
      )}
      {canWrite && !commencee && data.ids.size === 0 && (
        <button className="btn ghost block" onClick={() => run(async () => { await b.remove('seances_theorie', { id: s.id }); onDone(); }, t('enregistre'))}>{t('supprimer_seance')}</button>
      )}
    </div>
  );
}
