import { useState } from 'react';
import { backend } from '../../lib/backend';
import { dateLong, luxDate, luxDayStart, time } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { isBureau, useMe } from '../../lib/session';
import { Empty, Loading, Sheet, useAction, useLoad } from '../../components/ui';

type Seance = { id: string; debut: string; fin: string; theme: string; pointee: boolean; moniteur_id: string };

export function Theorie() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const [open, setOpen] = useState<Seance | null>(null);
  const bureau = isBureau(me.profil.role);

  const { data, error, reload } = useLoad(() => b.select<Seance>('seances_theorie', {
    ...(bureau ? {} : { eq: { moniteur_id: me.profil.id } }),
    gte: { debut: luxDayStart(luxDate(new Date(), -14)) }, lt: { debut: luxDayStart(luxDate(new Date(), 15)) }, order: [['debut', 'asc']],
  }), [me.profil.id]);

  if (!data) return <Loading error={error} />;
  return (
    <div className="stack">
      <h1>{t('seances_theorie')}</h1>
      {data.length === 0 ? <Empty /> : (
        <div className="list">
          {data.map(s => (
            <button key={s.id} className="item" onClick={() => setOpen(s)}>
              <div className="grow"><strong>{dateLong(s.debut, lang)}</strong> · {time(s.debut, lang)}<div className="muted small">{s.theme}</div></div>
              {s.pointee ? <span className="badge ok">{t('pointee')}</span> : <span className="badge">{t('pointer')}</span>}
            </button>
          ))}
        </div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.theme}>
        {open && <Pointage s={open} onDone={() => { setOpen(null); reload(); }} />}
      </Sheet>
    </div>
  );
}

function Pointage({ s, onDone }: { s: Seance; onDone: () => void }) {
  const { t } = useI18n();
  const b = backend();
  const { run, busy } = useAction();
  const [present, setPresent] = useState<Set<string> | null>(null);
  const { data, error } = useLoad(async () => {
    const rows = await b.select('presences_theorie', { eq: { seance_id: s.id } });
    const ids = rows.map((r: any) => r.eleve_id);
    const profils = ids.length ? await b.select('profils', { in: { id: ids }, order: [['prenom', 'asc']] }) : [];
    setPresent(new Set(rows.filter((r: any) => r.present).map((r: any) => r.eleve_id)));
    return profils;
  }, [s.id]);
  if (!data || !present) return <Loading error={error} />;
  const toggle = (id: string) => setPresent(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="stack">
      {data.length === 0 ? <Empty /> : data.map((p: any) => (
        <label className="check" key={p.id}><input type="checkbox" checked={present.has(p.id)} onChange={() => toggle(p.id)} />{p.prenom} {p.nom}</label>
      ))}
      <button className="btn block" disabled={busy} onClick={() => run(async () => { await b.rpc('pointer_seance', { p_seance: s.id, p_presents: [...present] }); onDone(); }, t('pointee'))}>{t('enregistrer')}</button>
    </div>
  );
}
