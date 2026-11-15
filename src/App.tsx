import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout, type NavItem } from './components/Layout';
import { backend } from './lib/backend';
import { useI18n } from './lib/i18n';
import { isBureau, useSession } from './lib/session';
import { Login } from './pages/Login';
import { LegalPage, type LegalKind } from './pages/Legal';
import { useParams, Link } from 'react-router-dom';
import { Profil, SetPassword } from './pages/Profil';
import { EleveAccueil } from './pages/eleve/Accueil';
import { Reserver } from './pages/eleve/Reserver';
import { MesLecons } from './pages/eleve/MesLecons';
import { Paiements } from './pages/eleve/Paiements';
import { MoniteurJour } from './pages/moniteur/Jour';
import { LeconMoniteur } from './pages/moniteur/Lecon';
import { Theorie } from './pages/moniteur/Theorie';
import { BureauAccueil } from './pages/bureau/Accueil';
import { Agenda } from './pages/bureau/Agenda';
import { Eleves } from './pages/bureau/Eleves';
import { FicheEleve } from './pages/bureau/FicheEleve';
import { Factures } from './pages/bureau/Factures';
import { Justificatifs } from './pages/bureau/Justificatifs';
import { Reglages } from './pages/bureau/Reglages';

export function App() {
  const { state } = useSession();
  const { t } = useI18n();
  const [, setTick] = useState(0);

  if (state.status === 'loading') return <div className="login"><p className="muted">{t('chargement')}</p></div>;
  if (state.status === 'error')
    return <div className="login"><div className="login-box center"><img src="./logo.svg?v=2" alt="" style={{ width: 160 }} /><div className="alert bad">{state.message.includes('CONFIG') ? t('config_manquante') : state.message}</div></div></div>;
  if (state.status === 'signedOut')
    return (
      <Routes>
        <Route path="legal/:kind" element={<div className="content"><Link className="btn ghost sm" to="/">‹ {t('retour')}</Link><LegalRoute /></div>} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  if (state.status === 'inactive')
    return (
      <div className="login"><div className="login-box center stack">
        <img src="./logo.svg?v=2" alt="" />
        <div className="alert">{t('compte_inactif')}</div>
        <button className="btn secondary" onClick={() => backend().signOut()}>{t('deconnexion')}</button>
      </div></div>
    );

  if (backend().passwordSetupPending) return <SetPassword onDone={() => setTick(x => x + 1)} />;

  const role = state.profil.role;

  if (role === 'eleve') {
    const nav: NavItem[] = [
      { to: '/', label: t('nav_accueil'), icon: 'home' },
      { to: '/reserver', label: t('nav_reserver'), icon: 'plus' },
      { to: '/lecons', label: t('nav_lecons'), icon: 'list' },
      { to: '/paiements', label: t('nav_paiements'), icon: 'card' },
      { to: '/profil', label: t('nav_profil'), icon: 'user' },
    ];
    return (
      <Routes>
        <Route element={<Layout nav={nav} />}>
          <Route index element={<EleveAccueil />} />
          <Route path="reserver" element={<Reserver />} />
          <Route path="lecons" element={<MesLecons />} />
          <Route path="paiements" element={<Paiements />} />
          <Route path="profil" element={<Profil />} />
          <Route path="legal/:kind" element={<LegalRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  if (role === 'moniteur') {
    const nav: NavItem[] = [
      { to: '/', label: t('nav_journee'), icon: 'calendar' },
      { to: '/theorie', label: t('nav_theorie'), icon: 'book' },
      { to: '/profil', label: t('nav_profil'), icon: 'user' },
    ];
    return (
      <Routes>
        <Route element={<Layout nav={nav} />}>
          <Route index element={<MoniteurJour />} />
          <Route path="lecon/:id" element={<LeconMoniteur />} />
          <Route path="theorie" element={<Theorie />} />
          <Route path="profil" element={<Profil />} />
          <Route path="legal/:kind" element={<LegalRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  if (isBureau(role)) {
    const nav: NavItem[] = [
      { to: '/', label: t('nav_accueil'), icon: 'home' },
      { to: '/agenda', label: t('nav_agenda'), icon: 'calendar' },
      { to: '/eleves', label: t('nav_eleves'), icon: 'users' },
      { to: '/theorie', label: t('nav_theorie'), icon: 'book' },
      { to: '/factures', label: t('nav_factures'), icon: 'file' },
      { to: '/certificats', label: t('nav_justificatifs'), icon: 'check' },
      { to: '/reglages', label: t('nav_reglages'), icon: 'settings' },
    ];
    return (
      <Routes>
        <Route element={<Layout nav={nav} wide />}>
          <Route index element={<BureauAccueil />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="eleves" element={<Eleves />} />
          <Route path="eleves/:id" element={<FicheEleve />} />
          <Route path="theorie" element={<Theorie />} />
          <Route path="factures" element={<Factures />} />
          <Route path="certificats" element={<Justificatifs />} />
          <Route path="reglages" element={<Reglages />} />
          <Route path="profil" element={<Profil />} />
          <Route path="legal/:kind" element={<LegalRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }
  return null;
}

function LegalRoute() {
  const { kind } = useParams();
  const k: LegalKind = kind === 'conditions' || kind === 'confidentialite' ? kind : 'mentions';
  return <LegalPage kind={k} />;
}
