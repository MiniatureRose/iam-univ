import { useState, useEffect } from 'react';
import { fetchMe, updateMyContact, logout, fetchIdentityGroups } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { getColor, isActive, fmtDate as fmt } from '../utils';
import { IconMail, IconPhone, IconCopy, IconClock, IconUniv } from '../components/ui/Icons';

export default function UserPortal({ currentUser, appConfig }) {
  const [profile, setProfile] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ personalEmail: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await fetchMe();
      const g = await fetchIdentityGroups(data.identity.id).catch(() => []);
      setProfile(data);
      setGroups(g);
      setForm({ personalEmail: data.identity?.personalEmail || '', phone: data.identity?.phone || '' });
    } catch { toast('Erreur de chargement du profil', 'err'); }
    finally { setLoading(false); }
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMyContact(form);
      toast('Informations mises à jour');
      setEditing(false);
      await loadProfile();
    } catch { toast('Erreur lors de la mise à jour', 'err'); }
    finally { setSaving(false); }
  };

  const copyEmail = (email) => {
    navigator.clipboard.writeText(email).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  if (loading) return (
    <div className="center" style={{height:'80vh'}}>
      <div className="col center gap-md"><div className="detail-spinner" /><p className="muted sm">Chargement de votre espace…</p></div>
    </div>
  );
  if (!profile) return null;

  const identity = profile.identity;
  const assignments = profile.roles || [];
  const activeAssignments = assignments.filter(a => isActive(a));
  const pastAssignments = assignments.filter(a => !isActive(a));
  const avatarColor = getColor(identity.firstName + identity.lastName);

  return (
    <div className="fade-in" style={{paddingBottom:'3rem'}}>

      {/* Carte d'identité personnelle */}
      <div className="idcard" style={{marginBottom:'1.25rem'}}>
        <div className="idcard-gold-bar" />
        <div className="idcard-bg-pattern" />
        <div className="idcard-top">
          <div className="idcard-univ"><IconUniv /> {appConfig?.universityName || 'Université'}</div>
          <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
            {identity.status && <div className="idcard-status-badge">{identity.status.name}</div>}
            <button
              onClick={logout}
              style={{background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.6)', fontSize:'0.6875rem', padding:'0.1875rem 0.625rem', borderRadius:'99px', cursor:'pointer', fontWeight:600, transition:'all 0.15s'}}
            >
              Déconnexion
            </button>
          </div>
        </div>
        <div className="idcard-main">
          <div className="idcard-avatar" style={{background: avatarColor}}>
            {identity.firstName?.[0]}{identity.lastName?.[0]}
          </div>
          <div className="idcard-details">
            <div className="idcard-name">{identity.firstName} {identity.lastName}</div>
            <div className="idcard-email">
              <IconMail />
              {identity.primaryEmail}
              <button className="idcard-copy" onClick={() => copyEmail(identity.primaryEmail)} title="Copier l'adresse">
                {copied ? '✓' : <IconCopy />}
              </button>
            </div>
            {identity.phone && (
              <div className="idcard-phone"><IconPhone /> {identity.phone}</div>
            )}
          </div>
        </div>
        <div className="idcard-footer">
          <div className="idcard-meta-item">
            <div className="idcard-meta-label">Rôles actifs</div>
            <div className="idcard-meta-val">{activeAssignments.length}</div>
          </div>
          <div className="idcard-meta-sep" />
          <div className="idcard-meta-item">
            <div className="idcard-meta-label">Groupes</div>
            <div className="idcard-meta-val">{groups.length}</div>
          </div>
          <div className="idcard-meta-sep" />
          <div className="idcard-meta-item">
            <div className="idcard-meta-label">E-mail personnel</div>
            <div className="idcard-meta-val" style={{fontSize:'0.75rem'}}>
              {identity.personalEmail || <span style={{color:'rgba(255,255,255,0.3)'}}>Non renseigné</span>}
            </div>
          </div>
          <div className="idcard-meta-sep" />
          <div className="idcard-meta-item">
            <div className="idcard-meta-label">Affectations passées</div>
            <div className="idcard-meta-val">{pastAssignments.length}</div>
          </div>
        </div>
      </div>

      {/* Grille principale */}
      <div className="detail-grid" style={{marginBottom:'1rem'}}>

        {/* Informations de contact */}
        <div className="card detail-sec">
          <div className="detail-sec-head">
            <div className="detail-sec-icon" style={{background:'#eff6ff', color:'var(--blue-500)'}}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            </div>
            <div style={{flex:1}}>
              <div className="detail-sec-title">Mes informations de contact</div>
            </div>
            {!editing && (
              <button className="btn btn-sm btn-outline" onClick={() => setEditing(true)}>Modifier</button>
            )}
          </div>
          <div className="detail-sec-body">
            {editing ? (
              <form onSubmit={handleSaveContact} className="col gap-md fade-in">
                <div className="form-row">
                  <div className="field">
                    <label className="lbl">Téléphone</label>
                    <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+33 6…" />
                  </div>
                  <div className="field">
                    <label className="lbl">E-mail personnel</label>
                    <input type="email" value={form.personalEmail} onChange={e => setForm({...form, personalEmail: e.target.value})} placeholder="perso@example.com" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Annuler</button>
                  <button type="submit" className="btn btn-blue btn-sm" disabled={saving}>{saving ? 'Enregistrement…' : 'Valider'}</button>
                </div>
              </form>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                {[
                  { label: 'E-mail institutionnel', val: identity.primaryEmail },
                  { label: 'Téléphone',             val: identity.phone },
                  { label: 'E-mail personnel',      val: identity.personalEmail },
                  { label: 'Statut contractuel',    val: identity.status?.name },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div className="lbl">{label}</div>
                    <div className="sm">{val || <em className="muted xs">Non renseigné</em>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rôles actifs */}
        <div className="card detail-sec">
          <div className="detail-sec-head">
            <div className="detail-sec-icon" style={{background:'var(--green-100)', color:'var(--green)'}}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <div className="detail-sec-title">Mes rôles actifs</div>
              <div className="detail-sec-count">{activeAssignments.length} affectation{activeAssignments.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="detail-sec-body">
            {activeAssignments.length === 0 ? (
              <div className="tl-empty">
                <span style={{fontSize:'1.5rem', display:'block', marginBottom:'0.5rem'}}>🔑</span>
                Vous n'avez aucun rôle actif pour le moment.
              </div>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historique (pleine largeur si présent) */}
      {pastAssignments.length > 0 && (
        <div className="card detail-sec">
          <div className="detail-sec-head">
            <div className="detail-sec-icon" style={{background:'#f3f4f6', color:'var(--text-muted)'}}>
              <IconClock />
            </div>
            <div>
              <div className="detail-sec-title">Anciennes affectations</div>
              <div className="detail-sec-count">{pastAssignments.length} terminée{pastAssignments.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="detail-sec-body">
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
          </div>
        </div>
      )}

    </div>
  );
}
