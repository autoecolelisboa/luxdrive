import { useState } from 'react';
import { backend } from '../../lib/backend';
import { dateShort } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { type Lecon } from '../../components/lecon';
import { Empty, Field, Loading, Sheet, useAction, useLoad } from '../../components/ui';

export function Justificatifs() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const { run, busy } = useAction();
  const [refus, setRefus] = useState<Lecon | null>(null);
  const [motif, setMotif] = useState('');
  const [view, setView] = useState<string | null>(null);
  const { data, error, reload } = useLoad(() => b.select<Lecon>('v_lecons', { eq: { justificatif_statut: 'attente' }, order: [['annulee_le', 'asc']] }), []);
  const canWrite = me.profil.role === 'gerant' || me.profil.role === 'secretariat';

  const decide = (l: Lecon, accepte: boolean, m?: string) => run(async () => {
    const path = await b.rpc<string | null>('decider_certificat', { p_lecon: l.id, p_accepte: accepte, p_motif: m ?? null });
    if (path) await b.removeFile('certificats', path).catch(() => {}); // the medical file is deleted once decided
    setRefus(null); setMotif(''); reload();
  }, accepte ? t('certificat_accepte') : t('enregistre'));

  if (!data) return <Loading error={error} />;
  return (
    <div className="stack">
      <h1>{t('certificats_attente')}</h1>
      <p className="muted small">{t('certif_info', { h: me.ecole.delai_annulation_h })}</p>
      {data.length === 0 ? <Empty /> : data.map(l => (
        <div className="card stack" key={l.id}>
          <div className="row between wrap">
            <div><strong>{l.eleve_prenom} {l.eleve_nom}</strong><div className="muted small">{t('lecon_du', { d: dateShort(l.debut, lang) })} · {t('avec', { nom: l.moniteur_prenom })}{l.annulee_le ? ` · ${t('annulee_le', { d: dateShort(l.annulee_le, lang) })}` : ''}</div></div>
            <button className="btn ghost sm" onClick={() => run(async () => setView(await b.fileUrl('certificats', l.justificatif_chemin!)))}>{t('voir_certificat')}</button>
          </div>
          {canWrite && (
            <div className="row">
              <button className="btn grow" disabled={busy} onClick={() => decide(l, true)}>{t('accepter')}</button>
              <button className="btn secondary grow" disabled={busy} onClick={() => setRefus(l)}>{t('refuser')}</button>
            </div>
          )}
        </div>
      ))}
      <Sheet open={!!refus} onClose={() => setRefus(null)} title={t('refuser')}>
        <div className="stack">
          <Field label={t('motif')}><input className="input" value={motif} onChange={e => setMotif(e.target.value)} /></Field>
          <button className="btn danger block" disabled={busy || !motif.trim()} onClick={() => decide(refus!, false, motif)}>{t('refuser')}</button>
        </div>
      </Sheet>
      <Sheet open={!!view} onClose={() => setView(null)} title={t('voir_certificat')}>
        {view && <div className="stack">
          {view.startsWith('data:application/pdf') || view.includes('.pdf') ? <iframe src={view} title="certificat" style={{ width: '100%', height: '60vh', border: 0 }} /> : <img src={view} alt="certificat" style={{ maxWidth: '100%' }} />}
          <button className="btn ghost block" onClick={() => setView(null)}>{t('fermer')}</button>
        </div>}
      </Sheet>
    </div>
  );
}
