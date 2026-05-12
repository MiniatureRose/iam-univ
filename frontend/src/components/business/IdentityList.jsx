import { useState, useEffect, useMemo } from 'react';
import { createIdentity, deleteIdentity, fetchAllSnapshots, fetchStatuses, fetchStats } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../ui/ConfirmModal';
import { getColor, getInitials } from '../../utils';
import { SkeletonRow } from '../ui/Skeleton';

const StatusTag = ({ name }) => name
  ? <span className="tag" style={{ background: getColor(name), color: '#fff' }}>{name}</span>
  : <span className="muted xs">—</span>;

export default function IdentityList({ currentUser, onSelect, hideHeader }) {
  const [snapshots, setSnapshots] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalRolesCreated, setTotalRolesCreated] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName:'', lastName:'', primaryEmail:'', phone:'', statusId:'' });
  const [statuses, setStatuses] = useState([]);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [statusFilter, groupFilter]);

  useEffect(() => { load(); }, [debouncedSearch, page]);

  const load = async () => {
    setLoading(true);
    try {
      const [res, sts, stats] = await Promise.all([
        fetchAllSnapshots(debouncedSearch, page, 20).catch(() => ({ content: [], totalPages: 0, totalElements: 0 })),
        fetchStatuses().catch(() => []),
        fetchStats().catch(() => ({ roles: 0 }))
      ]);
      setSnapshots(res.content || []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
      setTotalRolesCreated(stats.roles || 0);
      setStatuses(sts);
      const map = new Map();
      (res.content || []).forEach(snap => (snap.roles || []).forEach(r => { if (r.role?.group) map.set(r.role.group.id, r.role.group.name); }));
      setGroups(Array.from(map.entries()).map(([id, name]) => ({ id, name })));
    } catch { toast('Erreur de chargement de l\'annuaire', 'err'); }
    finally { setLoading(false); }
  };

  const [tempPassword, setTempPassword] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const result = await createIdentity(form);
      setTempPassword(result?.temporaryPassword || null);
      setForm({ firstName:'', lastName:'', primaryEmail:'', phone:'', statusId:'' });
      setShowForm(false);
      load();
    } catch(err) { toast(err.message || 'Erreur lors de la création', 'err'); }
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!await confirm(`Supprimer ${name} ? Cette action est irréversible.`)) return;
    try { await deleteIdentity(id); toast('Identité supprimée'); load(); }
    catch { toast('Erreur lors de la suppression', 'err'); }
  };

  const filtered = useMemo(() => snapshots.filter(snap => {
    const matchStatus = !statusFilter || snap.identity.status?.name === statusFilter;
    const matchGroup = !groupFilter || snap.roles?.some(r => r.role?.group?.id === groupFilter);
    return matchStatus && matchGroup;
  }), [snapshots, statusFilter, groupFilter]);

  const uniqueStatuses = useMemo(() => [...new Set(statuses.map(s => s.name).filter(Boolean))], [statuses]);
  const totalRoles = useMemo(() => snapshots.reduce((acc, s) => acc + (s.roles?.length || 0), 0), [snapshots]);
  const withStatus = useMemo(() => snapshots.filter(s => s.identity?.status).length, [snapshots]);
  const canEdit = currentUser?.appRole === 'ADMIN' || currentUser?.appRole === 'CONFIGURATOR';

  return (
    <div className="fade-in">
      {!hideHeader && (
        <div className="page-top">
          <div>
            <h1>Registre des Identités</h1>
            <p className="sub sm">{totalElements} personne{totalElements !== 1 ? 's' : ''} dans l'annuaire</p>
          </div>
          {canEdit && <button className="btn btn-dark" onClick={() => setShowForm(!showForm)}>+ Nouvelle Identité</button>}
        </div>
      )}

      {/* Stats — masquées si le parent gère déjà des stats (hideHeader) */}
      {!hideHeader && (
        <div className="stats">
          <div className="stat card">
            <div className="stat-ic" style={{background:'#dbeafe',color:'#1e40af'}}>👤</div>
            <div><div className="stat-val">{totalElements}</div><div className="stat-lbl">Identités</div></div>
          </div>
          <div className="stat card">
            <div className="stat-ic" style={{background:'#d1fae5',color:'#065f46'}}>✓</div>
            <div><div className="stat-val">{withStatus}</div><div className="stat-lbl">Avec statut</div></div>
          </div>
          <div className="stat card">
            <div className="stat-ic" style={{background:'#fef3c7',color:'#92400e'}}>🔑</div>
            <div><div className="stat-val">{totalRolesCreated}</div><div className="stat-lbl">Rôles créés</div></div>
          </div>
        </div>
      )}

      {/* Bouton Nouvelle Identité quand hideHeader=true */}
      {hideHeader && canEdit && (
        <div className="row end" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-blue" onClick={() => setShowForm(!showForm)}>+ Nouvelle Identité</button>
        </div>
      )}

      {/* Formulaire création */}
      {showForm && (
        <form onSubmit={handleCreate} className="card slide-up" style={{marginBottom:'1rem', padding:'1.25rem', borderLeft:'4px solid var(--blue-500)'}}>
          <h3 style={{marginBottom:'0.75rem', fontSize:'0.9375rem'}}>Nouvelle Identité</h3>
          <div className="form-full">
            <div className="field"><span className="label">Prénom</span><input required value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} placeholder="Jean" /></div>
            <div className="field"><span className="label">Nom</span><input required value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} placeholder="Dupont" /></div>
            <div className="field"><span className="label">Email</span><input required type="email" value={form.primaryEmail} onChange={e=>setForm({...form,primaryEmail:e.target.value})} placeholder="jean.dupont@univ.fr" /></div>
            <div className="field"><span className="label">Téléphone <span className="muted xs">(optionnel)</span></span><input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+33 6..." /></div>
            <div className="field">
              <span className="label">Statut</span>
              <select value={form.statusId} onChange={e=>setForm({...form,statusId:e.target.value})}>
                <option value="">— Aucun statut —</option>
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={()=>setShowForm(false)}>Annuler</button>
            <button type="submit" className="btn btn-blue">Créer l'Identité</button>
          </div>
        </form>
      )}

      {/* Mot de passe temporaire */}
      {tempPassword && (
        <div className="tmpwd slide-up">
          <div className="tmpwd-badge">⚠️ À communiquer une seule fois</div>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Identité créée — mot de passe temporaire</div>
          <div className="muted sm" style={{ marginBottom: '0.75rem' }}>
            Transmettez ce mot de passe à l'utilisateur. Il sera invité à le changer à la première connexion. <strong>Cette bannière disparaîtra à la prochaine action.</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="tmpwd-code">
              <span>{tempPassword}</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(tempPassword)}>
                Copier
              </button>
            </div>
            <button className="btn btn-dark btn-sm" onClick={() => setTempPassword(null)}>
              J'ai noté le mot de passe
            </button>
          </div>
        </div>
      )}

      {/* Barre de filtres */}
      <div className="card" style={{ padding: '0.625rem 0.875rem', marginBottom: '1rem', display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-box flex1" style={{ minWidth: '220px' }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher par nom, email…" style={{ border:'none', background:'transparent', outline:'none', width:'100%', fontSize:'0.8125rem' }} />
        </div>
        <div style={{ width:'1px', height:'20px', background:'var(--border)' }} />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ padding:'0.3rem 0.625rem', borderRadius:'6px', border:'1px solid var(--border)', fontSize:'0.8125rem', background:'#fafbfc' }}>
          <option value="">Tous les statuts</option>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{ padding:'0.3rem 0.625rem', borderRadius:'6px', border:'1px solid var(--border)', fontSize:'0.8125rem', background:'#fafbfc' }}>
          <option value="">Tous les groupes</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {(search || statusFilter || groupFilter) && (
          <button className="btn btn-sm btn-outline" onClick={() => { setSearch(''); setStatusFilter(''); setGroupFilter(''); }}>Effacer</button>
        )}
        <div className="muted xs" style={{ marginLeft:'auto', whiteSpace:'nowrap' }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="tbl card">
        {loading ? (
          <table>
            <thead><tr><th>Personne</th><th>Statut</th><th>Rôles</th></tr></thead>
            <tbody>{Array.from({length:8}).map((_,i) => <SkeletonRow key={i} cols={3} />)}</tbody>
          </table>
        ) : filtered.length === 0 ? (
          <div style={{padding:'3rem',textAlign:'center'}}>
            <p style={{fontSize:'2rem',marginBottom:'0.5rem',opacity:0.5}}>🔍</p>
            <p className="muted sm">{(debouncedSearch || statusFilter || groupFilter) ? 'Aucune personne ne correspond à vos critères.' : "Aucune identité dans l'annuaire."}</p>
            {!(debouncedSearch || statusFilter || groupFilter) && canEdit && (
              <button className="btn btn-blue" style={{marginTop:'0.75rem'}} onClick={()=>setShowForm(true)}>+ Créer la première identité</button>
            )}
            {(debouncedSearch || statusFilter || groupFilter) && (
              <button className="btn btn-outline btn-sm" style={{marginTop:'0.75rem'}} onClick={() => { setSearch(''); setStatusFilter(''); setGroupFilter(''); }}>Réinitialiser les filtres</button>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Personne</th>
                <th>Statut</th>
                <th>Rôles</th>
                {currentUser?.appRole === 'ADMIN' && <th style={{width:80}}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(snap => {
                const i = snap.identity;
                const statusName = i.status?.name;
                const roleCount = snap.roles?.length || 0;
                return (
                  <tr key={i.id} onClick={() => onSelect(i.id)}>
                    <td>
                      <div className="row gap-sm">
                        <div className="avatar" style={{ width:34,height:34,fontSize:'0.6875rem',background:getColor(i.firstName+i.lastName) }}>
                          {getInitials(i.firstName, i.lastName)}
                        </div>
                        <div>
                          <div style={{fontWeight:500}}>{i.firstName} {i.lastName}</div>
                          <div className="muted xs">{i.primaryEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td><StatusTag name={statusName} /></td>
                    <td>{roleCount > 0 ? <span className="tag tag-gray">{roleCount} rôle{roleCount>1?'s':''}</span> : <span className="muted xs">—</span>}</td>
                    {currentUser?.appRole === 'ADMIN' && (
                      <td><button className="btn btn-red btn-sm" onClick={e => handleDelete(e, i.id, `${i.firstName} ${i.lastName}`)}>Supprimer</button></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="row gap-sm" style={{ marginTop:'1rem', justifyContent:'center' }}>
          <button className="btn btn-outline btn-sm" disabled={page===0} onClick={() => setPage(p=>p-1)}>← Précédent</button>
          <span className="sm muted">Page {page+1} sur {totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={page===totalPages-1} onClick={() => setPage(p=>p+1)}>Suivant →</button>
        </div>
      )}
    </div>
  );
}
