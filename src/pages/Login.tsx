import { useState } from 'react';
import { backend } from '../lib/backend';
import { LANGS, errorText, useI18n } from '../lib/i18n';
import { Field } from '../components/ui';
import { LegalFooter } from './Legal';

export function Login() {
  const { t, lang, setLang } = useI18n();
  const b = backend();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (e?: React.FormEvent, mail?: string) => {
    e?.preventDefault();
    setBusy(true); setMsg(null);
    try { await b.signIn(mail ?? email, pw); }
    catch (err) { setMsg({ text: errorText(t, err), bad: true }); }
    finally { setBusy(false); }
  };
  const forgot = async () => {
    if (!email) { setMsg({ text: t('email') + ' ?', bad: true }); return; }
    try { await b.resetPassword(email); } catch { /* same message either way */ }
    setMsg({ text: t('mdp_envoye') });
  };

  return (
    <div className="login">
      <div className="login-box">
        <img src="./logo.svg?v=2" alt="Auto École Lisboa" />
        <div className="chips" style={{ justifyContent: 'center', marginBottom: 24 }}>
          {LANGS.map(l => <button key={l.code} className={'chip' + (l.code === lang ? ' on' : '')} onClick={() => setLang(l.code)}>{l.code.toUpperCase()}</button>)}
        </div>
        {b.demo ? (
          <div className="stack">
            <h1 className="center">LuxDrive</h1>
            <p className="muted center">{t('demo_choisir')}</p>
            <div className="list">
              {b.demoAccounts!.map(a => (
                <button key={a.email} className="item" disabled={busy} onClick={() => signIn(undefined, a.email)}>
                  <span className="grow">{a.label}</span><span className="muted">›</span>
                </button>
              ))}
            </div>
            <p className="muted small center">{t('demo_info')}</p>
            {msg && <div className={'alert' + (msg.bad ? ' bad' : '')}>{msg.text}</div>}
          </div>
        ) : (
          <form className="stack" onSubmit={signIn}>
            <h1 className="center">{t('connexion')}</h1>
            <Field label={t('email')}><input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field label={t('mot_de_passe')}><input className="input" type="password" autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} /></Field>
            {msg && <div className={'alert' + (msg.bad ? ' bad' : '')}>{msg.text}</div>}
            <button className="btn block" disabled={busy}>{t('se_connecter')}</button>
            <button type="button" className="btn ghost block" onClick={forgot}>{t('mdp_oublie')}</button>
          </form>
        )}
        <LegalFooter />
      </div>
    </div>
  );
}
