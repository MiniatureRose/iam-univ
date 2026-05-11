import { logout } from '../../services/api';

const IC = ({ d, ...p }) => (
  <svg {...p} viewBox="0 0 20 20" fill="currentColor" dangerouslySetInnerHTML={{ __html: d }} />
);

const ROLE_LABELS = { ADMIN: 'Administrateur', CONFIGURATOR: 'Configurateur', USER: 'Utilisateur' };

export default function Sidebar({ currentUser, appConfig, navItems, tab, selectedId, setTab }) {
  const initials = `${currentUser.firstName?.[0] || ''}${currentUser.lastName?.[0] || ''}`.toUpperCase();
  const roleLabel = ROLE_LABELS[currentUser.appRole] || 'Utilisateur';

  return (
    <aside className="side">
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
            onClick={() => setTab(n.key)}
          >
            <IC d={n.icon} />
            {n.label}
            {n.count != null && <span className="side-badge">{n.count}</span>}
          </div>
        ))}
      </nav>

      <div className="side-foot" onClick={logout} title="Se déconnecter" style={{ cursor: 'pointer' }}>
        <div className="side-foot-av">{initials}</div>
        <div>
          <div className="side-foot-name">{currentUser.firstName} {currentUser.lastName}</div>
          <div className="side-foot-role">{roleLabel} · Se déconnecter</div>
        </div>
      </div>
    </aside>
  );
}
