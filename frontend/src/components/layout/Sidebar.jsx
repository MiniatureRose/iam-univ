import { logout } from '../../services/api';

const IC = ({ d, ...p }) => (
  <svg {...p} viewBox="0 0 20 20" fill="currentColor" dangerouslySetInnerHTML={{ __html: d }} />
);

const ROLE_LABELS = { ADMIN: 'Administrateur', CONFIGURATOR: 'Configurateur' };

export default function Sidebar({ currentUser, appConfig, navItems, tab, selectedId, setTab, mobileOpen, setMobileOpen }) {
  const roleLabel = ROLE_LABELS[currentUser.appRole] || null;

  const handleNav = (key) => {
    setTab(key);
    setMobileOpen?.(false);
  };

  return (
    <>
      {mobileOpen && <div className="side-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`side ${mobileOpen ? 'open' : ''}`}>
        <div className="side-brand">
          <div className="side-logo">
            <img src="/spn-logo.png" alt="Sorbonne Paris Nord" style={{width:'100%',height:'100%',objectFit:'contain'}}
              onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }}
            />
            <span style={{display:'none',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'1rem',color:'var(--text)'}}>
              {appConfig.universityShortName}
            </span>
          </div>
          <div className="side-name">{appConfig.appName}</div>
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

      </aside>
    </>
  );
}
