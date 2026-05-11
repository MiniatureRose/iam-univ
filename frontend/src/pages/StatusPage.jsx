import { useState, useEffect } from 'react';
import { fetchStatuses, createStatus, deleteStatus } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmModal';

export default function StatusPage({ hideHeader }) {
  const [statuses, setStatuses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [statusForm, setStatusForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setStatuses((await fetchStatuses()) || []); }
    catch { toast('Erreur de chargement des statuts', 'err'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createStatus(statusForm);
      toast('Statut créé avec succès');
      setStatusForm({ name: '', description: '' });
      setShowForm(false);
      load();
    } catch { toast('Erreur lors de la création', 'err'); }
  };

  const handleDelete = async (id, name) => {
    if (await confirm(`Supprimer le statut "${name}" ? Cette action est irréversible.`)) {
      try { await deleteStatus(id); toast('Statut supprimé'); load(); }
      catch { toast('Erreur lors de la suppression', 'err'); }
    }
  };

  return (
    <div className="fade-in">
      {!hideHeader && (
        <div className="page-top">
          <div>
            <h1>Référentiel des Statuts</h1>
            <p className="sub sm">Gérez les statuts contractuels disponibles dans l'annuaire</p>
          </div>
          <button className="btn btn-dark" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Annuler' : '+ Nouveau Statut'}
          </button>
        </div>
      )}

      {hideHeader && (
        <div className="row end" style={{ marginBottom: '1.5rem' }}>
          <button className="btn btn-blue btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Annuler' : '+ Nouveau Statut'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card slide-up" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--blue-500)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem' }}>Ajouter un nouveau statut</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div className="field">
              <span className="label">Nom du statut</span>
              <input required value={statusForm.name} onChange={e => setStatusForm({ ...statusForm, name: e.target.value })} placeholder="ex : Enseignant" />
            </div>
            <div className="field">
              <span className="label">Description</span>
              <input value={statusForm.description} onChange={e => setStatusForm({ ...statusForm, description: e.target.value })} placeholder="Description courte..." />
            </div>
          </div>
          <div className="row end gap-sm" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>Annuler</button>
            <button type="submit" className="btn btn-blue btn-sm">Enregistrer</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="center" style={{ padding: '3rem' }}><div className="detail-spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {statuses.length === 0 ? (
            <div className="card center" style={{ padding: '3rem', gridColumn: '1/-1', borderStyle: 'dashed', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '1.75rem' }}>📋</p>
              <p className="muted">Aucun statut défini dans le référentiel.</p>
            </div>
          ) : statuses.map(s => (
            <div key={s.id} className="card row between" style={{ padding: '1rem 1.25rem', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
            >
              <div className="col" style={{ gap: '0.125rem' }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                {s.description && <div className="xs muted">{s.description}</div>}
              </div>
              <button className="btn-icon btn-sm" style={{ color: 'var(--red)', flexShrink: 0 }} onClick={() => handleDelete(s.id, s.name)}>
                <svg style={{ width: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
