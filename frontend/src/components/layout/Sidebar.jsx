import { logout } from '../../services/api';
import { getInitials } from '../../utils';

const IC = ({ d, ...p }) => (
  <svg {...p} viewBox="0 0 20 20" fill="currentColor" dangerouslySetInnerHTML={{ __html: d }} />
);

const ROLE_LABELS = { ADMIN: 'Administrateur', CONFIGURATOR: 'Configurateur', USER: 'Utilisateur' };

export default function Sidebar({ currentUser, appConfig, navItems, tab, selectedId, setTab, mobileOpen, setMobileOpen }) {
  const initials = getInitials(currentUser.firstName, currentUser.lastName);
  const roleLabel = ROLE_LABELS[currentUser.appRole] || 'Utilisateur';

  const handleNav = (key) => {
    setTab(key);
    setMobileOpen?.(false);
  };

  return (
    <>
      {mobileOpen && <div className="side-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`side ${mobileOpen ? 'open' : ''}`}>
        <div className="side-brand">
          <div className="side-logo">{appConfig.universityShortName?.[0]}</div>
          <div>
            <div className="side-name">{appConfig.appName}</div>
            <div className="side-sub">{appConfig.universityName}</div>
          </div>
        </div>

        <div className="side-label">Navigation</div>
        <nav className="side-nav">
          {navItems.map(n => (
            <div
              key={n.key}
              className={`side-link ${tab === n.key && !selectedId ? 'on' : ''}`}
              onClick={() => handleNav(n.key)}
            >
              <IC d={n.icon} />
              {n.label}
              {n.count != null && <span className="side-badge">{n.count}</span>}
            </div>
          ))}
        </nav>

        <div className="side-foot" style={{ marginTop: 'auto', cursor: 'default' }}>
          <div className="side-foot-av">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="side-foot-name truncate">{currentUser.firstName} {currentUser.lastName}</div>
            <div className="side-foot-role">{roleLabel}</div>
          </div>
        </div>
        <div style={{ padding: '0 0.375rem 0.625rem' }}>
          <button className="side-logout" onClick={logout}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Se déconnecter
          </button>
        </div>
      </aside>
    </>
  );
}
