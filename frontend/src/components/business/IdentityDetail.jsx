import { useState, useEffect } from 'react';
import { fetchTimeline, fetchStatuses, assignStatus, terminateAssignment } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../ui/ConfirmModal';
import { getColor, isActive, fmtDate as fmt } from '../../utils';
import { IconMail, IconPhone, IconCopy, IconClock, IconUniv } from '../ui/Icons';

export default function IdentityDetail({ currentUser, identityId, onBack, appConfig, fromLabel = 'Annuaire' }) {
  const [tl, setTl] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [newStatusId, setNewStatusId] = useState('');
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => { loadAll(); }, [identityId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        fetchTimeline(identityId).catch(() => null),
        fetchStatuses().catch(() => []),
      ]);
      setTl(t);
      setStatuses(s);
    } finally { setLoading(false); }
  };

  const identity = tl?.identity;
  const assignments = tl?.roles || [];

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    try {
      await assignStatus(identityId, newStatusId);
      toast('Statut modifié avec succès');
      setShowStatusForm(false);
      setNewStatusId('');
      loadAll();
    } catch (err) { toast(err.message || 'Erreur lors de la modification', 'err'); }
  };

  const handleTerminate = async (assignmentId) => {
    if (!await confirm('Clôturer ce rôle à la date d\'aujourd\'hui ?')) return;
    try { await terminateAssignment('role', assignmentId); toast('Rôle clôturé'); loadAll(); }
    catch { toast('Erreur lors de la clôture', 'err'); }
  };

  const copyEmail = (email) => {
    navigator.clipboard.writeText(email).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  if (loading) return (
    <div className="center" style={{height:'80vh'}}>
      <div className="col center gap-md"><div className="detail-spinner" /><p className="muted sm">Chargement du dossier…</p></div>
    </div>
  );

  if (!identity) return (
    <div className="center" style={{padding:'4rem'}}>
      <div className="card" style={{padding:'2.5rem', textAlign:'center', maxWidth:380}}>
        <p style={{fontSize:'3rem', marginBottom:'0.5rem'}}>🕵️</p>
        <h2 style={{marginBottom:'0.5rem'}}>Dossier introuvable</h2>
        <p className="muted sm" style={{marginBottom:'1rem'}}>Cette identité n'existe pas ou a été supprimée.</p>
        <button className="btn btn-dark" onClick={onBack}>Retour au registre</button>
      </div>
    </div>
  );

  const activeAssignments = assignments.filter(a => isActive(a)).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const pastAssignments = assignments.filter(a => !isActive(a)).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const avatarColor = getColor(identity.firstName + identity.lastName);
  const groupCount = [...new Set(activeAssignments.map(a => a.role?.group?.id))].filter(Boolean).length;

  return (
    <div className="detail-page fade-in" style={{paddingBottom:'3rem'}}>

      <nav className="breadcrumb">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{opacity:0.5}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        <button className="breadcrumb-link" onClick={onBack}>{fromLabel}</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{identity.firstName} {identity.lastName}</span>
      </nav>

      {/* Carte profil compacte */}
      <div className="profile-card">
        <div className="profile-card-avatar" style={{background: avatarColor}}>
          {identity.firstName?.[0]}{identity.lastName?.[0]}
        </div>
        <div className="profile-card-info">
          <div className="profile-card-name">{identity.firstName} {identity.lastName}</div>
          <div className="profile-card-meta">
            <IconMail />
            <span>{identity.primaryEmail}</span>
            <button className="profile-card-copy" onClick={() => copyEmail(identity.primaryEmail)} title="Copier l'adresse">
              {copied ? '✓' : <IconCopy />}
            </button>
            {identity.phone && <><span style={{opacity:0.4}}>·</span><IconPhone /><span>{identity.phone}</span></>}
          </div>
          <div className="profile-card-sub">
            {identity.status && <span className="tag tag-gold">{identity.status.name}</span>}
            <span className={`tag ${identity.appRole === 'ADMIN' ? 'tag-red' : identity.appRole === 'CONFIGURATOR' ? 'tag-purple' : 'tag-gray'}`}>
              {identity.appRole === 'ADMIN' ? 'Administrateur' : identity.appRole === 'CONFIGURATOR' ? 'Configurateur' : 'Utilisateur'}
            </span>
            <span className="muted xs" style={{marginLeft:'0.25rem'}}>
              · {activeAssignments.length} rôle{activeAssignments.length !== 1 ? 's' : ''} actif{activeAssignments.length !== 1 ? 's' : ''} · {groupCount} groupe{groupCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="profile-card-side">
          {currentUser?.appRole === 'ADMIN' && (
            <button className="btn btn-sm btn-outline" onClick={() => setShowStatusForm(!showStatusForm)}>
              {showStatusForm ? 'Annuler' : '✏️ Statut'}
            </button>
          )}
          <div className="profile-card-org"><IconUniv /> {appConfig?.universityName || 'Université'}</div>
        </div>
      </div>

      {/* Formulaire changement de statut */}
      {showStatusForm && (
        <form onSubmit={handleStatusSubmit} className="card scale-in" style={{padding:'1rem', marginBottom:'1.25rem', borderLeft:'3px solid var(--blue-500)'}}>
          <div style={{fontWeight:600, fontSize:'0.875rem', marginBottom:'0.625rem', color:'var(--blue)'}}>Changer le statut contractuel</div>
          <div className="row gap-sm">
            <select style={{flex:1}} value={newStatusId} onChange={e => setNewStatusId(e.target.value)}>
              <option value="">— Aucun statut —</option>
              {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="submit" className="btn btn-blue">Enregistrer</button>
          </div>
        </form>
      )}

      {/* Grille des rôles */}
      <div className="detail-grid">
        {/* Rôles actifs */}
        <div className="card detail-sec">
          <div className="detail-sec-head">
            <div className="detail-sec-icon" style={{background:'var(--green-100)', color:'var(--green)'}}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <div className="detail-sec-title">Rôles actifs</div>
              <div className="detail-sec-count">{activeAssignments.length} affectation{activeAssignments.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="detail-sec-body">
            {activeAssignments.length === 0 ? (
              <div className="tl-empty">Aucun rôle actif pour le moment.</div>
            ) : (
              <div className="tl">
                {activeAssignments.map(a => (
                  <div key={a.id} className="tl-item">
                    <div className="tl-dot tl-dot-on" />
                    <div className="tl-name">
                      {a.role?.name}
                      <span className="muted xs" style={{fontWeight:400}}> · {a.role?.group?.name || 'Sans groupe'}</span>
                    </div>
                    <div className="tl-dates">Depuis {fmt(a.startDate)}</div>
                    {currentUser?.appRole === 'ADMIN' && (
                      <button className="btn btn-outline btn-sm" style={{fontSize:'0.6875rem', padding:'0.125rem 0.5rem', flexShrink:0}} onClick={() => handleTerminate(a.id)}>
                        Clôturer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Historique */}
        <div className="card detail-sec">
          <div className="detail-sec-head">
            <div className="detail-sec-icon" style={{background:'#f3f4f6', color:'var(--text-muted)'}}>
              <IconClock />
            </div>
            <div>
              <div className="detail-sec-title">Historique des affectations</div>
              <div className="detail-sec-count">{pastAssignments.length} terminée{pastAssignments.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="detail-sec-body">
            {pastAssignments.length === 0 ? (
              <div className="tl-empty">Aucune affectation passée.</div>
            ) : (
              <div className="tl">
                {pastAssignments.map(a => (
                  <div key={a.id} className="tl-item">
                    <div className="tl-dot tl-dot-off" />
                    <div className="tl-name">
                      {a.role?.name}
                      <span className="muted xs" style={{fontWeight:400}}> · {a.role?.group?.name}</span>
                    </div>
                    <div className="tl-dates">{fmt(a.startDate)} → {fmt(a.endDate)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
