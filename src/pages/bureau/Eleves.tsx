import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { backend, type Invitation } from '../../lib/backend';
import { LANGS, useI18n } from '../../lib/i18n';
import { useMe } from '../../lib/session';
import { Empty, Field, Icon, Loading, Sheet, useAction, useLoad } from '../../components/ui';

export function Eleves() {
  const { t } = useI18n();
  const me = useMe();
  const b = backend();
  const [q, setQ] = useState('');
  const [nouveau, setNouveau] = useState(false);
  const { data, error, reload } = useLoad(() => b.select('v_eleves', { order: [['prenom', 'asc']] }), []);
  if (!data) return <Loading error={error} />;
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = data.filter((e: any) => norm(`${e.prenom} ${e.nom} ${e.telephone ?? ''}`).includes(norm(q)));
  return (
    <div className="stack">
      <div className="row between"><h1 style={{ margin: 0 }}>{t('nav_eleves')}</h1>{me.profil.role !== 'lecture' && <button className="btn" onClick={() => setNouveau(true)}>{t('nouvel_eleve')}</button>}</div>
      <input className="input" placeholder={t('rechercher')} value={q} onChange={e => setQ(e.target.value)} />
      {list.length === 0 ? <Empty /> : (
        <div className="list">
          {list.map((e: any) => (
            <Link key={e.id} to={`/eleves/${e.id}`} className="item" style={{ textDecoration: 'none' }}>
              <div className="grow">
                <strong>{e.prenom} {e.nom}</strong>
                <div className="muted small">
                  {e.regime === 'accompagnee' ? t('regime_accompagnee') : t('regime_classique')} · {t('theorie_faites', { n: e.theorie_faites })} · {t('pratique_faites', { n: e.pratique_faites })}
                </div>
              </div>
              {!e.actif && <span className="badge bad">inactif</span>}
              <span className="badge dark">{t('heures_n', { n: Number(e.solde_heures) })}</span>
              <Icon name="chevron" size={18} />
            </Link>
          ))}
        </div>
      )}
      <Sheet open={nouveau} onClose={() => setNouveau(false)} title={t('nouvel_eleve')}>
        {nouveau && <InviteForm role="eleve" onDone={() => { setNouveau(false); reload(); }} />}
      </Sheet>
    </div>
  );
}

export function InviteForm({ role, onDone, allowRole }: { role: Invitation['role']; onDone: () => void; allowRole?: boolean }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const { run, busy } = useAction();
  const [f, setF] = useState<Invitation>({ email: '', prenom: '', nom: '', role, telephone: '', langue: 'fr', regime: 'classique' });
  const [created, setCreated] = useState<{ id: string; motDePasse: string } | null>(null);
  const finish = (id: string) => { onDone(); if (f.role === 'eleve') nav(`/eleves/${id}`); };
  if (created) return (
    <div className="stack">
      <div className="alert ok">{t('compte_cree')}</div>
      <p>{t('mdp_temporaire', { email: f.email })}</p>
      <div className="card center"><strong className="mono" style={{ fontSize: 22, letterSpacing: '.05em' }} data-testid="mdp-temp">{created.motDePasse}</strong></div>
      <p className="small muted">{t('mdp_temporaire_info')}</p>
      <button className="btn block" onClick={() => finish(created.id)}>{t('ok')}</button>
    </div>
  );
  const set = (k: keyof Invitation, v: string) => setF(x => ({ ...x, [k]: v }));
  return (
    <form className="stack" onSubmit={e => {
      e.preventDefault();
      run(async () => {
        const r = await backend().invite(f);
        if (r.motDePasse) setCreated({ id: r.id, motDePasse: r.motDePasse }); else finish(r.id);
      }, t('enregistre'));
    }}>
      <div className="grid2">
        <Field label={t('prenom')}><input className="input" required value={f.prenom} onChange={e => set('prenom', e.target.value)} /></Field>
        <Field label={t('nom')}><input className="input" required value={f.nom} onChange={e => set('nom', e.target.value)} /></Field>
      </div>
      <Field label={t('email')}><input className="input" type="email" required value={f.email} onChange={e => set('email', e.target.value)} /></Field>
      <Field label={t('telephone')}><input className="input" type="tel" value={f.telephone} onChange={e => set('telephone', e.target.value)} /></Field>
      <div className="grid2">
        <Field label={t('langue')}>
          <select className="input" value={f.langue} onChange={e => set('langue', e.target.value)}>{LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
        </Field>
        {allowRole ? (
          <Field label={t('role')}>
            <select className="input" value={f.role} onChange={e => set('role', e.target.value)}>
              {(['moniteur', 'secretariat', 'lecture'] as const).map(r => <option key={r} value={r}>{t('role_' + r)}</option>)}
            </select>
          </Field>
        ) : f.role === 'eleve' ? (
          <Field label={t('regime')}>
            <select className="input" value={f.regime} onChange={e => set('regime', e.target.value)}>
              <option value="classique">{t('regime_classique')}</option><option value="accompagnee">{t('regime_accompagnee')}</option>
            </select>
          </Field>
        ) : null}
      </div>
      <p className="small muted">{t('inviter_info')}</p>
      <button className="btn block" disabled={busy}>{t('creer')}</button>
    </form>
  );
}
