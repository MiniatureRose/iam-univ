import { useState } from 'react';
import { changePassword, logout } from '../services/api';

export default function ChangePasswordPage({ currentUser, onSuccess, appConfig = {} }) {
  const appName = appConfig.appName || 'IAM';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const EyeBtn = ({ field }) => (
    <button type="button" onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
      style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
      {show[field]
        ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
        : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      }
    </button>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (next.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setLoading(true);
    try {
      await changePassword(current, next);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '1rem'
          }}>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="white">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Première connexion</h2>
          <p className="muted sm" style={{ marginTop: '0.35rem' }}>
            Vous devez définir un mot de passe personnel avant de continuer.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label">Mot de passe temporaire</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={show.current ? 'text' : 'password'} value={current}
                onChange={e => setCurrent(e.target.value)} placeholder="Mot de passe reçu de l'administrateur"
                required autoFocus style={{ paddingRight: '2.75rem' }} />
              <EyeBtn field="current" />
            </div>
          </div>

          <div>
            <label className="form-label">Nouveau mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={show.next ? 'text' : 'password'} value={next}
                onChange={e => setNext(e.target.value)} placeholder="Au moins 8 caractères"
                required style={{ paddingRight: '2.75rem' }} />
              <EyeBtn field="next" />
            </div>
          </div>

          <div>
            <label className="form-label">Confirmer le nouveau mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={show.confirm ? 'text' : 'password'} value={confirm}
                onChange={e => setConfirm(e.target.value)} placeholder="Répéter le mot de passe"
                required style={{ paddingRight: '2.75rem' }} />
              <EyeBtn field="confirm" />
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--red-bg, #fef2f2)', color: 'var(--red)', border: '1px solid var(--red-border, #fecaca)',
              borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Enregistrement…' : 'Définir mon mot de passe'}
            </button>
            <button type="button" className="btn" onClick={logout}>
              Déconnexion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
