import { useState } from 'react';
import { backend } from '../../lib/backend';
import { dateShort, euro } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { FactureBadge, FactureDetail, type Facture } from '../../components/facture';
import { Empty, Field, Loading, Sheet, useAction, useLoad } from '../../components/ui';

export function Factures() {
  const { t, lang } = useI18n();
  const b = backend();
  const [filtre, setFiltre] = useState<'a_payer' | 'toutes'>('a_payer');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Facture | null>(null);
  const { data, error, reload } = useLoad(() => b.select<Facture>('v_factures', {
    ...(filtre === 'a_payer' ? { eq: { statut: 'a_payer' } } : {}), order: [['created_at', 'desc']], limit: 500,
  }), [filtre]);
  if (!data) return <Loading error={error} />;
  const list = data.filter(f => `${f.numero} ${f.eleve_prenom} ${f.eleve_nom}`.toLowerCase().includes(q.toLowerCase()));
  const total = list.filter(f => f.statut === 'a_payer').reduce((s, f) => s + Number(f.total_ttc), 0);
  return (
    <div className="stack">
      <h1>{t('nav_factures')}</h1>
      <div className="row wrap between">
        <div className="chips">
          <button className={'chip' + (filtre === 'a_payer' ? ' on' : '')} onClick={() => setFiltre('a_payer')}>{t('a_encaisser')}</button>
          <button className={'chip' + (filtre === 'toutes' ? ' on' : '')} onClick={() => setFiltre('toutes')}>{t('toutes')}</button>
        </div>
        {total > 0 && <span className="muted">{t('a_encaisser')} : <strong className="mono">{euro(total, lang)}</strong></span>}
      </div>
      <input className="input" placeholder={t('rechercher')} value={q} onChange={e => setQ(e.target.value)} />
      {list.length === 0 ? <Empty /> : (
        <div className="list">
          {list.map(f => (
            <button className="item" key={f.id} onClick={() => setOpen(f)}>
              <div className="grow">
                <strong>{f.eleve_prenom} {f.eleve_nom}</strong>
                <div className="muted small">{f.numero} · {f.objet} · {dateShort(f.date_emission, lang)}{f.statut === 'a_payer' && f.moyen_annonce ? ` · ${f.moyen_annonce === 'virement' ? t('virement') : f.moyen_annonce === 'especes' ? t('especes') : 'Wero'}` : ''}</div>
              </div>
              <span className="mono">{euro(f.total_ttc, lang)}</span>
              <FactureBadge f={f} />
            </button>
          ))}
        </div>
      )}
      <FactureSheet f={open} onClose={() => setOpen(null)} onChange={() => { setOpen(null); reload(); }} />
    </div>
  );
}

export function FactureSheet({ f, onClose, onChange }: { f: Facture | null; onClose: () => void; onChange: () => void }) {
  const { t } = useI18n();
  const me = useMe();
  const b = backend();
  const { run, busy } = useAction();
  const [moyen, setMoyen] = useState<'especes' | 'virement' | 'wero'>('especes');
  const [ref, setRef] = useState('');
  const [motif, setMotif] = useState('');
  const [mode, setMode] = useState<'view' | 'annuler'>('view');
  const canWrite = me.profil.role === 'gerant' || me.profil.role === 'secretariat';
  const close = () => { setMode('view'); setMotif(''); setRef(''); onClose(); };
  return (
    <Sheet open={!!f} onClose={close}>
      {f && (
        <div className="stack">
          <FactureDetail f={f} />
          {f.statut === 'a_payer' && canWrite && mode === 'view' && (
            <div className="card soft stack no-print">
              <Field group label={t('moyen')}>
                <div className="chips">
                  {(['especes', 'virement', 'wero'] as const).map(m => <button key={m} className={'chip' + (moyen === m ? ' on' : '')} onClick={() => setMoyen(m)}>{m === 'wero' ? 'Wero' : t(m)}</button>)}
                </div>
              </Field>
              <Field label={t('reference')}><input className="input" value={ref} onChange={e => setRef(e.target.value)} /></Field>
              <button className="btn block" disabled={busy} onClick={() => run(async () => { await b.rpc('encaisser_facture', { p_facture: f.id, p_moyen: moyen, p_reference: ref || null }); setRef(''); onChange(); }, t('encaisse'))}>{t('encaisser')}</button>
              <button className="btn ghost block" onClick={() => setMode('annuler')}>{t('annuler_facture')}</button>
            </div>
          )}
          {mode === 'annuler' && (
            <div className="card soft stack no-print">
              <Field label={t('motif')}><input className="input" value={motif} onChange={e => setMotif(e.target.value)} /></Field>
              <button className="btn danger block" disabled={busy || !motif.trim()} onClick={() => run(async () => { await b.rpc('annuler_facture', { p_facture: f.id, p_motif: motif }); setMode('view'); setMotif(''); onChange(); }, t('enregistre'))}>{t('annuler_facture')}</button>
              <button className="btn ghost block" onClick={() => setMode('view')}>{t('retour')}</button>
            </div>
          )}
          <button className="btn ghost block no-print" onClick={close}>{t('fermer')}</button>
        </div>
      )}
    </Sheet>
  );
}
