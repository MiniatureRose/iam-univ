import { useState, useEffect } from 'react';
import { fetchAuditLogs } from '../services/api';
import { SkeletonRow } from '../components/ui/Skeleton';

const ACTION_META = {
  IDENTITY_CREATED:     { label: 'Identité créée',          tag: 'tag-green',  icon: '👤' },
  IDENTITY_DELETED:     { label: 'Identité supprimée',       tag: 'tag-red',    icon: '🗑️' },
  ROLE_CREATED:         { label: 'Rôle créé',               tag: 'tag-blue',   icon: '🔑' },
  ROLE_DELETED:         { label: 'Rôle supprimé',           tag: 'tag-red',    icon: '🗑️' },
  ROLE_ASSIGNED:        { label: 'Rôle affecté',            tag: 'tag-blue',   icon: '🔑' },
  ROLE_TERMINATED:      { label: 'Rôle clôturé',            tag: 'tag-orange', icon: '⏹️' },
  STATUS_ASSIGNED:      { label: 'Statut modifié',          tag: 'tag-purple', icon: '📋' },
  APP_ROLE_CHANGED:     { label: 'Rôle système modifié',    tag: 'tag-purple', icon: '⚡' },
  GROUP_CREATED:        { label: 'Groupe créé',             tag: 'tag-green',  icon: '🏢' },
  GROUP_DELETED:        { label: 'Groupe supprimé',         tag: 'tag-red',    icon: '🗑️' },
  GROUP_RENAMED:        { label: 'Groupe renommé',          tag: 'tag-blue',   icon: '✏️' },
  CONFIGURATOR_ADDED:   { label: 'Configurateur ajouté',    tag: 'tag-cyan',   icon: '⚙️' },
  CONFIGURATOR_REMOVED: { label: 'Configurateur retiré',    tag: 'tag-orange', icon: '⚙️' },
  PASSWORD_CHANGED:     { label: 'Mot de passe modifié',    tag: 'tag-gold',   icon: '🔒' },
};

const FILTERS = [
  { key: '',              label: 'Tout' },
  { key: 'IDENTITY',      label: 'Identités' },
  { key: 'GROUP',         label: 'Groupes' },
  { key: 'ROLE_ASSIGNMENT', label: 'Affectations' },
  { key: 'ROLE',          label: 'Rôles' },
];

function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function AuditPage() {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [entityType, setEntityType] = useState('');

  useEffect(() => { setPage(0); }, [entityType]);
  useEffect(() => { load(); }, [page, entityType]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs(page, 30, entityType);
      setLogs(res.content || []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
    } catch { /* silently fail, admin-only page */ }
    finally { setLoading(false); }
  };

  return (
    <div className="fade-in">
      <div className="page-top">
        <div>
          <h1>Journal d'audit</h1>
          <p className="sub sm">{totalElements} événement{totalElements !== 1 ? 's' : ''} enregistré{totalElements !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card" style={{ padding: '0.5rem 0.75rem', marginBottom: '1rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setEntityType(f.key)}
            className={entityType === f.key ? 'btn btn-dark btn-sm' : 'btn btn-outline btn-sm'}
          >
            {f.label}
          </button>
        ))}
        <span className="muted xs" style={{ marginLeft: 'auto' }}>
          {loading ? 'Chargement…' : `Page ${page + 1} / ${Math.max(1, totalPages)}`}
        </span>
      </div>

      {/* Table */}
      <div className="tbl card">
        {loading ? (
          <table>
            <thead>
              <tr><th>Action</th><th>Entité</th><th>Détails</th><th>Acteur</th><th>Date</th></tr>
            </thead>
            <tbody>{Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
          </table>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.4 }}>📋</p>
            <p className="muted sm">Aucun événement pour cette catégorie.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Entité concernée</th>
                <th>Détails</th>
                <th>Acteur</th>
                <th style={{ whiteSpace: 'nowrap' }}>Date &amp; heure</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const meta = ACTION_META[log.action] || { label: log.action, tag: 'tag-gray', icon: '•' };
                return (
                  <tr key={log.id} style={{ cursor: 'default' }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>{meta.icon}</span>
                        <span className={`tag ${meta.tag}`}>{meta.label}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.entityName || '—'}</td>
                    <td className="muted sm" style={{ maxWidth: 280 }}>
                      <span className="truncate" style={{ display: 'block' }}>{log.details || '—'}</span>
                    </td>
                    <td className="muted sm" style={{ whiteSpace: 'nowrap' }}>{log.actorEmail}</td>
                    <td className="muted xs" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(log.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="row gap-sm" style={{ marginTop: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            ← Précédent
          </button>
          <span className="sm muted">Page {page + 1} sur {totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
