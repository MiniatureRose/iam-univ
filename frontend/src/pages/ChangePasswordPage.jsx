import { useState } from 'react';
import { changePassword, logout } from '../services/api';

const EyeIcon = ({ open }) => open
  ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
  : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;

function strength(pwd) {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8)  s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
}

const STRENGTH_LABEL = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'];
const STRENGTH_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

// Defined outside the component so React never sees it as a new type on re-render
const PwdField = ({ label, value, onChange, field, error: fieldError, hint, show, setShow, setTouched }) => (
  <div className="field">
    <span className="label">{label}</span>
    <div style={{ position: 'relative' }}>
      <input
        required
        type={show[field] ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTouched(t => ({ ...t, [field]: true }))}
        placeholder="••••••••"
        className={fieldError ? 'input-error' : ''}
        style={{ padding: '0.75rem', paddingRight: '2.75rem', fontSize: '0.9375rem', width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
      >
        <EyeIcon open={show[field]} />
      </button>
    </div>
    {fieldError && <span className="field-msg field-msg-err">{hint}</span>}
  </div>
);

export default function ChangePasswordPage({ currentUser, onSuccess, appConfig = {} }) {
  const appName = appConfig.appName || 'IAM';
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [show, setShow]         = useState({ current: false, next: false, confirm: false });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [touched, setTouched]   = useState({});

  const pwdStrength = strength(next);
  const mismatch    = touched.confirm && confirm.length > 0 && next !== confirm;
  const tooShort    = touched.next && next.length > 0 && next.length < 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (next !== confirm)  { setError('Les mots de passe ne correspondent pas.'); return; }
    if (next.length < 8)   { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setLoading(true);
    try {
      await changePassword(current, next);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Mot de passe temporaire incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64, background: 'var(--gold)', color: 'var(--blue)',
            borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem',
            boxShadow: '0 8px 24px rgba(180,83,9,0.3)'
          }}>
            🔐
          </div>
          <h2 style={{ color: 'white', marginBottom: '0.25rem', fontSize: '1.5rem' }}>Première connexion</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem' }}>
            {appName} — Définissez votre mot de passe personnel
          </p>
        </div>

        <div className="card slide-up" style={{ padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

          {/* Alerte info */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: '#1e40af', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0, marginTop: 1 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Votre compte a été créé avec un mot de passe temporaire. Veuillez en définir un nouveau avant de continuer.
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <PwdField
              field="current"
              label="Mot de passe temporaire"
              value={current}
              onChange={setCurrent}
              error={touched.current && !current}
              hint="Ce champ est requis."
              show={show} setShow={setShow} setTouched={setTouched}
            />

            <div>
              <PwdField
                field="next"
                label="Nouveau mot de passe"
                value={next}
                onChange={setNext}
                error={tooShort}
                hint="Au moins 8 caractères requis."
                show={show} setShow={setShow} setTouched={setTouched}
              />
              {/* Barre de force */}
              {next.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '0.25rem' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: i <= pwdStrength ? STRENGTH_COLOR[pwdStrength] : '#e5e7eb',
                        transition: 'background 0.25s'
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: STRENGTH_COLOR[pwdStrength], fontWeight: 600 }}>
                    {STRENGTH_LABEL[pwdStrength]}
                  </span>
                </div>
              )}
            </div>

            <PwdField
              field="confirm"
              label="Confirmer le nouveau mot de passe"
              value={confirm}
              onChange={setConfirm}
              error={mismatch}
              hint="Les mots de passe ne correspondent pas."
              show={show} setShow={setShow} setTouched={setTouched}
            />

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, padding: '0.625rem 0.875rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                type="submit"
                className="btn btn-blue"
                disabled={loading || !current || next.length < 8 || next !== confirm}
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.9375rem', justifyContent: 'center', borderRadius: 8 }}
              >
                {loading
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 0.7s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Enregistrement…</>
                  : 'Définir mon mot de passe'}
              </button>
              <button type="button" className="btn btn-outline" onClick={logout} style={{ padding: '0.75rem', borderRadius: 8 }}>
                Déconnexion
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          {currentUser?.firstName} {currentUser?.lastName} · {currentUser?.primaryEmail}
        </p>
      </div>
    </div>
  );
}
