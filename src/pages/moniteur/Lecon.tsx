import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { backend } from '../../lib/backend';
import { dateShort } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { LeconTitre, POINTS, StatutBadge, type Lecon } from '../../components/lecon';
import { SignaturePad, SignatureView, type SignatureData } from '../../components/Signature';
import { Field, Loading, Sheet, useAction, useLoad } from '../../components/ui';

export function LeconMoniteur() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const b = backend();
  const nav = useNavigate();
  const { run, busy } = useAction();
  const [points, setPoints] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [sig, setSig] = useState<SignatureData | null>(null);
  const [absent, setAbsent] = useState(false);

  const { data, error, reload } = useLoad(async () => {
    const [l] = await b.select<Lecon & { signature: SignatureData | null }>('v_lecons', { eq: { id } });
    if (!l) throw new Error('LECON_INCONNUE');
    const [s] = await b.select('soldes', { eq: { eleve_id: l.eleve_id } });
    const [e] = await b.select('v_eleves', { eq: { id: l.eleve_id } });
    const avant = await b.select<Lecon>('v_lecons', { eq: { eleve_id: l.eleve_id, statut: 'effectuee' }, lt: { debut: l.debut }, order: [['debut', 'desc']], limit: 3 });
    return { l, s, e, avant };
  }, [id]);

  if (!data) return <Loading error={error} />;
  const { l } = data;
  const toggle = (p: string) => setPoints(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]);

  const valider = () => run(async () => {
    await b.rpc('valider_lecon', { p_lecon: l.id, p_commentaire: comment, p_points: points, p_signature: sig });
    reload();
  }, t('lecon_validee'));
  const marquerAbsent = () => run(async () => { await b.rpc('marquer_absence', { p_lecon: l.id }); setAbsent(false); reload(); }, t('enregistre'));

  return (
    <div className="stack">
      <button className="btn ghost sm" onClick={() => nav('/')}>‹ {t('retour')}</button>
      <div className="card dark">
        <h1 style={{ marginBottom: 4 }}>{l.eleve_prenom} {l.eleve_nom}</h1>
        <div><LeconTitre l={l} /></div>
        <div className="row wrap small muted" style={{ marginTop: 8 }}>
          <span>{t('theorie_faites', { n: Number(data.s?.theorie_faites ?? 0) })}</span>
          <span>· {t('pratique_faites', { n: Number(data.s?.pratique_faites ?? 0) })}</span>
          {data.e?.regime === 'accompagnee' && <span>· {t('regime_accompagnee')}</span>}
        </div>
      </div>

      {data.avant.length > 0 && (
        <div>
          <div className="section-title">{t('historique')}</div>
          <div className="list">
            {data.avant.map(a => (
              <div className="item small" key={a.id}>
                <div style={{ width: 84 }} className="muted">{dateShort(a.debut, lang)}</div>
                <div className="grow">{a.commentaire}{a.points?.length ? <div className="muted">{a.points.map(p => t('pt_' + p)).join(' · ')}</div> : null}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {l.statut !== 'reservee' ? (
        <div className="card stack">
          <StatutBadge l={l} />
          {l.commentaire && <p>{l.commentaire}</p>}
          {!!l.points?.length && <div className="row wrap">{l.points.map(p => <span className="badge" key={p}>{t('pt_' + p)}</span>)}</div>}
          {l.signature && <SignatureView data={l.signature} />}
        </div>
      ) : (
        <div className="stack">
          <div>
            <div className="section-title">{t('points_travailles')}</div>
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              {POINTS.map(p => <button key={p} className={'chip' + (points.includes(p) ? ' on' : '')} onClick={() => toggle(p)}>{t('pt_' + p)}</button>)}
            </div>
          </div>
          <Field label={t('commentaire')}><textarea className="input" value={comment} onChange={e => setComment(e.target.value)} /></Field>
          <div>
            <div className="section-title">{t('signature_eleve')}</div>
            <SignaturePad onChange={setSig} />
          </div>
          <button className="btn block" disabled={busy || !sig} onClick={valider}>{t('valider_lecon')}</button>
          <button className="btn secondary block" disabled={busy} onClick={() => setAbsent(true)}>{t('eleve_absent')}</button>
        </div>
      )}

      <Sheet open={absent} onClose={() => setAbsent(false)} title={t('eleve_absent')}>
        <div className="stack">
          <p>{t('absence_confirmer')}</p>
          <button className="btn danger block" disabled={busy} onClick={marquerAbsent}>{t('confirmer')}</button>
          <button className="btn ghost block" onClick={() => setAbsent(false)}>{t('annuler')}</button>
        </div>
      </Sheet>
    </div>
  );
}
