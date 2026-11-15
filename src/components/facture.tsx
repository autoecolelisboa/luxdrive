import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { backend } from '../lib/backend';
import { dateShort, epcPayload, euro } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useMe } from '../lib/session';
import { Loading, useLoad, useToast } from './ui';

export type Facture = {
  id: string; numero: string; objet: string; date_emission: string; echeance: string; statut: 'a_payer' | 'payee' | 'annulee';
  moyen_annonce: 'wero' | 'virement' | 'especes' | null; heures_a_crediter: number; total_ht: number; total_tva: number; total_ttc: number;
  eleve_id: string; eleve_prenom: string; eleve_nom: string; formule_code: string | null;
};

export function FactureBadge({ f }: { f: Facture }) {
  const { t } = useI18n();
  const cls = { a_payer: 'warn', payee: 'ok', annulee: '' }[f.statut];
  return <span className={'badge ' + cls}>{t('fst_' + f.statut)}</span>;
}

export function FactureDetail({ f }: { f: Facture }) {
  const { t, lang } = useI18n();
  const me = useMe();
  const lignes = useLoad(() => backend().select('lignes_facture', { eq: { facture_id: f.id }, order: [['ordre', 'asc']] }), [f.id]);
  const paiements = useLoad(() => backend().select('paiements', { eq: { facture_id: f.id } }), [f.id]);
  return (
    <div className="printable stack">
      <div className="row between">
        <div>
          <img src="./logo.svg?v=2" alt="" style={{ height: 48 }} />
          <div className="small muted">{me.ecole.nom} · {me.ecole.adresse}{me.ecole.numero_tva ? ` · TVA ${me.ecole.numero_tva}` : ''}</div>
        </div>
        <FactureBadge f={f} />
      </div>
      <div>
        <h2 style={{ marginBottom: 2 }}>{t('facture')} {f.numero}</h2>
        <div className="muted small">{t('emise_le', { d: dateShort(f.date_emission, lang) })} · {f.eleve_prenom} {f.eleve_nom}</div>
      </div>
      {!lignes.data ? <Loading error={lignes.error} /> : (
        <table className="inv-table mono">
          <thead><tr><th>{f.objet}</th><th>{t('ht')}</th><th>{t('tva')}</th><th>{t('ttc')}</th></tr></thead>
          <tbody>
            {lignes.data.map((l: any) => (
              <tr key={l.id}><td>{l.libelle}</td><td>{euro(l.montant_ht, lang)}</td><td>{Number(l.taux_tva)} % · {euro(l.montant_tva, lang)}</td><td>{euro(l.montant_ttc, lang)}</td></tr>
            ))}
            <tr><td><strong>{t('total')}</strong></td><td>{euro(f.total_ht, lang)}</td><td>{euro(f.total_tva, lang)}</td><td><strong>{euro(f.total_ttc, lang)}</strong></td></tr>
          </tbody>
        </table>
      )}
      {paiements.data?.map((p: any) => (
        <div className="small muted" key={p.id}>{t('encaisse')} · {dateShort(p.created_at, lang)} · {p.moyen === 'wero' ? 'Wero' : p.moyen === 'virement' ? t('virement') : t('especes')} · {euro(p.montant, lang)}</div>
      ))}
      <button className="btn secondary sm no-print" onClick={() => window.print()}>{t('imprimer')}</button>
    </div>
  );
}

export function VirementInfo({ f }: { f: Facture }) {
  const { t, lang } = useI18n();
  const me = useMe();
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const iban = me.ecole.iban?.trim();
  const benef = me.ecole.beneficiaire || me.ecole.nom;
  useEffect(() => {
    if (!iban) return;
    QRCode.toDataURL(epcPayload({ benef, iban, montant: f.total_ttc, communication: f.numero }), { errorCorrectionLevel: 'M', margin: 1, width: 220 })
      .then(setQr).catch(() => setQr(null));
  }, [iban, benef, f.total_ttc, f.numero]);
  if (!iban) return <div className="alert warn">{t('iban_absent')}</div>;
  const copy = (v: string) => { navigator.clipboard?.writeText(v).then(() => toast(t('copie'))).catch(() => {}); };
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="item"><div className="grow"><div className="muted small">{k}</div><strong className="mono">{v}</strong></div><button className="btn ghost sm" onClick={() => copy(v)}>{t('copier')}</button></div>
  );
  return (
    <div className="stack">
      <p className="small">{t('virement_infos')}</p>
      <div className="list">
        <Row k={t('beneficiaire')} v={benef} />
        <Row k={t('iban')} v={iban} />
        <Row k={t('montant')} v={euro(f.total_ttc, lang)} />
        <Row k={t('communication')} v={f.numero} />
      </div>
      {qr && <><div className="qr"><img src={qr} alt="QR" width={220} height={220} data-testid="qr" /></div><p className="small muted center">{t('scanner_qr')}</p></>}
    </div>
  );
}
