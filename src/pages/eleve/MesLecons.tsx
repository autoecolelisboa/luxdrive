import { useRef, useState } from 'react';
import { backend } from '../../lib/backend';
import { hoursUntil } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { LeconTitre, LieuDepart, StatutBadge, type Lecon } from '../../components/lecon';
import { Empty, Loading, Sheet, useAction, useLoad, useToast } from '../../components/ui';

export function MesLecons() {
  const { t } = useI18n();
  const me = useMe();
  const b = backend();
  const toast = useToast();
  const { run, busy } = useAction();
  const [tab, setTab] = useState<'avenir' | 'passees'>('avenir');
  const [cancel, setCancel] = useState<Lecon | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [certFor, setCertFor] = useState<Lecon | null>(null);

  const { data, error, reload } = useLoad(async () => {
    const all = await b.select<Lecon>('v_lecons', { eq: { eleve_id: me.profil.id }, order: [['debut', 'desc']], limit: 200 });
    const now = Date.now();
    return {
      avenir: all.filter(l => l.statut === 'reservee' && new Date(l.fin).getTime() > now).reverse(),
      passees: all.filter(l => !(l.statut === 'reservee' && new Date(l.fin).getTime() > now)),
    };
  }, [me.profil.id]);

  if (!data) return <Loading error={error} />;
  const list = data[tab];
  const delai = me.ecole.delai_annulation_h;

  const doCancel = () => run(async () => {
    const r = await b.rpc<string>('annuler_lecon', { p_lecon: cancel!.id });
    setCancel(null); reload();
    toast(r === 'libre' ? t('annul_gratuite') : t('st_annulee_tardive', { h: delai }));
  });

  const onFile = (f: File | undefined) => {
    if (!f || !certFor) return;
    const ext = (f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${me.profil.id}/${certFor.id}-${Date.now()}.${ext}`;
    run(async () => {
      await b.upload('certificats', path, f);
      await b.rpc('deposer_certificat', { p_lecon: certFor.id, p_chemin: path });
      setCertFor(null); reload();
    }, t('certificat_attente'));
  };

  return (
    <div className="stack">
      <h1>{t('nav_lecons')}</h1>
      <div className="chips">
        <button className={'chip' + (tab === 'avenir' ? ' on' : '')} onClick={() => setTab('avenir')}>{t('a_venir')} ({data.avenir.length})</button>
        <button className={'chip' + (tab === 'passees' ? ' on' : '')} onClick={() => setTab('passees')}>{t('passees')}</button>
      </div>

      {list.length === 0 ? <Empty /> : list.map(l => (
        <div className="card stack" key={l.id} data-testid="lecon">
          <div className="row between wrap"><div><LeconTitre l={l} /></div><StatutBadge l={l} /></div>
          <div className="muted small">{t('avec', { nom: l.moniteur_prenom })}</div>
          {tab === 'avenir' && <>
            <LieuDepart />
            {new Date(l.debut).getTime() > Date.now() && <button className="btn secondary sm" onClick={() => setCancel(l)}>{t('annuler_lecon')}</button>}
          </>}
          {l.statut === 'effectuee' && (l.commentaire || l.points?.length) ? (
            <div className="card soft small">
              <div className="muted">{t('commentaire_moniteur')}</div>
              {l.commentaire && <div>{l.commentaire}</div>}
              {!!l.points?.length && <div className="row wrap" style={{ marginTop: 6 }}>{l.points.map(p => <span className="badge" key={p}>{t('pt_' + p)}</span>)}</div>}
            </div>
          ) : null}
          {l.statut === 'annulee_tardive' && (
            l.justificatif_statut === 'attente' ? <div className="alert warn small">{t('certificat_attente')}</div>
              : l.justificatif_statut === 'accepte' ? <div className="alert ok small">{t('certificat_accepte')}</div>
                : l.justificatif_statut === 'refuse' ? <div className="alert bad small">{t('certificat_refuse', { motif: l.justificatif_motif ?? '' })}</div>
                  : <button className="btn secondary sm" disabled={busy} onClick={() => { setCertFor(l); fileRef.current?.click(); }}>{t('envoyer_certificat')}</button>
          )}
        </div>
      ))}

      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden data-testid="certif-input" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

      <Sheet open={!!cancel} onClose={() => setCancel(null)} title={t('annuler_lecon')}>
        {cancel && (
          <div className="stack">
            <div><LeconTitre l={cancel} /></div>
            {hoursUntil(cancel.debut) >= delai
              ? <div className="alert ok">{t('annul_gratuite')}</div>
              : <div className="alert bad">{t('annul_tardive', { h: delai })}</div>}
            <button className="btn danger block" disabled={busy} onClick={doCancel}>{hoursUntil(cancel.debut) >= delai ? t('confirmer') : t('annuler_quand_meme')}</button>
            <button className="btn ghost block" onClick={() => setCancel(null)}>{t('garder_lecon')}</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
