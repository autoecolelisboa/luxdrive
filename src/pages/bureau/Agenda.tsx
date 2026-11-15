import { useState } from 'react';
import { backend } from '../../lib/backend';
import { dateLong, hoursUntil, luxDate, luxDayStart, time } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { LeconTitre, StatutBadge, type Lecon } from '../../components/lecon';
import { Field, Icon, Loading, Sheet, useAction, useLoad } from '../../components/ui';

export function Agenda() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const { run, busy } = useAction();
  const [off, setOff] = useState(0);
  const [plan, setPlan] = useState(false);
  const [sel, setSel] = useState<Lecon | null>(null);
  const [recredit, setRecredit] = useState(false);
  const day = luxDate(new Date(), off);
  const canWrite = me.profil.role !== 'lecture';

  const { data, error, reload } = useLoad(async () => {
    const from = luxDayStart(day), to = luxDayStart(luxDate(new Date(day + 'T12:00:00Z'), 1));
    const [moniteurs, lecons] = await Promise.all([
      b.select('profils', { eq: { role: 'moniteur', actif: true }, order: [['prenom', 'asc']] }),
      b.select<Lecon>('v_lecons', { gte: { debut: from }, lt: { debut: to }, order: [['debut', 'asc']] }),
    ]);
    return { moniteurs, lecons };
  }, [day]);

  const cancel = () => run(async () => {
    const r = await b.rpc<string>('annuler_lecon', { p_lecon: sel!.id, p_recrediter: recredit });
    setSel(null); setRecredit(false); reload();
    return r;
  }, t('enregistre'));

  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="row">
          <button className="btn ghost sm" onClick={() => setOff(o => o - 1)} aria-label="précédent"><Icon name="left" /></button>
          <h1 style={{ margin: 0 }}>{dateLong(day + 'T12:00:00Z', lang)}</h1>
          <button className="btn ghost sm" onClick={() => setOff(o => o + 1)} aria-label="suivant"><Icon name="chevron" /></button>
          {off !== 0 && <button className="btn ghost sm" onClick={() => setOff(0)}>{t('aujourd_hui')}</button>}
        </div>
        {canWrite && <button className="btn" onClick={() => setPlan(true)}>{t('planifier')}</button>}
      </div>
      {!data ? <Loading error={error} /> : (
        <div className="agenda">
          {data.moniteurs.map((m: any) => {
            const ls = data.lecons.filter(l => l.moniteur_id === m.id);
            return (
              <div className="list" key={m.id}>
                <div className="item"><strong>{m.prenom} {m.nom}</strong></div>
                {ls.length === 0 ? <div className="slotline muted">—</div> : ls.map(l => (
                  <button key={l.id} className="slotline" style={{ width: '100%', background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer' }} onClick={() => setSel(l)}>
                    <span className="h">{time(l.debut, lang)}</span>
                    <span className="grow">{l.eleve_prenom} {l.eleve_nom}</span>
                    <StatutBadge l={l} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.eleve_prenom} ${sel.eleve_nom}` : ''}>
        {sel && (
          <div className="stack">
            <div><LeconTitre l={sel} /></div>
            <div className="row"><span className="muted">{t('avec', { nom: sel.moniteur_prenom })}</span><StatutBadge l={sel} /></div>
            {sel.statut === 'reservee' && new Date(sel.debut) > new Date() && canWrite && <>
              {hoursUntil(sel.debut) < me.ecole.delai_annulation_h && (
                <label className="check"><input type="checkbox" checked={recredit} onChange={e => setRecredit(e.target.checked)} />{t('rendre_heure')}</label>
              )}
              <button className="btn danger block" disabled={busy} onClick={cancel}>{t('annuler_lecon')}</button>
            </>}
            <button className="btn ghost block" onClick={() => setSel(null)}>{t('fermer')}</button>
          </div>
        )}
      </Sheet>

      <Sheet open={plan} onClose={() => setPlan(false)} title={t('planifier')}>
        {plan && <Planifier jourInit={day} onDone={() => { setPlan(false); reload(); }} />}
      </Sheet>
    </div>
  );
}

export function Planifier({ jourInit, eleveInit, onDone }: { jourInit: string; eleveInit?: string; onDone: () => void }) {
  const { t, lang } = useI18n();
  const b = backend();
  const { run, busy } = useAction();
  const [eleve, setEleve] = useState(eleveInit ?? '');
  const [jour, setJour] = useState(jourInit < luxDate() ? luxDate() : jourInit);
  const [moniteur, setMoniteur] = useState('');
  const base = useLoad(async () => {
    const [eleves, moniteurs] = await Promise.all([
      b.select('v_eleves', { eq: { actif: true }, order: [['prenom', 'asc']] }),
      b.select('profils', { eq: { role: 'moniteur', actif: true }, order: [['prenom', 'asc']] }),
    ]);
    return { eleves, moniteurs };
  }, []);
  const slots = useLoad(async () => {
    if (!eleve) return [];
    return b.rpc<{ debut: string; moniteur_id: string }[]>('creneaux_libres', { p_jour: jour, p_moniteur: moniteur || null, p_eleve: eleve });
  }, [eleve, jour, moniteur]);
  if (!base.data) return <Loading error={base.error} />;
  const monName = (id: string) => base.data!.moniteurs.find((m: any) => m.id === id)?.prenom ?? '';
  const sel = base.data.eleves.find((e: any) => e.id === eleve);
  return (
    <div className="stack">
      <Field label={t('eleve')}>
        <select className="input" value={eleve} onChange={e => setEleve(e.target.value)} data-testid="planifier-eleve">
          <option value="">{t('choisir_eleve')}</option>
          {base.data.eleves.map((e: any) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} · {t('heures_n', { n: Number(e.solde_heures) })}</option>)}
        </select>
      </Field>
      <div className="grid2">
        <Field label={t('date')}><input className="input" type="date" value={jour} min={luxDate()} onChange={e => setJour(e.target.value)} /></Field>
        <Field label={t('moniteur')}>
          <select className="input" value={moniteur} onChange={e => setMoniteur(e.target.value)}>
            <option value="">{t('peu_importe')}</option>
            {base.data.moniteurs.map((m: any) => <option key={m.id} value={m.id}>{m.prenom}</option>)}
          </select>
        </Field>
      </div>
      {sel && Number(sel.solde_heures) < 1 && <div className="alert bad">{t('err_SOLDE_INSUFFISANT')}</div>}
      {eleve && (!slots.data ? <Loading error={slots.error} /> : slots.data.length === 0 ? <div className="muted">{t('aucun_creneau')}</div> : (
        <div className="slots">
          {slots.data.map(s => (
            <button key={s.debut} className="slot" disabled={busy} onClick={() => run(async () => { await b.rpc('reserver_lecon', { p_debut: s.debut, p_moniteur: s.moniteur_id, p_eleve: eleve }); onDone(); }, t('lecon_reservee'))}>
              {time(s.debut, lang)}<div className="muted small" style={{ fontWeight: 400 }}>{monName(s.moniteur_id)}</div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
