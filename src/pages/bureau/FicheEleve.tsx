import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { backend } from '../../lib/backend';
import { dateShort, euro, luxDate, time } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { LeconTitre, StatutBadge, type Lecon } from '../../components/lecon';
import { FactureBadge, type Facture } from '../../components/facture';
import { Empty, Field, Loading, Sheet, useAction, useLoad } from '../../components/ui';
import { Planifier } from './Agenda';
import { luxInstant } from '../moniteur/Theorie';
import { FactureSheet } from './Factures';

export function FicheEleve() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const nav = useNavigate();
  const { run, busy } = useAction();
  const [sheet, setSheet] = useState<'ajuster' | 'vendre' | 'planifier' | 'examen' | null>(null);
  const [exam, setExam] = useState({ type: 'theorique', jour: luxDate(new Date(), 7), heure: '09:00' });
  const [facture, setFacture] = useState<Facture | null>(null);
  const [heures, setHeures] = useState('1');
  const [motif, setMotif] = useState('');
  const [code, setCode] = useState('f4');
  const [moyen, setMoyen] = useState<'virement' | 'especes'>('especes');
  const canWrite = me.profil.role !== 'lecture';

  const { data, error, reload } = useLoad(async () => {
    const [[e], lecons, factures, mouvements, moniteurs, formules, [acc], examens] = await Promise.all([
      b.select('v_eleves', { eq: { id } }),
      b.select<Lecon>('v_lecons', { eq: { eleve_id: id }, order: [['debut', 'desc']], limit: 100 }),
      b.select<Facture>('v_factures', { eq: { eleve_id: id }, order: [['created_at', 'desc']] }),
      b.select('mouvements_heures', { eq: { eleve_id: id }, order: [['created_at', 'desc']], limit: 50 }),
      b.select('profils', { eq: { role: 'moniteur', actif: true }, order: [['prenom', 'asc']] }),
      b.select('formules', { eq: { active: true }, order: [['ordre', 'asc']] }),
      b.select('accompagnateurs', { eq: { eleve_id: id } }),
      b.select('examens', { eq: { eleve_id: id }, order: [['date', 'desc']] }),
    ]);
    if (!e) throw new Error('ELEVE_INCONNU');
    return { e, lecons, factures, mouvements, moniteurs, formules, acc, examens };
  }, [id]);
  const [edit, setEdit] = useState<Record<string, any> | null>(null);

  if (!data) return <Loading error={error} />;
  const e = data.e;
  const form = edit ?? { theorie_reussie_le: e.theorie_reussie_le ?? '', regime: e.regime, certificat_numero: e.certificat_numero ?? '', certificat_validite: e.certificat_validite ?? '', moniteur_referent_id: e.moniteur_referent_id ?? '' };
  const setForm = (k: string, v: string) => setEdit({ ...form, [k]: v });
  const saveForm = () => run(async () => {
    await b.update('eleves', {
      theorie_reussie_le: form.theorie_reussie_le || null, regime: form.regime, certificat_numero: form.certificat_numero || null,
      certificat_validite: form.certificat_validite || null, moniteur_referent_id: form.moniteur_referent_id || null,
    }, { id });
    setEdit(null); reload();
  }, t('enregistre'));

  const resultat = (x: any, r: 'reussi' | 'echoue') => run(async () => {
    await b.update('examens', { resultat: r }, { id: x.id });
    // Théorie réussie : l'élève peut ensuite réserver ses leçons de conduite
    if (x.type === 'theorique' && r === 'reussi' && !e.theorie_reussie_le) await b.update('eleves', { theorie_reussie_le: luxDate(new Date(Math.min(Date.now(), new Date(x.date).getTime()))) }, { id });
    reload();
  }, t('enregistre'));

  const sell = (c: string, m: 'virement' | 'especes') => run(async () => {
    const fid = await b.rpc<string>('creer_facture', { p_eleve: id, p_code: c, p_moyen: m });
    setSheet(null); reload();
    const [f] = await b.select<Facture>('v_factures', { eq: { id: fid } });
    setFacture(f);
  });

  return (
    <div className="stack">
      <button className="btn ghost sm" onClick={() => nav('/eleves')}>‹ {t('retour')}</button>
      <div className="card dark row between wrap">
        <div>
          <h1 style={{ marginBottom: 2 }}>{e.prenom} {e.nom}</h1>
          <div className="muted small">{e.telephone ?? ''} · {e.regime === 'accompagnee' ? t('regime_accompagnee') : t('regime_classique')}</div>
          <div className="muted small">{t('theorie_faites', { n: e.theorie_faites })} · {t('pratique_faites', { n: e.pratique_faites })}</div>
        </div>
        <div className="center"><div className="muted small">{t('solde')}</div><div className="big-number" data-testid="fiche-solde">{t('heures_n', { n: Number(e.solde_heures) })}</div></div>
      </div>

      {canWrite && (
        <div className="row wrap">
          <button className="btn" onClick={() => setSheet('planifier')}>{t('planifier')}</button>
          <button className="btn secondary" onClick={() => setSheet('vendre')}>{t('vendre_formule')}</button>
          <button className="btn secondary" disabled={busy} onClick={() => sell('inscription', 'especes')}>{t('facture_inscription')}</button>
          <button className="btn secondary" onClick={() => setSheet('ajuster')}>{t('ajuster_solde')}</button>
        </div>
      )}

      <div className="card stack">
        <div className="grid2">
          <Field label={t('theorie_reussie')}><input className="input" type="date" disabled={!canWrite} max={luxDate()} value={form.theorie_reussie_le} onChange={ev => setForm('theorie_reussie_le', ev.target.value)} /></Field>
          <Field label={t('regime')}>
            <select className="input" disabled={!canWrite} value={form.regime} onChange={ev => setForm('regime', ev.target.value)}>
              <option value="classique">{t('regime_classique')}</option><option value="accompagnee">{t('regime_accompagnee')}</option>
            </select>
          </Field>
          <Field label={t('certificat_apprentissage')}><input className="input" disabled={!canWrite} value={form.certificat_numero} onChange={ev => setForm('certificat_numero', ev.target.value)} /></Field>
          <Field label={t('validite')}><input className="input" type="date" disabled={!canWrite} value={form.certificat_validite} onChange={ev => setForm('certificat_validite', ev.target.value)} /></Field>
          <Field label={t('moniteur_referent')}>
            <select className="input" disabled={!canWrite} value={form.moniteur_referent_id} onChange={ev => setForm('moniteur_referent_id', ev.target.value)}>
              <option value="">—</option>{data.moniteurs.map((m: any) => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
            </select>
          </Field>
          {data.acc && <div><div className="muted small">{t('accompagnateur')}</div>{data.acc.prenom} {data.acc.nom} · {data.acc.telephone}</div>}
        </div>
        {edit && <button className="btn" disabled={busy} onClick={saveForm}>{t('enregistrer')}</button>}
      </div>

      <div className="section-title">{t('lecons')}</div>
      {data.lecons.length === 0 ? <Empty /> : (
        <div className="list">
          {data.lecons.map(l => (
            <div className="item small" key={l.id}>
              <div className="grow"><LeconTitre l={l} /><div className="muted">{t('avec', { nom: l.moniteur_prenom })}{l.commentaire ? ` · ${l.commentaire}` : ''}</div></div>
              <StatutBadge l={l} />
            </div>
          ))}
        </div>
      )}

      <div className="row between">
        <div className="section-title">{t('examens')}</div>
        {canWrite && <button className="btn ghost sm" onClick={() => setSheet('examen')}>+ {t('nouvel_examen')}</button>}
      </div>
      {data.examens.length === 0 ? <Empty /> : (
        <div className="list">
          {data.examens.map((x: any) => (
            <div className="item" key={x.id}>
              <div className="grow">
                <strong>{t('examen_' + x.type)}</strong>
                <div className="muted small">{dateShort(x.date, lang)} · {time(x.date, lang)}</div>
              </div>
              {x.resultat === 'a_venir' && canWrite ? (
                <div className="row">
                  <button className="btn sm" disabled={busy} onClick={() => resultat(x, 'reussi')}>{t('res_reussi')}</button>
                  <button className="btn secondary sm" disabled={busy} onClick={() => resultat(x, 'echoue')}>{t('res_echoue')}</button>
                </div>
              ) : <span className={'badge ' + (x.resultat === 'reussi' ? 'ok' : x.resultat === 'echoue' ? 'bad' : '')}>{t('res_' + x.resultat)}</span>}
            </div>
          ))}
        </div>
      )}
      {data.examens.some((x: any) => x.type === 'pratique' && x.resultat === 'echoue') && <div className="alert warn small">{t('echec_info')}</div>}

      <div className="section-title">{t('nav_factures')}</div>
      {data.factures.length === 0 ? <Empty /> : (
        <div className="list">
          {data.factures.map(f => (
            <button className="item" key={f.id} onClick={() => setFacture(f)}>
              <div className="grow"><strong>{f.objet}</strong><div className="muted small">{f.numero} · {dateShort(f.date_emission, lang)}</div></div>
              <span className="mono">{euro(f.total_ttc, lang)}</span><FactureBadge f={f} />
            </button>
          ))}
        </div>
      )}

      <div className="section-title">{t('historique')} ({t('solde').toLowerCase()})</div>
      <div className="list">
        {data.mouvements.map((m: any) => (
          <div className="item small" key={m.id}>
            <div style={{ width: 90 }} className="muted">{dateShort(m.created_at, lang)}</div>
            <div className="grow">{t('mvt_' + m.type)}{m.motif ? ` · ${m.motif}` : ''}</div>
            <strong className="mono">{Number(m.heures) > 0 ? '+' : ''}{Number(m.heures)} h</strong>
          </div>
        ))}
      </div>

      <Sheet open={sheet === 'ajuster'} onClose={() => setSheet(null)} title={t('ajuster_solde')}>
        <div className="stack">
          <Field label={t('heures_ajout')}><input className="input" type="number" step="1" value={heures} onChange={ev => setHeures(ev.target.value)} /></Field>
          <Field label={t('motif')}><input className="input" value={motif} onChange={ev => setMotif(ev.target.value)} /></Field>
          <button className="btn block" disabled={busy || !Number(heures)} onClick={() => run(async () => { await b.rpc('ajuster_solde', { p_eleve: id, p_heures: Number(heures), p_motif: motif }); setSheet(null); setMotif(''); reload(); }, t('enregistre'))}>{t('enregistrer')}</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'vendre'} onClose={() => setSheet(null)} title={t('vendre_formule')}>
        <div className="stack">
          <div className="list">
            {data.formules.map((f: any) => (
              <label className="item check" key={f.code}><input type="radio" name="formule" checked={code === f.code} onChange={() => setCode(f.code)} />
                <span className="grow">{f.heures === 1 ? t('lecon_unite') : t('forfait_n', { n: f.heures })}</span><strong className="mono">{euro(f.prix_ttc, lang)}</strong></label>
            ))}
          </div>
          <Field group label={t('moyen')}>
            <div className="chips">
              <button className={'chip' + (moyen === 'especes' ? ' on' : '')} onClick={() => setMoyen('especes')}>{t('especes')}</button>
              <button className={'chip' + (moyen === 'virement' ? ' on' : '')} onClick={() => setMoyen('virement')}>{t('virement')}</button>
            </div>
          </Field>
          <p className="small muted">{t('vente_info')}</p>
          <button className="btn block" disabled={busy} onClick={() => sell(code, moyen)}>{t('creer')}</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'examen'} onClose={() => setSheet(null)} title={t('nouvel_examen')}>
        <div className="stack">
          <Field label={t('type')}>
            <select className="input" value={exam.type} onChange={ev => setExam({ ...exam, type: ev.target.value })}>
              <option value="theorique">{t('examen_theorique')}</option><option value="pratique">{t('examen_pratique')}</option>
            </select>
          </Field>
          <div className="grid2">
            <Field label={t('date')}><input className="input" type="date" value={exam.jour} onChange={ev => setExam({ ...exam, jour: ev.target.value })} /></Field>
            <Field label={t('heure')}><input className="input" type="time" step={900} value={exam.heure} onChange={ev => setExam({ ...exam, heure: ev.target.value })} /></Field>
          </div>
          {exam.type === 'theorique' && <p className="small muted">{t('snca_info')}</p>}
          <button className="btn block" disabled={busy || !exam.jour} onClick={() => run(async () => {
            await b.insert('examens', [{ auto_ecole_id: me.ecole.id, eleve_id: id, type: exam.type, date: luxInstant(exam.jour, exam.heure) }]);
            setSheet(null); reload();
          }, t('enregistre'))}>{t('creer')}</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'planifier'} onClose={() => setSheet(null)} title={t('planifier')}>
        {sheet === 'planifier' && <Planifier jourInit={luxDate(new Date(), 1)} eleveInit={id} onDone={() => { setSheet(null); reload(); }} />}
      </Sheet>

      <FactureSheet f={facture} onClose={() => setFacture(null)} onChange={() => { setFacture(null); reload(); }} />
    </div>
  );
}
