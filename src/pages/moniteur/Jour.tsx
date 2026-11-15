import { useState } from 'react';
import { Link } from 'react-router-dom';
import { backend } from '../../lib/backend';
import { dateLong, luxDate, luxDayStart, time } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { StatutBadge, type Lecon } from '../../components/lecon';
import { Empty, Icon, Loading, useLoad } from '../../components/ui';

export function MoniteurJour() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const [off, setOff] = useState(0);
  const day = luxDate(new Date(), off);

  const { data, error } = useLoad(async () => {
    const from = luxDayStart(day), to = luxDayStart(luxDate(new Date(day + 'T12:00:00Z'), 1));
    const [lecons, seances] = await Promise.all([
      b.select<Lecon>('v_lecons', { eq: { moniteur_id: me.profil.id }, gte: { debut: from }, lt: { debut: to }, order: [['debut', 'asc']] }),
      b.select('seances_theorie', { eq: { moniteur_id: me.profil.id }, gte: { debut: from }, lt: { debut: to }, order: [['debut', 'asc']] }),
    ]);
    return { lecons, seances };
  }, [day, me.profil.id]);

  return (
    <div className="stack">
      <div className="row between">
        <button className="btn ghost sm" onClick={() => setOff(o => o - 1)} aria-label="précédent"><Icon name="left" /></button>
        <div className="center">
          <h1 style={{ margin: 0 }}>{off === 0 ? t('aujourd_hui') : dateLong(day + 'T12:00:00Z', lang)}</h1>
          {off === 0 && <div className="muted small">{dateLong(day + 'T12:00:00Z', lang)}</div>}
        </div>
        <button className="btn ghost sm" onClick={() => setOff(o => o + 1)} aria-label="suivant"><Icon name="chevron" /></button>
      </div>

      {!data ? <Loading error={error} /> : <>
        <div className="section-title">{t('lecons_du_jour')}</div>
        {data.lecons.length === 0 ? <Empty /> : (
          <div className="list">
            {data.lecons.map(l => (
              <Link key={l.id} to={`/lecon/${l.id}`} className="item" style={{ textDecoration: 'none' }}>
                <div className="mono" style={{ width: 56, fontWeight: 600 }}>{time(l.debut, lang)}</div>
                <div className="grow"><strong>{l.eleve_prenom} {l.eleve_nom}</strong></div>
                <StatutBadge l={l} />
                <Icon name="chevron" size={18} />
              </Link>
            ))}
          </div>
        )}
        {data.seances.length > 0 && <>
          <div className="section-title">{t('seances_theorie')}</div>
          <div className="list">
            {data.seances.map((s: any) => (
              <Link key={s.id} to="/theorie" className="item" style={{ textDecoration: 'none' }}>
                <div className="mono" style={{ width: 56, fontWeight: 600 }}>{time(s.debut, lang)}</div>
                <div className="grow">{s.theme}</div>
                {s.pointee && <span className="badge ok">{t('pointee')}</span>}
              </Link>
            ))}
          </div>
        </>}
      </>}
    </div>
  );
}
