import { Link, NavLink, Outlet } from 'react-router-dom';
import { backend } from '../lib/backend';
import { useI18n } from '../lib/i18n';
import { useMe, useSession } from '../lib/session';
import { Icon } from './ui';
import { LegalFooter } from '../pages/Legal';

export type NavItem = { to: string; label: string; icon: string };

export function Layout({ nav, wide }: { nav: NavItem[]; wide?: boolean }) {
  const { t } = useI18n();
  const { demo } = useSession();
  const me = useMe();
  return (
    <div className="app">
      {demo && (
        <div className="demo-bar no-print">
          <div className="topbar-in">
            <span className="grow">{t('mode_demo')} · {me.profil.prenom} {me.profil.nom}</span>
            <button onClick={() => backend().signOut()}>{t('changer_compte')}</button>
            <button onClick={() => backend().reset?.()}>{t('reinitialiser_demo')}</button>
          </div>
        </div>
      )}
      <header className="topbar no-print">
        <div className="topbar-in">
          <img src="./logo.svg?v=2" alt="Auto École Lisboa" />
          <div className="grow">
            <div className="brand-name">LuxDrive</div>
          </div>
          <Link to="/profil" className="btn ghost sm" aria-label={t('mon_profil')}><Icon name="user" size={18} /> {me.profil.prenom}</Link>
        </div>
      </header>
      <main className={'content' + (wide ? ' wide' : '')}>
        <Outlet />
        <LegalFooter />
      </main>
      <nav className="bottomnav no-print" aria-label="Navigation">
        <div className="bottomnav-in">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to.split('/').length <= 2} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
