import { useState, useEffect } from 'react';
import {
  fetchGroups, createGroup, deleteGroup, updateGroup,
  fetchRoles, createRole, deleteRole,
  fetchGroupMembers, assignRole, fetchTimeline,
  fetchGroupConfigurators, addGroupConfigurator, removeGroupConfigurator, fetchMyManagedGroups
} from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmModal';
import SearchSelect from '../components/business/SearchSelect';
import { fmtDate as fmt, getColor, getInitials } from '../utils';

export default function GroupsPage({ currentUser }) {
  const isAdmin = currentUser?.appRole === 'ADMIN';
  const isConfigurator = currentUser?.appRole === 'CONFIGURATOR';
  const canEdit = isAdmin || isConfigurator;

  const [groups, setGroups] = useState([]);
  const [roles, setRoles] = useState([]);
  const [memberSnapshots, setMemberSnapshots] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupConfigurators, setGroupConfigurators] = useState([]);
  const [myManagedGroupIds, setMyManagedGroupIds] = useState(new Set());

  const [tab, setTab] = useState('roles');
  const [groupSearch, setGroupSearch] = useState('');

  // Group form (create/edit)
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', parentId: '' });

  // Role form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });

  // Assignment accordion: stores the roleId currently expanded, or null
  const [expandedRoleId, setExpandedRoleId] = useState(null);
  const [assignForm, setAssignForm] = useState({ identityId: '', startDate: new Date().toISOString().split('T')[0] });

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => { loadBase(); }, []);

  const loadBase = async () => {
    try {
      const [g, r, managedGroups] = await Promise.all([
        fetchGroups(),
        fetchRoles(),
        isConfigurator ? fetchMyManagedGroups() : Promise.resolve([])
      ]);
      setGroups((g || []).filter(x => x.active !== false));
      setRoles((r || []).filter(x => x.active !== false));
      if (isConfigurator) setMyManagedGroupIds(new Set((managedGroups || []).map(mg => mg.id)));
    } catch { toast('Erreur de chargement', 'err'); }
  };

  const loadDetails = async (groupId) => {
    try {
      const [m, c] = await Promise.all([fetchGroupMembers(groupId), fetchGroupConfigurators(groupId)]);
      setGroupMembers(m || []);
      setGroupConfigurators(c || []);
      const timelines = await Promise.all((m || []).map(member => fetchTimeline(member.id).catch(() => null)));
      setMemberSnapshots(timelines.filter(Boolean));
    } catch { toast('Erreur de chargement des détails', 'err'); }
  };

  useEffect(() => {
    if (selectedGroup) { setMemberSnapshots([]); loadDetails(selectedGroup.id); setTab('roles'); setExpandedRoleId(null); }
  }, [selectedGroup?.id]);

  const handleSelectGroup = (g) => {
    setSelectedGroup(g);
    setIsEditingGroup(false);
    setShowRoleForm(false);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await createGroup({ name: groupForm.name, parentId: groupForm.parentId || null, configuratorId: currentUser?.id || null });
      toast('Groupe créé avec succès');
      setShowGroupModal(false);
      setGroupForm({ name: '', parentId: '' });
      loadBase();
    } catch (err) { toast(err.message || 'Erreur de création', 'err'); }
  };

  const handleEditGroup = async (e) => {
    e.preventDefault();
    try {
      const updated = await updateGroup(selectedGroup.id, { name: groupForm.name, parentId: selectedGroup.parentId });
      toast('Groupe renommé');
      setIsEditingGroup(false);
      setSelectedGroup(updated);
      loadBase();
    } catch { toast('Erreur lors du renommage', 'err'); }
  };

  const handleDeleteGroup = async () => {
    if (!await confirm(`Supprimer "${selectedGroup.name}" ? Les rôles seront archivés, l'historique préservé.`)) return;
    try {
      await deleteGroup(selectedGroup.id);
      setSelectedGroup(null);
      loadBase();
    } catch { toast('Erreur de suppression', 'err'); }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      await createRole({ ...roleForm, groupId: selectedGroup.id });
      toast('Rôle créé');
      setShowRoleForm(false);
      setRoleForm({ name: '', description: '' });
      loadBase();
    } catch { toast('Erreur lors de la création du rôle', 'err'); }
  };

  const handleDeleteRole = async (role) => {
    if (!await confirm(`Supprimer le rôle "${role.name}" ? Les affectations actives seront clôturées.`)) return;
    try { await deleteRole(role.id); loadBase(); }
    catch { toast('Erreur', 'err'); }
  };

  const handleAssignRole = async (e) => {
    e.preventDefault();
    try {
      await assignRole(assignForm.identityId, expandedRoleId, assignForm.startDate, null);
      toast('Rôle affecté avec succès');
      setExpandedRoleId(null);
      setAssignForm({ identityId: '', startDate: new Date().toISOString().split('T')[0] });
      loadBase();
      loadDetails(selectedGroup.id);
    } catch (err) { toast(err.message || 'Erreur lors de l\'affectation', 'err'); }
  };

  const handleAddConfigurator = async (identityId) => {
    if (!identityId) return;
    try { await addGroupConfigurator(selectedGroup.id, identityId); toast('Configurateur ajouté'); loadDetails(selectedGroup.id); }
    catch (err) { toast(err.message || 'Erreur lors de l\'ajout', 'err'); }
  };

  const handleRemoveConfigurator = async (identityId) => {
    if (!await confirm('Retirer ce configurateur du groupe ?')) return;
    try { await removeGroupConfigurator(selectedGroup.id, identityId); toast('Configurateur retiré'); loadDetails(selectedGroup.id); }
    catch (err) { toast(err.message || 'Erreur lors du retrait', 'err'); }
  };

  const displayGroups = isConfigurator
    ? groups.filter(g => myManagedGroupIds.has(g.id))
    : groups;

  const filteredGroups = groupSearch.trim()
    ? displayGroups.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
    : displayGroups;

  const buildTree = (list, parentId = null) =>
    list
      .filter(g => parentId === null ? (!g.parentId || !list.some(p => p.id === g.parentId)) : g.parentId === parentId)
      .map(g => ({ ...g, children: buildTree(list, g.id) }));

  const groupTree = buildTree(groupSearch.trim() ? filteredGroups : displayGroups);

  const groupRoles = roles.filter(r => r.group?.id === selectedGroup?.id);
  const roleCount = groupRoles.length;

  const TABS = [
    { key: 'roles',         label: 'Rôles',          count: roleCount },
    { key: 'members',       label: 'Membres',         count: groupMembers.length },
    { key: 'configurators', label: 'Configurateurs',  count: groupConfigurators.length },
  ];

  const renderTree = (nodes, level = 0) => nodes.map(node => {
    const isSelected = selectedGroup?.id === node.id;
    const nodeRoleCount = roles.filter(r => r.group?.id === node.id).length;
    return (
      <div key={node.id}>
        <div
          onClick={() => handleSelectGroup(node)}
          style={{
            padding: `0.4375rem 0.625rem 0.4375rem ${0.5 + level * 1.125}rem`,
            borderRadius: '6px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: isSelected ? 'var(--blue-500)' : 'transparent',
            color: isSelected ? 'white' : 'var(--text)',
            fontWeight: isSelected ? 600 : 400,
            transition: 'all 0.12s',
            position: 'relative',
          }}
          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
        >
          {level > 0 && (
            <div style={{ position: 'absolute', left: `${0.25 + (level - 1) * 1.125}rem`, top: '50%', width: '0.625rem', height: '1px', background: isSelected ? 'rgba(255,255,255,0.3)' : 'var(--border)' }} />
          )}
          <svg style={{ width: 13, height: 13, opacity: isSelected ? 0.9 : 0.45, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="truncate" style={{ fontSize: '0.8125rem', flex: 1 }}>{node.name}</span>
          {nodeRoleCount > 0 && (
            <span style={{ fontSize: '0.625rem', fontWeight: 600, padding: '0.0625rem 0.375rem', borderRadius: '99px', background: isSelected ? 'rgba(255,255,255,0.2)' : '#e2e8f0', color: isSelected ? 'white' : '#64748b', flexShrink: 0 }}>
              {nodeRoleCount}
            </span>
          )}
        </div>
        {node.children?.length > 0 && renderTree(node.children, level + 1)}
      </div>
    );
  });

  return (
    <div className="fade-in groups-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.25rem', height: 'calc(100vh - 4rem)' }}>

      {/* ── Panneau gauche : arborescence ───────────────────── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '1rem 0.875rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
          <div className="row between" style={{ marginBottom: '0.625rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--blue)' }}>
              {isConfigurator ? 'Mes groupes' : 'Groupes'}
            </span>
            {isAdmin && (
              <button className="btn btn-blue btn-sm" onClick={() => { setGroupForm({ name: '', parentId: selectedGroup?.id || '' }); setShowGroupModal(true); }}>
                + Créer
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: 13, color: 'var(--text-muted)' }} fill="none" viewBox="0 0 20 20" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              value={groupSearch}
              onChange={e => setGroupSearch(e.target.value)}
              placeholder="Filtrer les groupes…"
              style={{ width: '100%', paddingLeft: '1.75rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3125rem 0.5rem 0.3125rem 1.75rem', background: 'var(--bg-hover)', outline: 'none' }}
            />
          </div>
        </div>

        {/* Tree */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
          {displayGroups.length === 0 ? (
            <div className="col center muted" style={{ height: 80, gap: '0.375rem', fontSize: '0.8125rem' }}>
              <svg style={{ width: 22, opacity: 0.3 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Aucun groupe disponible
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="center muted" style={{ height: 60, fontSize: '0.8125rem' }}>Aucun résultat</div>
          ) : renderTree(groupTree)}
        </div>

        {/* Footer count */}
        <div style={{ padding: '0.5rem 0.875rem', borderTop: '1px solid var(--border)', fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {displayGroups.length} groupe{displayGroups.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Panneau droit : détail ───────────────────────────── */}
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {!selectedGroup ? (
          <div className="center col" style={{ flex: 1, border: '2px dashed #cbd5e1', borderRadius: 'var(--radius-lg)', color: 'var(--text-sub)', gap: '0.75rem', minHeight: 300 }}>
            <svg style={{ width: 48, color: '#cbd5e1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>Sélectionnez un groupe</p>
              <p className="sm muted">Cliquez sur un groupe dans le panneau de gauche</p>
            </div>
          </div>
        ) : (
          <>
            {/* En-tête du groupe */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', borderLeft: '4px solid var(--gold)' }}>
              {isEditingGroup ? (
                <form onSubmit={handleEditGroup} className="row gap-sm">
                  <input autoFocus required value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                    style={{ flex: 1, fontSize: '1.125rem', fontWeight: 700 }} />
                  <button type="submit" className="btn btn-blue btn-sm">Enregistrer</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsEditingGroup(false)}>Annuler</button>
                </form>
              ) : (
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', marginBottom: '0.375rem' }}>{selectedGroup.name}</h1>
                    <div className="row gap-md" style={{ gap: '1rem' }}>
                      <span className="xs muted"><strong style={{ color: 'var(--text)' }}>{roleCount}</strong> rôle{roleCount !== 1 ? 's' : ''}</span>
                      <span className="xs muted"><strong style={{ color: 'var(--text)' }}>{groupMembers.length}</strong> membre{groupMembers.length !== 1 ? 's' : ''}</span>
                      <span className="xs muted"><strong style={{ color: 'var(--text)' }}>{groupConfigurators.length}</strong> configurateur{groupConfigurators.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="row gap-sm">
                    {canEdit && (
                      <button className="btn btn-outline btn-sm" onClick={() => { setGroupForm({ name: selectedGroup.name, parentId: '' }); setIsEditingGroup(true); }}>
                        Renommer
                      </button>
                    )}
                    {isAdmin && (
                      <button className="btn btn-red btn-sm" onClick={handleDeleteGroup}>Supprimer</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Onglets */}
            <div className="tabs" style={{ marginBottom: 0 }}>
              {TABS.map(t => (
                <div key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => { setTab(t.key); setShowRoleForm(false); setExpandedRoleId(null); }}>
                  {t.label} <span className="tab-count">{t.count}</span>
                </div>
              ))}
            </div>

            {/* ── Onglet Rôles ──────────────────────────────── */}
            {tab === 'roles' && (
              <div className="col gap-sm slide-up">
                {/* Barre d'action */}
                <div className="row between" style={{ marginBottom: '0.25rem' }}>
                  <span className="xs muted">{roleCount} rôle{roleCount !== 1 ? 's' : ''} dans ce groupe</span>
                  {canEdit && (
                    <button className="btn btn-sm btn-blue" onClick={() => { setShowRoleForm(!showRoleForm); setExpandedRoleId(null); }}>
                      {showRoleForm ? 'Annuler' : '+ Nouveau rôle'}
                    </button>
                  )}
                </div>

                {/* Formulaire création de rôle */}
                {showRoleForm && (
                  <form onSubmit={handleCreateRole} className="card slide-up" style={{ padding: '1rem', borderLeft: '3px solid var(--blue-500)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--blue)', marginBottom: '0.75rem' }}>Nouveau rôle</div>
                    <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                      <div className="field">
                        <label className="lbl">Nom du rôle</label>
                        <input required autoFocus value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="ex : Responsable administratif" />
                      </div>
                      <div className="field">
                        <label className="lbl">Description <span className="muted xs">(optionnel)</span></label>
                        <input value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Périmètre, responsabilités…" />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowRoleForm(false)}>Annuler</button>
                      <button type="submit" className="btn btn-blue btn-sm">Créer le rôle</button>
                    </div>
                  </form>
                )}

                {/* Liste des rôles */}
                {groupRoles.length === 0 ? (
                  <div className="card center col" style={{ padding: '3rem', gap: '0.5rem', borderStyle: 'dashed', background: 'transparent' }}>
                    <span style={{ fontSize: '1.75rem' }}>🔑</span>
                    <p className="muted sm">Aucun rôle défini dans ce groupe.</p>
                    {canEdit && <button className="btn btn-blue btn-sm" onClick={() => setShowRoleForm(true)}>Créer le premier rôle</button>}
                  </div>
                ) : (
                  <div className="col gap-xs">
                    {groupRoles.map(role => {
                      const titulaires = memberSnapshots.filter(s => s.roles?.some(a => a.role?.id === role.id));
                      const isExpanded = expandedRoleId === role.id;
                      return (
                        <div key={role.id} className="card" style={{ overflow: 'hidden' }}>
                          {/* Ligne du rôle */}
                          <div className="row" style={{ padding: '0.875rem 1.25rem', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'var(--purple-100)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--blue)', marginBottom: '0.125rem' }}>{role.name}</div>
                              <div className="xs muted truncate">{role.description || 'Aucune description'}</div>
                            </div>

                            {/* Titulaires avatars */}
                            {titulaires.length > 0 && (
                              <div className="row" style={{ gap: '-0.25rem', marginRight: '0.5rem' }}>
                                {titulaires.slice(0, 4).map((s, i) => (
                                  <div key={s.identity.id} className="avatar" title={`${s.identity.firstName} ${s.identity.lastName}`}
                                    style={{ width: 24, height: 24, fontSize: '0.5625rem', background: getColor(s.identity.firstName + s.identity.lastName), borderRadius: '50%', border: '2px solid white', marginLeft: i > 0 ? '-6px' : 0, zIndex: 4 - i }}>
                                    {getInitials(s.identity.firstName, s.identity.lastName)}
                                  </div>
                                ))}
                                <span className="xs muted" style={{ marginLeft: titulaires.length > 0 ? '0.5rem' : 0 }}>
                                  {titulaires.length} titulaire{titulaires.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}

                            <div className="row gap-xs">
                              {canEdit && (
                                <button
                                  className={`btn btn-sm ${isExpanded ? 'btn-blue' : 'btn-outline'}`}
                                  onClick={() => { setExpandedRoleId(isExpanded ? null : role.id); setAssignForm({ identityId: '', startDate: new Date().toISOString().split('T')[0] }); setShowRoleForm(false); }}
                                >
                                  {isExpanded ? '✕ Fermer' : '+ Affecter'}
                                </button>
                              )}
                              {isAdmin && (
                                <button className="btn-icon btn-sm" style={{ color: 'var(--red)', opacity: 0.7 }} title="Supprimer ce rôle" onClick={() => handleDeleteRole(role)}>
                                  <svg style={{ width: 15 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Accordéon affectation */}
                          {isExpanded && (
                            <form onSubmit={handleAssignRole} className="slide-up" style={{ padding: '1rem 1.25rem', background: '#f0f6ff', borderTop: '1px solid #bfdbfe' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--blue-500)', marginBottom: '0.625rem' }}>
                                Affecter le rôle <em style={{ fontStyle: 'normal' }}>"{role.name}"</em>
                              </div>
                              <div className="form-row" style={{ marginBottom: '0.625rem' }}>
                                <div className="field">
                                  <label className="lbl">Personne</label>
                                  <SearchSelect placeholder="Rechercher par nom…" value={assignForm.identityId} onChange={id => setAssignForm({ ...assignForm, identityId: id })} />
                                </div>
                                <div className="field">
                                  <label className="lbl">Date de début</label>
                                  <input type="date" required value={assignForm.startDate} onChange={e => setAssignForm({ ...assignForm, startDate: e.target.value })} />
                                </div>
                              </div>
                              <div className="form-actions">
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => setExpandedRoleId(null)}>Annuler</button>
                                <button type="submit" className="btn btn-blue btn-sm" disabled={!assignForm.identityId}>Valider l'affectation</button>
                              </div>
                            </form>
                          )}

                          {/* Titulaires liste (si > 0 et pas expanded) */}
                          {!isExpanded && titulaires.length > 0 && (
                            <div style={{ padding: '0.5rem 1.25rem', background: 'var(--bg-hover)', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {titulaires.map(s => (
                                <div key={s.identity.id} className="row gap-xs" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '99px', padding: '0.125rem 0.625rem 0.125rem 0.25rem', fontSize: '0.6875rem' }}>
                                  <div className="avatar" style={{ width: 18, height: 18, fontSize: '0.4375rem', background: getColor(s.identity.firstName + s.identity.lastName), borderRadius: '50%' }}>
                                    {getInitials(s.identity.firstName, s.identity.lastName)}
                                  </div>
                                  {s.identity.firstName} {s.identity.lastName}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Onglet Membres ────────────────────────────── */}
            {tab === 'members' && (
              <div className="card slide-up" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '0.875rem 1.25rem', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Membres actifs du groupe</span>
                  <span className="xs muted" style={{ marginLeft: '0.5rem' }}>Identités rattachées via un rôle actif</span>
                </div>
                {groupMembers.length === 0 ? (
                  <div className="center col" style={{ padding: '3rem', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.75rem' }}>👥</span>
                    <p className="muted sm">Aucun membre actif dans ce groupe.</p>
                    {canEdit && <button className="btn btn-outline btn-sm" onClick={() => setTab('roles')}>Affecter un rôle →</button>}
                  </div>
                ) : (
                  <div>
                    {groupMembers.map((m, i) => {
                      const memberRoles = roles.filter(r => r.group?.id === selectedGroup?.id)
                        .filter(r => memberSnapshots.some(s => s.identity.id === m.id && s.roles?.some(a => a.role?.id === r.id)));
                      return (
                        <div key={m.id} className="row" style={{ padding: '0.875rem 1.25rem', gap: '1rem', borderBottom: i < groupMembers.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                          <div className="avatar" style={{ width: 38, height: 38, fontSize: '0.75rem', background: getColor(m.firstName + m.lastName), borderRadius: '10px', flexShrink: 0 }}>
                            {getInitials(m.firstName, m.lastName)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{m.firstName} {m.lastName}</div>
                            <div className="xs muted truncate">{m.primaryEmail}</div>
                          </div>
                          <div className="row gap-xs" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {memberRoles.map(r => (
                              <span key={r.id} className="tag tag-purple" style={{ fontSize: '0.6875rem' }}>{r.name}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Onglet Configurateurs ─────────────────────── */}
            {tab === 'configurators' && (
              <div className="card slide-up" style={{ overflow: 'hidden' }}>
                <div className="row between" style={{ padding: '0.875rem 1.25rem', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Configurateurs</span>
                    <span className="xs muted" style={{ marginLeft: '0.5rem' }}>Gestion des rôles et membres de ce groupe</span>
                  </div>
                  {canEdit && (
                    <div style={{ width: 240 }}>
                      <SearchSelect placeholder="+ Ajouter un configurateur…" onChange={id => handleAddConfigurator(id)} />
                    </div>
                  )}
                </div>
                {groupConfigurators.length === 0 ? (
                  <div className="center" style={{ padding: '3rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Aucun configurateur pour ce groupe.
                  </div>
                ) : (
                  <div>
                    {groupConfigurators.map((m, i) => (
                      <div key={m.id} className="row between" style={{ padding: '0.875rem 1.25rem', gap: '1rem', borderBottom: i < groupConfigurators.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                        <div className="row gap-md" style={{ gap: '0.75rem' }}>
                          <div className="avatar" style={{ width: 38, height: 38, fontSize: '0.75rem', background: 'var(--purple)', borderRadius: '10px', flexShrink: 0 }}>
                            {getInitials(m.firstName, m.lastName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{m.firstName} {m.lastName}</div>
                            <div className="xs muted">{m.primaryEmail}</div>
                          </div>
                        </div>
                        <div className="row gap-sm">
                          <span className="tag tag-purple" style={{ fontSize: '0.6875rem' }}>Configurateur</span>
                          {canEdit && (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ color: 'var(--red)', borderColor: 'var(--red)', fontSize: '0.6875rem' }}
                              disabled={groupConfigurators.length <= 1}
                              title={groupConfigurators.length <= 1 ? 'Impossible de retirer le dernier configurateur' : ''}
                              onClick={() => handleRemoveConfigurator(m.id)}
                            >
                              Retirer
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal création de groupe ─────────────────────────── */}
      {showGroupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card slide-up" style={{ width: '100%', maxWidth: 440, padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.125rem' }}>Nouveau groupe</h2>
            <form onSubmit={handleCreateGroup} className="col gap-md">
              <div className="field">
                <label className="lbl">Nom du groupe</label>
                <input required autoFocus value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="ex : Direction du Système d'Information" />
              </div>
              <div className="field">
                <label className="lbl">Groupe parent <span className="muted xs">(optionnel)</span></label>
                <select value={groupForm.parentId} onChange={e => setGroupForm({ ...groupForm, parentId: e.target.value })}>
                  <option value="">— Groupe racine (aucun parent) —</option>
                  {displayGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="row end gap-sm" style={{ marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowGroupModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-blue">Créer le groupe</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
