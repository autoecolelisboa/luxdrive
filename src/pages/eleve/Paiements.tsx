import { useState } from 'react';
import { backend } from '../../lib/backend';
import { dateShort, euro } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { FactureBadge, FactureDetail, VirementInfo, type Facture } from '../../components/facture';
import { Empty, Loading, Sheet, useAction, useLoad, useToast } from '../../components/ui';

type Formule = { id: string; code: string; nom: string; heures: number; prix_ttc: number };
type Moyen = 'wero' | 'virement' | 'especes';

export function Paiements() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const toast = useToast();
  const { run, busy } = useAction();
  const [buy, setBuy] = useState<Formule | null>(null);
  const [result, setResult] = useState<{ f: Facture; moyen: Moyen; weroOff?: boolean } | null>(null);
  const [open, setOpen] = useState<Facture | null>(null);

  const { data, error, reload } = useLoad(async () => {
    const [formules, factures] = await Promise.all([
      b.select<Formule>('formules', { eq: { active: true }, order: [['ordre', 'asc']] }),
      b.select<Facture>('v_factures', { eq: { eleve_id: me.profil.id }, order: [['created_at', 'desc']] }),
    ]);
    return { formules, factures };
  }, [me.profil.id]);

  if (!data) return <Loading error={error} />;
  const label = (f: Formule) => f.heures === 1 ? t('lecon_unite') : t('forfait_n', { n: f.heures });

  const choose = (moyen: Moyen) => run(async () => {
    const id = await b.rpc<string>('creer_facture', { p_eleve: me.profil.id, p_code: buy!.code, p_moyen: moyen });
    const [f] = await b.select<Facture>('v_factures', { eq: { id } });
    setBuy(null);
    if (moyen === 'wero') {
      const r = await b.payWero(id);
      if (r === 'paid') { toast(t('paiement_recu', { n: f.heures_a_crediter })); reload(); return; }
      if (r === 'unavailable') { setResult({ f, moyen, weroOff: true }); reload(); return; }
      return;
    }
    setResult({ f, moyen }); reload();
  });

  const payExisting = (f: Facture, moyen: Moyen) => run(async () => {
    if (moyen === 'wero') {
      const r = await b.payWero(f.id);
      if (r === 'paid') { toast(t('paiement_recu', { n: f.heures_a_crediter })); setOpen(null); reload(); }
      else if (r === 'unavailable') toast(t('wero_bientot'), true);
    }
  });

  const Methods = ({ onPick }: { onPick: (m: Moyen) => void }) => (
    <div className="list">
      {(['wero', 'virement', 'especes'] as Moyen[]).map(m => (
        <button key={m} className="item" disabled={busy} onClick={() => onPick(m)}>
          <div className="grow"><strong>{m === 'wero' ? t('wero') : t(m)}</strong><div className="muted small">{t(m + '_desc')}</div></div>
          <span className="muted">›</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="stack">
      <h1>{t('nav_paiements')}</h1>
      <div className="section-title">{t('formules')}</div>
      <div className="list">
        {data.formules.map(f => (
          <button key={f.id} className="item" onClick={() => setBuy(f)} data-testid={'formule-' + f.code}>
            <div className="grow"><strong>{label(f)}</strong><div className="muted small">{euro(f.prix_ttc / f.heures, lang)} / h</div></div>
            <strong className="mono">{euro(f.prix_ttc, lang)}</strong><span className="muted small">{t('ttc')}</span>
          </button>
        ))}
      </div>

      <div className="section-title">{t('mes_factures')}</div>
      {data.factures.length === 0 ? <Empty /> : (
        <div className="list">
          {data.factures.map(f => (
            <button key={f.id} className="item" onClick={() => setOpen(f)}>
              <div className="grow">
                <strong>{f.objet}</strong>
                <div className="muted small">{f.numero} · {dateShort(f.date_emission, lang)}
                  {f.statut === 'a_payer' && f.moyen_annonce === 'virement' && ` · ${t('attente_virement')}`}
                  {f.statut === 'a_payer' && f.moyen_annonce === 'especes' && ` · ${t('attente_especes')}`}
                </div>
              </div>
              <span className="mono">{euro(f.total_ttc, lang)}</span>
              <FactureBadge f={f} />
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!buy} onClose={() => setBuy(null)} title={buy ? label(buy) : ''}>
        {buy && (
          <div className="stack">
            <div className="row between"><span className="muted">{t('total')}</span><strong className="big-number" style={{ fontSize: 28 }}>{euro(buy.prix_ttc, lang)}</strong></div>
            <p className="small muted">{t('choisir_paiement')}</p>
            <Methods onPick={choose} />
          </div>
        )}
      </Sheet>

      <Sheet open={!!result} onClose={() => setResult(null)} title={result ? `${t('facture')} ${result.f.numero}` : ''}>
        {result && (
          <div className="stack">
            {result.weroOff && <div className="alert warn">{t('wero_bientot')}</div>}
            {result.moyen === 'virement' && <VirementInfo f={result.f} />}
            {result.moyen === 'especes' && <div className="alert">{t('especes_infos', { m: euro(result.f.total_ttc, lang), adresse: me.ecole.adresse ?? '' })}</div>}
            <button className="btn block" onClick={() => setResult(null)}>{t('ok')}</button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="stack">
            <FactureDetail f={open} />
            {open.statut === 'a_payer' && (
              <div className="stack no-print">
                <div className="section-title">{t('payer')}</div>
                <button className="btn block" disabled={busy} onClick={() => payExisting(open, 'wero')}>{t('payer_wero', { m: euro(open.total_ttc, lang) })}</button>
                <VirementInfo f={open} />
                <div className="alert small">{t('especes_infos', { m: euro(open.total_ttc, lang), adresse: me.ecole.adresse ?? '' })}</div>
              </div>
            )}
            <button className="btn ghost block no-print" onClick={() => setOpen(null)}>{t('fermer')}</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
