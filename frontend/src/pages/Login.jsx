import { useState } from 'react';
import { login } from '../services/api';

export default function Login({ onLoginComplete, appConfig = {} }) {
  const universityName = appConfig.universityName || 'Université';
  const appName = appConfig.appName || 'IAM';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailInvalid = touched.email && !email.includes('@');
  const passwordInvalid = touched.password && password.length < 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email.trim().toLowerCase(), password);
      onLoginComplete(user);
    } catch {
      setError('Identifiant ou mot de passe incorrect.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo + Titre */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 64, height: 64, background: 'var(--gold)', color: 'var(--blue)', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', boxShadow: '0 8px 24px rgba(180,83,9,0.3)' }}>U</div>
          <h2 style={{ color: 'white', marginBottom: '0.25rem', fontSize: '1.5rem' }}>{appName}</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem' }}>{universityName} — Portail d'authentification</p>
        </div>

        {/* Carte formulaire */}
        <div className="card slide-up" style={{ padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginBottom: '1rem' }}>
              <span className="label">Adresse e-mail</span>
              <input
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                placeholder="jean.dupont@univ-paris13.fr"
                className={emailInvalid ? 'input-error' : ''}
                style={{ padding: '0.75rem', fontSize: '0.9375rem' }}
                autoFocus
              />
              {emailInvalid && <span className="field-msg field-msg-err">Veuillez saisir une adresse e-mail valide.</span>}
            </div>
            <div className="field" style={{ marginBottom: '1.25rem' }}>
              <span className="label">Mot de passe</span>
              <div style={{ position: 'relative' }}>
                <input
                  required
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, password: true }))}
                  placeholder="••••••••"
                  className={passwordInvalid ? 'input-error' : ''}
                  style={{ padding: '0.75rem', paddingRight: '2.75rem', fontSize: '0.9375rem', width: '100%' }}
                />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  {showPwd
                    ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
              {passwordInvalid && <span className="field-msg field-msg-err">Le mot de passe est requis.</span>}
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-blue"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', justifyContent: 'center', borderRadius: '8px' }}
              disabled={loading || emailInvalid || passwordInvalid}
            >
              {loading
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 0.7s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Connexion…</>
                : 'Se connecter'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <span className="label" style={{ display: 'block', marginBottom: '0.625rem' }}>Comptes de démonstration :</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {[
                { label: 'Admin', email: 'admin@univ.fr' },
                { label: 'Pierre (Config.)', email: 'pierre.durand@univ-paris13.fr' },
                { label: 'Achraf (User)', email: 'achraf.jdidi@univ-paris13.fr' },
                { label: 'Sophie (User)', email: 'sophie.martin@univ-paris13.fr' },
              ].map(a => (
                <button key={a.email} className="tag tag-gray" onClick={() => { setEmail(a.email); setPassword('password'); setTouched({}); setError(''); }} style={{ cursor: 'pointer', border: '1px solid var(--border)', padding: '0.25rem 0.625rem' }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Mot de passe de démo : <code style={{ color: 'rgba(255,255,255,0.5)' }}>password</code>
        </p>
      </div>
    </div>
  );
}
