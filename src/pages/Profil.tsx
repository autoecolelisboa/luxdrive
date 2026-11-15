import { useState } from 'react';
import { backend } from '../lib/backend';
import { dateShort } from '../lib/format';
import { LANGS, useI18n, type Lang } from '../lib/i18n';
import { useMe } from '../lib/session';
import { Field, Loading, useAction, useLoad } from '../components/ui';

export function Profil() {
  const { t, lang, setLang } = useI18n();
  const me = useMe();
  const b = backend();
  const { run, busy } = useAction();
  const [tel, setTel] = useState(me.profil.telephone ?? '');
  const [pw, setPw] = useState('');
  const isEleve = me.profil.role === 'eleve';
  const info = useLoad(async () => {
    if (!isEleve) return null;
    const [e] = await b.select('eleves', { eq: { id: me.profil.id } });
    const [a] = await b.select('accompagnateurs', { eq: { eleve_id: me.profil.id } });
    return { e, a };
  }, [me.profil.id]);

  const save = () => run(async () => {
    await b.update('profils', { telephone: tel || null }, { id: me.profil.id });
    await me.reload();
  }, t('enregistre'));
  const changeLang = (l: Lang) => run(async () => {
    setLang(l);
    await b.update('profils', { langue: l }, { id: me.profil.id });
  });

  return (
    <div className="stack">
      <h1>{t('mon_profil')}</h1>
      <div className="card stack">
        <div><div className="muted small">{t('nom')}</div><strong>{me.profil.prenom} {me.profil.nom}</strong></div>
        <div><div className="muted small">{t('email')}</div>{me.email}</div>
        <Field label={t('telephone')}><input className="input" type="tel" value={tel} onChange={e => setTel(e.target.value)} /></Field>
        <button className="btn secondary" disabled={busy} onClick={save}>{t('enregistrer')}</button>
      </div>
      <div className="card">
        <Field group label={t('langue')}>
          <div className="chips">
            {LANGS.map(l => <button key={l.code} className={'chip' + (l.code === lang ? ' on' : '')} onClick={() => changeLang(l.code)}>{l.label}</button>)}
          </div>
        </Field>
      </div>
      {isEleve && (info.data ? (
        <div className="card stack">
          <div><div className="muted small">{t('regime')}</div>{info.data.e?.regime === 'accompagnee' ? t('regime_accompagnee') : t('regime_classique')}</div>
          <div><div className="muted small">{t('certificat_apprentissage')}</div>{info.data.e?.certificat_numero ?? t('non_renseigne')}{info.data.e?.certificat_validite ? ` · ${dateShort(info.data.e.certificat_validite, lang)}` : ''}</div>
          {info.data.a && <div><div className="muted small">{t('accompagnateur')}</div>{info.data.a.prenom} {info.data.a.nom} · {info.data.a.telephone}</div>}
        </div>
      ) : <Loading error={info.error} />)}
      {!b.demo && (
        <div className="card stack">
          <Field label={t('changer_mdp')}><input className="input" type="password" autoComplete="new-password" minLength={8} value={pw} onChange={e => setPw(e.target.value)} placeholder={t('nouveau_mdp')} /></Field>
          <button className="btn secondary" disabled={busy || pw.length < 8} onClick={() => run(async () => { await b.updatePassword(pw); setPw(''); }, t('mdp_modifie'))}>{t('enregistrer')}</button>
        </div>
      )}
      <button className="btn ghost block" onClick={() => b.signOut()}>{t('deconnexion')}</button>
    </div>
  );
}

export function SetPassword({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { run, busy } = useAction();
  const [pw, setPw] = useState('');
  return (
    <div className="login"><form className="login-box stack" onSubmit={e => { e.preventDefault(); run(async () => { await backend().updatePassword(pw); onDone(); }, t('mdp_modifie')); }}>
      <img src="./logo.svg?v=2" alt="" />
      <h1 className="center">{t('choisir_mdp')}</h1>
      <Field label={t('nouveau_mdp')}><input className="input" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={e => setPw(e.target.value)} /></Field>
      <button className="btn block" disabled={busy || pw.length < 8}>{t('enregistrer')}</button>
    </form></div>
  );
}
