import React, { useState, useEffect } from 'react';
import { fetchIdentities, updateAppRole, fetchGroups, addGroupConfigurator, fetchStats } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import SearchSelect from '../components/business/SearchSelect';
import IdentityList from '../components/business/IdentityList';
import StatusPage from './StatusPage';
import AuditPage from './AuditPage';
import { getColor, getInitials } from '../utils';

const ROLE_META = {
  ADMIN:        { tag: 'tag-red',    label: 'Administrateur', desc: 'Accès complet au système' },
  CONFIGURATOR: { tag: 'tag-purple', label: 'Configurateur',  desc: 'Gestionnaire de groupes' },
  USER:         { tag: 'tag-gray',   label: 'Utilisateur',    desc: 'Accès standard en lecture' },
};

const ROLE_ORDER = ['ADMIN', 'CONFIGURATOR', 'USER'];

export default function AdminPage({ currentUser, onSelectIdentity }) {
  const [activeTab, setActiveTab] = useState('annuaire');
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPromote, setShowPromote] = useState(false);
  const [selectedRole, setSelectedRole] = useState('CONFIGURATOR');
  const [selectedIdentityId, setSelectedIdentityId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [expandedConfigId, setExpandedConfigId] = useState(null);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [ids, grps, st] = await Promise.all([fetchIdentities(['ADMIN','CONFIGURATOR']), fetchGroups(), fetchStats()]);
      setIdentities(ids || []);
      setGroups(grps || []);
      setStats(st || null);
    } catch { toast('Erreur de chargement', 'err'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const admins = identities.filter(i => i.appRole === 'ADMIN');
  const configurators = identities.filter(i => i.appRole === 'CONFIGURATOR');

  // Map identityId → [group names] built from group.configurators
  const configuratorGroups = {};
  groups.forEach(g => {
    (g.configurators || []).forEach(c => {
      if (!configuratorGroups[c.id]) configuratorGroups[c.id] = [];
      configuratorGroups[c.id].push(g.name);
    });
  });

  const handleRoleChange = async (identity, newRole) => {
    if (identity.id === currentUser?.id) { toast('Vous ne pouvez pas modifier votre propre rôle.', 'err'); return; }
    try { await updateAppRole(identity.id, newRole); toast(`${identity.firstName} ${identity.lastName} → ${ROLE_META[newRole].label}`); load(); }
    catch (err) { toast(err.message || 'Erreur', 'err'); }
  };

  const handlePromote = async (e) => {
    e.preventDefault();
    if (!selectedIdentityId) return;
    try {
      if (selectedRole === 'CONFIGURATOR') {
        if (!selectedGroupId) { toast('Veuillez sélectionner un groupe', 'err'); return; }
        await addGroupConfigurator(selectedGroupId, selectedIdentityId);
        toast('Configurateur ajouté avec succès');
      } else {
        await updateAppRole(selectedIdentityId, selectedRole);
        toast('Promotion effectuée avec succès');
      }
      setShowPromote(false); setSelectedIdentityId(''); setSelectedGroupId('');
      load();
    } catch (err) { toast(err.message || 'Erreur', 'err'); }
  };

  const renderTable = (usersList, roleType) => {
    const isConfigurator = roleType === 'CONFIGURATOR';
    return (
    <div className="card tbl" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div style={{
        padding:'1rem 1.25rem', background:'var(--bg-hover)', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:'0.875rem',
        borderLeft: `3px solid ${roleType==='ADMIN' ? 'var(--red)' : 'var(--purple)'}`,
      }}>
        <div style={{
          width:36, height:36, borderRadius:8, flexShrink:0,
          background: roleType==='ADMIN' ? '#fef2f2' : '#ede9fe',
          color: roleType==='ADMIN' ? 'var(--red)' : 'var(--purple)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem',
        }}>
          {roleType==='ADMIN' ? '⚡' : '⚙️'}
        </div>
        <div style={{flex:1}}>
          <div style={{ fontWeight:700, fontSize:'0.9375rem' }}>{roleType==='ADMIN' ? 'Administrateurs système' : 'Configurateurs de groupes'}</div>
          <div className="xs muted">{ROLE_META[roleType].desc}</div>
        </div>
        <span className={`tag ${roleType==='ADMIN' ? 'tag-red' : 'tag-purple'}`}>{usersList.length}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>E-mail</th>
            <th>Rôle système</th>
            <th style={{textAlign:'right', width:100}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {usersList.length === 0 ? (
            <tr><td colSpan={4} style={{textAlign:'center', padding:'2rem', color:'var(--text-muted)'}}>Aucun utilisateur avec ce rôle.</td></tr>
          ) : usersList.map(u => {
            const groups = configuratorGroups[u.id] || [];
            const isExpanded = expandedConfigId === u.id;
            return (
              <React.Fragment key={u.id}>
                <tr>
                  <td>
                    <div className="row gap-sm" style={{alignItems:'center'}}>
                      <div className="avatar" style={{width:34, height:34, background:getColor(u.firstName+u.lastName), color:'white', fontSize:'0.75rem', flexShrink:0}}>{getInitials(u.firstName, u.lastName)}</div>
                      <div>
                        <div style={{fontWeight:500}}>{u.firstName} {u.lastName}</div>
                        {isConfigurator && (
                          <div className="xs muted">{groups.length} groupe{groups.length !== 1 ? 's' : ''}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="muted sm">{u.primaryEmail}</td>
                  <td>
                    <select
                      style={{width:'auto', background:'transparent', border:'1px solid var(--border)', fontWeight:500, borderRadius:'4px', padding:'0.2rem 0.5rem'}}
                      value={u.appRole}
                      onChange={e => handleRoleChange(u, e.target.value)}
                      disabled={u.id === currentUser?.id}
                    >
                      {ROLE_ORDER.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                    </select>
                  </td>
                  <td style={{textAlign:'right'}}>
                    <div className="row end gap-xs">
                      {isConfigurator && groups.length > 0 && (
                        <button
                          className="btn-icon btn-sm"
                          title="Voir les groupes gérés"
                          onClick={() => setExpandedConfigId(isExpanded ? null : u.id)}
                          style={{ color: isExpanded ? 'var(--purple)' : 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                        >
                          <svg style={{width:16}} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                        </button>
                      )}
                      <button className="btn-icon btn-sm" onClick={() => onSelectIdentity(u.id)} title="Voir le profil">
                        <svg style={{width:16}} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                      {u.id !== currentUser?.id && (
                        <button className="btn-icon btn-sm" style={{color:'var(--red)'}} onClick={() => handleRoleChange(u,'USER')} title="Retirer les privilèges">
                          <svg style={{width:16}} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12H15"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isConfigurator && isExpanded && (
                  <tr key={u.id + '-groups'}>
                    <td colSpan={4} style={{ padding: '0.75rem 1.25rem 0.875rem 4rem', background: '#faf5ff', borderTop: '1px solid #e9d5ff' }}>
                      <div className="xs muted" style={{ marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Groupes gérés</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {groups.map(g => (
                          <span key={g} className="tag tag-purple" style={{ fontSize: '0.8125rem' }}>{g}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  };

  const TABS = [
    { key: 'annuaire',    label: 'Annuaire des personnels' },
    { key: 'promotions',  label: 'Privilèges & Promotions' },
    { key: 'status',      label: 'Statuts' },
    { key: 'audit',       label: 'Journal d\'audit' },
  ];

  return (
    <div className="fade-in">

      {/* En-tête avec stats globales — toujours visible */}
      <div className="page-top">
        <div>
          <h1>Administration centrale</h1>
          <p className="sub sm">Annuaire, privilèges et référentiels du système</p>
        </div>
      </div>

      {stats && (
        <div className="stats" style={{marginBottom:'1.5rem'}}>
          {[
            { ic:'👤', val:stats.identities, lbl:'Identités',   bg:'#dbeafe', col:'#1e40af', accent:'#2563eb' },
            { ic:'🔑', val:stats.roles,      lbl:'Rôles',       bg:'#ede9fe', col:'#6d28d9', accent:'#7c3aed' },
            { ic:'🏢', val:stats.groups,     lbl:'Groupes',     bg:'#d1fae5', col:'#065f46', accent:'#059669' },
            { ic:'📋', val:stats.statuses,   lbl:'Statuts',     bg:'#fef3c7', col:'#92400e', accent:'#d97706' },
          ].map(s => (
            <div key={s.lbl} className="stat card" style={{'--stat-accent': s.accent}}>
              <div className="stat-ic" style={{background:s.bg, color:s.col}}>{s.ic}</div>
              <div><div className="stat-val">{s.val}</div><div className="stat-lbl">{s.lbl}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation par onglets */}
      <div className="tabs">
        {TABS.map(t => (
          <div key={t.key} className={`tab ${activeTab===t.key?'on':''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Annuaire — hideHeader=true masque aussi les stats dans IdentityList */}
      {activeTab === 'annuaire' && (
        <IdentityList currentUser={currentUser} onSelect={onSelectIdentity} hideHeader={true} />
      )}

      {activeTab === 'status' && <StatusPage hideHeader={true} />}

      {activeTab === 'audit' && <AuditPage />}

      {activeTab === 'promotions' && (
        <div>
          <div className="row end" style={{marginBottom:'1.25rem'}}>
            <button className="btn btn-blue" onClick={() => setShowPromote(true)}>+ Promouvoir un utilisateur</button>
          </div>
          {loading ? (
            <div className="center" style={{padding:'3rem'}}><div className="detail-spinner" /></div>
          ) : (
            <>{renderTable(admins, 'ADMIN')}{renderTable(configurators, 'CONFIGURATOR')}</>
          )}
        </div>
      )}

      {/* Modal promotion */}
      {showPromote && (
        <div style={{position:'fixed',inset:0,background:'var(--bg-overlay)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div className="card slide-up" style={{width:'100%',maxWidth:500,padding:'2rem',boxShadow:'var(--shadow-xl)'}}>
            <div style={{marginBottom:'1.5rem'}}>
              <h2 style={{marginBottom:'0.25rem'}}>Promouvoir un utilisateur</h2>
              <p className="sm muted">Attribuez un rôle système élevé à un membre de l'annuaire.</p>
            </div>
            <form onSubmit={handlePromote} className="col gap-md">
              <div className="field">
                <span className="label">Utilisateur à promouvoir</span>
                <SearchSelect placeholder="Rechercher par nom…" value={selectedIdentityId} onChange={setSelectedIdentityId} />
              </div>
              <div className="field">
                <span className="label">Nouveau rôle système</span>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
                  {['ADMIN','CONFIGURATOR'].map(r => {
                    const isSelected = selectedRole === r;
                    const isAdmin = r === 'ADMIN';
                    return (
                    <label key={r} style={{
                      padding:'1rem', cursor:'pointer', borderRadius:'var(--radius-lg)',
                      border: isSelected ? `2px solid ${isAdmin?'var(--red)':'var(--purple)'}` : '2px solid var(--border)',
                      background: isSelected ? (isAdmin?'#fef2f2':'#faf5ff') : 'var(--bg-hover)',
                      transition:'all 0.15s', display:'flex', gap:'0.75rem', alignItems:'flex-start',
                    }}>
                      <input type="radio" name="role" value={r} checked={isSelected} onChange={e=>setSelectedRole(e.target.value)} style={{display:'none'}} />
                      <div style={{
                        width:32, height:32, borderRadius:8, flexShrink:0, marginTop:1,
                        background: isAdmin ? '#fef2f2' : '#ede9fe',
                        color: isAdmin ? 'var(--red)' : 'var(--purple)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.875rem',
                      }}>
                        {isAdmin ? '⚡' : '⚙️'}
                      </div>
                      <div>
                        <div style={{fontWeight:700, fontSize:'0.875rem', color: isAdmin?'var(--red)':'var(--purple)', marginBottom:'0.25rem'}}>
                          {isAdmin?'Administrateur':'Configurateur'}
                        </div>
                        <div className="xs muted">{ROLE_META[r].desc}</div>
                      </div>
                    </label>
                    );
                  })}
                </div>
              </div>
              {selectedRole === 'CONFIGURATOR' && (
                <div className="field slide-up">
                  <span className="label">Affecter au groupe</span>
                  <select required value={selectedGroupId} onChange={e=>setSelectedGroupId(e.target.value)}>
                    <option value="">— Choisir un groupe —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <div className="row end gap-sm" style={{marginTop:'0.5rem'}}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPromote(false)}>Annuler</button>
                <button type="submit" className="btn btn-blue">Confirmer la promotion</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
