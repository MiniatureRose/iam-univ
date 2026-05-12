import IdentityList from '../business/IdentityList';
import IdentityDetail from '../business/IdentityDetail';
import GroupsPage from '../../pages/GroupsPage';
import AdminPage from '../../pages/AdminPage';
import UserPortal from '../../pages/UserPortal';

const FROM_LABELS = {
  identities: 'Annuaire',
  admin:      'Administration',
  groups:     'Groupes',
  portal:     'Mon Profil',
};

export default function PageContent({ tab, selectedId, setSelectedId, currentUser, appConfig, fromTab }) {
  const isAdmin = currentUser?.appRole === 'ADMIN';

  if (selectedId) {
    return (
      <IdentityDetail
        identityId={selectedId}
        currentUser={currentUser}
        appConfig={appConfig}
        fromLabel={FROM_LABELS[fromTab] || 'Retour'}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  if (tab === 'identities') return <IdentityList currentUser={currentUser} onSelect={setSelectedId} />;
  if (tab === 'portal')     return <UserPortal currentUser={currentUser} appConfig={appConfig} />;
  if (tab === 'groups')     return <GroupsPage currentUser={currentUser} onSelectIdentity={setSelectedId} />;
  if (tab === 'admin' && isAdmin) {
    return <AdminPage currentUser={currentUser} onSelectIdentity={setSelectedId} />;
  }

  return (
    <div className="soon card">
      <div className="soon-ic">⚡</div>
      <h2>Section indisponible</h2>
      <p className="sub sm" style={{ maxWidth: 380 }}>
        Vous n'avez pas les permissions requises pour accéder à cette section.
      </p>
    </div>
  );
}
