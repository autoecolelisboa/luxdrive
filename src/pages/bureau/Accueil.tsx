import { Link } from 'react-router-dom';
import { backend } from '../../lib/backend';
import { euro, luxDate, luxDayStart, time } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { StatutBadge, type Lecon } from '../../components/lecon';
import type { Facture } from '../../components/facture';
import { Empty, Loading, useLoad } from '../../components/ui';

export function BureauAccueil() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const { data, error } = useLoad(async () => {
    const from = luxDayStart(luxDate()), to = luxDayStart(luxDate(new Date(), 1));
    const [lecons, certifs, factures, eleves] = await Promise.all([
      b.select<Lecon>('v_lecons', { gte: { debut: from }, lt: { debut: to }, order: [['debut', 'asc']] }),
      b.select<Lecon>('v_lecons', { eq: { justificatif_statut: 'attente' } }),
      b.select<Facture>('v_factures', { eq: { statut: 'a_payer' }, order: [['created_at', 'asc']] }),
      b.select('v_eleves', { eq: { actif: true } }),
    ]);
    return { lecons, certifs, factures, eleves };
  }, []);
  if (!data) return <Loading error={error} />;
  const actives = data.lecons.filter(l => ['reservee', 'effectuee', 'absence'].includes(l.statut));

  return (
    <div className="stack">
      <h1>{t('bonjour', { prenom: me.profil.prenom })}</h1>
      <div className="grid4">
        <Kpi to="/agenda" label={t('lecons_aujourdhui')} value={actives.length} />
        <Kpi to="/certificats" label={t('certificats_attente')} value={data.certifs.length} alert={data.certifs.length > 0} />
        <Kpi to="/factures" label={t('factures_encaisser')} value={data.factures.length} sub={euro(data.factures.reduce((s, f) => s + Number(f.total_ttc), 0), lang)} />
        <Kpi to="/eleves" label={t('eleves_actifs')} value={data.eleves.length} />
      </div>

      <div className="section-title">{t('lecons_aujourdhui')}</div>
      {data.lecons.length === 0 ? <Empty /> : (
        <div className="list">
          {data.lecons.map(l => (
            <div className="item" key={l.id}>
              <div className="mono" style={{ width: 56, fontWeight: 600 }}>{time(l.debut, lang)}</div>
              <div className="grow"><strong>{l.eleve_prenom} {l.eleve_nom}</strong><div className="muted small">{t('avec', { nom: l.moniteur_prenom })}</div></div>
              <StatutBadge l={l} />
            </div>
          ))}
        </div>
      )}

      {data.factures.length > 0 && <>
        <div className="section-title">{t('factures_encaisser')}</div>
        <div className="list">
          {data.factures.slice(0, 6).map(f => (
            <Link className="item" to="/factures" key={f.id} style={{ textDecoration: 'none' }}>
              <div className="grow"><strong>{f.eleve_prenom} {f.eleve_nom}</strong><div className="muted small">{f.numero} · {f.objet} · {f.moyen_annonce === 'virement' ? t('virement') : f.moyen_annonce === 'especes' ? t('especes') : 'Wero'}</div></div>
              <span className="mono">{euro(f.total_ttc, lang)}</span>
            </Link>
          ))}
        </div>
      </>}
    </div>
  );
}

function Kpi({ to, label, value, sub, alert }: { to: string; label: string; value: number; sub?: string; alert?: boolean }) {
  return (
    <Link to={to} className={'card' + (alert ? ' dark' : '')} style={{ textDecoration: 'none' }}>
      <div className="muted small">{label}</div>
      <div className="kpi">{value}</div>
      {sub && <div className="small muted">{sub}</div>}
    </Link>
  );
}
