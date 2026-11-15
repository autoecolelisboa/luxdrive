import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend } from '../../lib/backend';
import { dateLong, dayParts, luxDate, luxDayStart, time } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { LieuDepart } from '../../components/lecon';
import { Loading, Sheet, useAction, useLoad } from '../../components/ui';

type Slot = { debut: string; moniteur_id: string };

export function Reserver() {
  const { t, lang } = useI18n();
  const me = useMe();
  const b = backend();
  const nav = useNavigate();
  const { run, busy } = useAction();
  const [jour, setJour] = useState<string | null>(null);
  const [moniteur, setMoniteur] = useState<string | null>(null);
  const [pick, setPick] = useState<Slot | null>(null);

  const base = useLoad(async () => {
    const [moniteurs, fermetures, [s], [e], lecons] = await Promise.all([
      b.select('profils', { eq: { role: 'moniteur', actif: true }, order: [['prenom', 'asc']] }),
      b.select('fermetures', { gte: { jour: luxDate() } }),
      b.select('soldes', { eq: { eleve_id: me.profil.id } }),
      b.select('eleves', { eq: { id: me.profil.id } }),
      b.select('lecons', { eq: { eleve_id: me.profil.id }, in: { statut: ['reservee', 'effectuee', 'absence'] }, gte: { debut: luxDayStart(luxDate(new Date(), -7)) } }),
    ]);
    return { moniteurs, fermes: new Set(fermetures.map((f: any) => f.jour)), solde: Number(s?.solde_heures ?? 0), theorieOk: !!e?.theorie_reussie_le, lecons };
  }, [me.profil.id]);

  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => luxDate(new Date(), i)), []);
  const isOpen = (d: string) => me.ecole.jours_ouverture.includes(dayParts(d, lang).isoDow) && !base.data?.fermes.has(d);
  const current = jour ?? days.find(d => base.data && isOpen(d)) ?? days[0];

  const slots = useLoad(async () => {
    if (!base.data || !isOpen(current)) return [] as Slot[];
    return b.rpc<Slot[]>('creneaux_libres', { p_jour: current, p_moniteur: moniteur });
  }, [current, moniteur, !!base.data]);

  if (!base.data) return <Loading error={base.error} />;
  const monName = (id: string) => base.data!.moniteurs.find((m: any) => m.id === id)?.prenom ?? '';

  // lessons in the ISO week of the selected day
  const weekStart = (() => { const d = new Date(current + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (dayParts(current, lang).isoDow - 1)); return d.toISOString().slice(0, 10); })();
  const weekEnd = (() => { const d = new Date(weekStart + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); })();
  const weekCount = base.data.lecons.filter((l: any) => { const d = luxDate(new Date(l.debut)); return d >= weekStart && d < weekEnd; }).length;
  const full = weekCount >= me.ecole.max_lecons_semaine;

  const book = () => run(async () => {
    await b.rpc('reserver_lecon', { p_debut: pick!.debut, p_moniteur: pick!.moniteur_id });
    setPick(null);
    nav('/lecons');
  }, t('lecon_reservee'));

  return (
    <div className="stack">
      <h1>{t('reserver_lecon')}</h1>
      {!base.data.theorieOk && <div className="alert warn">{t('theorie_requise')}</div>}
      {base.data.solde < 1 && <div className="alert bad">{t('err_SOLDE_INSUFFISANT')}</div>}
      <div className="row between small"><span className="muted">{t('solde')}</span><strong>{t('heures_n', { n: base.data.solde })}</strong></div>

      <div>
        <div className="section-title">{t('choisir_jour')}</div>
        <div className="days">
          {days.map(d => {
            const p = dayParts(d, lang); const open = isOpen(d);
            return (
              <button key={d} className={'day' + (d === current ? ' on' : '')} disabled={!open} onClick={() => setJour(d)} aria-label={d}>
                <div className="wd">{p.wd}</div><div className="d">{p.day}</div><div className="wd">{open ? p.month : t('ferme')}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="section-title">{t('moniteur')}</div>
        <div className="chips">
          <button className={'chip' + (!moniteur ? ' on' : '')} onClick={() => setMoniteur(null)}>{t('peu_importe')}</button>
          {base.data.moniteurs.map((m: any) => <button key={m.id} className={'chip' + (moniteur === m.id ? ' on' : '')} onClick={() => setMoniteur(m.id)}>{m.prenom}</button>)}
        </div>
      </div>

      <div>
        <div className="row between">
          <div className="section-title">{t('creneaux_libres')}</div>
          <span className={'badge' + (full ? ' bad' : '')}>{t('semaine_compte', { n: weekCount, max: me.ecole.max_lecons_semaine })}</span>
        </div>
        {!slots.data ? <Loading error={slots.error} /> : slots.data.length === 0
          ? <div className="card muted center">{t('aucun_creneau')}</div>
          : (
            <div className="slots">
              {slots.data.map(s => (
                <button key={s.debut} className="slot" disabled={full || base.data!.solde < 1 || !base.data!.theorieOk} onClick={() => setPick(s)}>
                  {time(s.debut, lang)}<div className="muted small" style={{ fontWeight: 400 }}>{monName(s.moniteur_id)}</div>
                </button>
              ))}
            </div>
          )}
      </div>

      <Sheet open={!!pick} onClose={() => setPick(null)} title={t('confirmer_lecon')}>
        {pick && (
          <div className="stack">
            <div><strong>{dateLong(pick.debut, lang)}</strong> · {time(pick.debut, lang)}</div>
            <div className="muted">{t('avec', { nom: monName(pick.moniteur_id) })}</div>
            <LieuDepart />
            <div className="alert">{t('heure_deduite', { h: me.ecole.delai_annulation_h })}</div>
            <button className="btn block" disabled={busy} onClick={book}>{t('confirmer')}</button>
            <button className="btn ghost block" onClick={() => setPick(null)}>{t('annuler')}</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
