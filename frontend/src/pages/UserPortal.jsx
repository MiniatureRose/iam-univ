import { useState, useEffect } from 'react';
import { fetchMe, updateMyContact, changePassword, logout, fetchIdentityGroups } from '../services/api';
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
  const [showPwd, setShowPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.next !== pwdForm.confirm) { toast('Les mots de passe ne correspondent pas.', 'err'); return; }
    if (pwdForm.next.length < 8) { toast('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'err'); return; }
    setPwdSaving(true);
    try {
      await changePassword(pwdForm.current, pwdForm.next);
      toast('Mot de passe modifié avec succès');
      setShowPwd(false);
      setPwdForm({ current: '', next: '', confirm: '' });
    } catch (err) { toast(err.message || 'Erreur lors du changement de mot de passe', 'err'); }
    finally { setPwdSaving(false); }
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
            <span className={`tag ${currentUser?.appRole === 'ADMIN' ? 'tag-red' : currentUser?.appRole === 'CONFIGURATOR' ? 'tag-purple' : 'tag-gray'}`}>
              {currentUser?.appRole === 'ADMIN' ? 'Administrateur' : currentUser?.appRole === 'CONFIGURATOR' ? 'Configurateur' : 'Utilisateur'}
            </span>
            <span className="muted xs" style={{marginLeft:'0.25rem'}}>
              · {activeAssignments.length} rôle{activeAssignments.length !== 1 ? 's' : ''} actif{activeAssignments.length !== 1 ? 's' : ''} · {groups.length} groupe{groups.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="profile-card-side">
          <button onClick={logout} className="btn btn-sm btn-outline">Déconnexion</button>
          <div className="profile-card-org"><IconUniv /> {appConfig?.universityName || 'Université'}</div>
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
            {!editing && !showPwd && (
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
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem'}}>
                {[
                  { label: 'E-mail institutionnel', val: identity.primaryEmail,   icon: '✉️' },
                  { label: 'Téléphone',             val: identity.phone,          icon: '📞' },
                  { label: 'E-mail personnel',      val: identity.personalEmail,  icon: '🏠' },
                  { label: 'Statut contractuel',    val: identity.status?.name,   icon: '📋' },
                ].map(({ label, val, icon }) => (
                  <div key={label} style={{
                    padding:'0.75rem', borderRadius:'var(--radius)',
                    background:'var(--bg-hover)', border:'1px solid var(--border)',
                  }}>
                    <div className="lbl" style={{marginBottom:'0.375rem'}}>{label}</div>
                    <div className="sm" style={{fontWeight: val ? 500 : 400}}>
                      {val ? val : <em className="muted xs" style={{fontStyle:'normal'}}>Non renseigné</em>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Changement de mot de passe — intégré dans la carte contact */}
            {!editing && (
              <div style={{marginTop:'0.875rem', borderTop:'1px solid var(--border)', paddingTop:'0.875rem'}}>
                {showPwd ? (
                  <form onSubmit={handleChangePassword} className="col gap-md fade-in">
                    <div className="lbl" style={{color:'var(--text-sub)', marginBottom:'-0.25rem'}}>Changer le mot de passe</div>
                    <div className="form-row">
                      <div className="field">
                        <label className="lbl">Mot de passe actuel</label>
                        <input type="password" required value={pwdForm.current} onChange={e => setPwdForm({...pwdForm, current: e.target.value})} autoComplete="current-password" />
                      </div>
                      <div className="field">
                        <label className="lbl">Nouveau mot de passe</label>
                        <input type="password" required minLength={8} value={pwdForm.next} onChange={e => setPwdForm({...pwdForm, next: e.target.value})} autoComplete="new-password" />
                      </div>
                      <div className="field">
                        <label className="lbl">Confirmer</label>
                        <input type="password" required value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} autoComplete="new-password" />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowPwd(false); setPwdForm({ current: '', next: '', confirm: '' }); }}>Annuler</button>
                      <button type="submit" className="btn btn-blue btn-sm" disabled={pwdSaving}>{pwdSaving ? 'Enregistrement…' : 'Mettre à jour'}</button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowPwd(true)}
                    style={{display:'flex', alignItems:'center', gap:'0.375rem'}}
                  >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Changer le mot de passe
                  </button>
                )}
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
