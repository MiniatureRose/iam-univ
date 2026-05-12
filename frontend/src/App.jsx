import { useState, useEffect } from 'react';
import Login from './pages/Login';
import ChangePasswordPage from './pages/ChangePasswordPage';
import Sidebar from './components/layout/Sidebar';
import PageContent from './components/layout/PageContent';
import { ConfirmProvider } from './components/ui/ConfirmModal';
import { ToastProvider } from './contexts/ToastContext';
import { fetchStats, fetchAuthMe, fetchAppConfig } from './services/api';

export { useToast } from './contexts/ToastContext';

const icons = {
  users:  '<path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.43a7.005 7.005 0 0110.77 0A1 1 0 0111.5 18H2.5a1 1 0 01-.885-1.57zM14.5 11c-.725 0-1.41.162-2.024.453A6.969 6.969 0 0114.849 16H17.5a1 1 0 00.885-1.57A4.983 4.983 0 0014.5 11z"/>',
  groups: '<path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/>',
  user:   '<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>',
  admin:  '<path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>',
  audit:  '<path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 5a1 1 0 011-1h6a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 010 2H4a1 1 0 01-1-1zm10-1a1 1 0 00-1 1v3a1 1 0 002 0v-3a1 1 0 00-1-1zm-2 2a1 1 0 112 0 1 1 0 01-2 0z" clip-rule="evenodd"/>',
};

const DEFAULT_CONFIG = { universityName: 'Université', universityShortName: 'U', appName: 'IAM' };

function buildNavItems(role, counts) {
  if (role === 'ADMIN') return [
    { key: 'admin',      label: 'Administration',   icon: icons.admin,  count: null },
    { key: 'groups',     label: 'Groupes et Rôles', icon: icons.groups, count: counts.g },
    { key: 'portal',     label: 'Mon Profil',        icon: icons.user,   count: null },
  ];
  if (role === 'CONFIGURATOR') return [
    { key: 'groups',     label: 'Mes Groupes', icon: icons.groups, count: null },
    { key: 'identities', label: 'Annuaire',     icon: icons.users,  count: counts.i },
    { key: 'portal',     label: 'Mon Profil',   icon: icons.user,   count: null },
  ];
  return [
    { key: 'portal',     label: 'Mon Profil', icon: icons.user,  count: null },
    { key: 'identities', label: 'Annuaire',    icon: icons.users, count: counts.i },
  ];
}

const DEFAULT_TAB = { ADMIN: 'admin', CONFIGURATOR: 'groups', USER: 'portal' };

export default function App() {
  const [currentUser, setCurrentUser]   = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [appConfig, setAppConfig]       = useState(DEFAULT_CONFIG);
  const [tab, setTab]                   = useState('portal');
  const [selectedId, setSelectedId]     = useState(null);
  const [counts, setCounts]             = useState({ i: 0, g: 0 });
  const [mobileOpen, setMobileOpen]     = useState(false);

  useEffect(() => {
    const init = async () => {
      const [cfg] = await Promise.allSettled([fetchAppConfig()]);
      if (cfg.status === 'fulfilled') setAppConfig(cfg.value);

      try {
        const user = await fetchAuthMe();
        setCurrentUser(user);
        setTab(DEFAULT_TAB[user.appRole] || 'portal');
      } catch { /* not authenticated */ }

      setAuthLoading(false);
    };
    init();
  }, []);

  // Refresh sidebar counts on every tab change (picks up any mutations)
  useEffect(() => {
    if (!currentUser) return;
    fetchStats().then(s => setCounts({ i: s.identities, g: s.groups })).catch(() => {});
  }, [currentUser, tab]);

  const handleTabChange = (newTab) => { setTab(newTab); setSelectedId(null); };

  if (authLoading) return null;

  if (!currentUser) {
    return (
      <ToastProvider>
        <ConfirmProvider>
          <Login onLoginComplete={(user) => { setCurrentUser(user); setTab(DEFAULT_TAB[user.appRole] || 'portal'); }} appConfig={appConfig} />
        </ConfirmProvider>
      </ToastProvider>
    );
  }

  if (currentUser.mustChangePassword) {
    return (
      <ToastProvider>
        <ChangePasswordPage
          currentUser={currentUser}
          appConfig={appConfig}
          onSuccess={() => setCurrentUser({ ...currentUser, mustChangePassword: false })}
        />
      </ToastProvider>
    );
  }

  const navItems = buildNavItems(currentUser.appRole, counts);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="layout">
          <Sidebar
            currentUser={currentUser}
            appConfig={appConfig}
            navItems={navItems}
            tab={tab}
            selectedId={selectedId}
            setTab={handleTabChange}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
          />
          <main className="main">
            <div className="mobile-topbar">
              <button className="hamburger" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
                <span /><span /><span />
              </button>
              <span className="mobile-topbar-brand">{appConfig.appName}</span>
            </div>
            <PageContent
              tab={tab}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              currentUser={currentUser}
              appConfig={appConfig}
              fromTab={tab}
            />
          </main>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
