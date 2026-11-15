import { Link } from 'react-router-dom';
import { backend } from '../../lib/backend';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { LeconTitre, LieuDepart, type Lecon } from '../../components/lecon';
import { Loading, useLoad } from '../../components/ui';

export function EleveAccueil() {
  const { t } = useI18n();
  const me = useMe();
  const b = backend();
  const { data, error } = useLoad(async () => {
    const [s] = await b.select('soldes', { eq: { eleve_id: me.profil.id } });
    const [e] = await b.select('eleves', { eq: { id: me.profil.id } });
    const [next] = await b.select<Lecon>('v_lecons', { eq: { eleve_id: me.profil.id, statut: 'reservee' }, gte: { debut: new Date().toISOString() }, order: [['debut', 'asc']], limit: 1 });
    const notifs = await b.select('notifications', { order: [['created_at', 'desc']], limit: 3 });
    return { solde: Number(s?.solde_heures ?? 0), theorie: Number(s?.theorie_faites ?? 0), pratique: Number(s?.pratique_faites ?? 0), e, next, notifs };
  }, [me.profil.id]);

  if (!data) return <Loading error={error} />;
  const theorieOk = !!data.e?.theorie_reussie_le;

  return (
    <div className="stack">
      <h1>{t('bonjour', { prenom: me.profil.prenom })}</h1>

      <div className="card dark tire">
        <div className="muted small">{t('solde')}</div>
        <div className="row between">
          <div className="big-number" data-testid="solde">{t('heures_n', { n: data.solde })}</div>
          {data.solde > 0 && theorieOk
            ? <Link className="btn light" to="/reserver">{t('reserver_lecon')}</Link>
            : <Link className="btn light" to="/paiements">{t('acheter_heures')}</Link>}
        </div>
      </div>

      {!theorieOk && <div className="alert warn">{t('theorie_requise')}</div>}
      {data.e?.regime === 'accompagnee' && <div className="alert">{t('accompagnee_info')}</div>}

      <div>
        <div className="section-title">{t('prochaine_lecon')}</div>
        {data.next ? (
          <div className="card stack">
            <div><LeconTitre l={data.next} /></div>
            <div className="muted">{t('avec', { nom: data.next.moniteur_prenom })}</div>
            <LieuDepart />
            <p className="small muted" style={{ margin: 0 }}>{t('certificat_porter')}</p>
          </div>
        ) : <div className="card muted">{t('aucune_lecon_prevue')}</div>}
      </div>

      <div>
        <div className="section-title">{t('progression')}</div>
        <div className="card stack">
          <Progress label={t('theorie_faites', { n: Math.min(data.theorie, 12) })} value={data.theorie} max={12} />
          <Progress label={t('pratique_faites', { n: Math.min(data.pratique, 16) })} value={data.pratique} max={16} />
        </div>
      </div>

      {data.notifs.length > 0 && (
        <div>
          <div className="section-title">{t('notifications')}</div>
          <div className="list">
            {data.notifs.map((n: any) => (
              <div className="item" key={n.id}><div className="grow"><strong>{n.titre}</strong>{n.contenu && <div className="muted small">{n.contenu}</div>}</div></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Progress({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="small" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'var(--brand)' }} />
      </div>
    </div>
  );
}
