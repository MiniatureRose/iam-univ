import { useState, createContext, useContext, useCallback } from 'react';

const ConfirmCtx = createContext();

export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  const handleOk = () => { state?.resolve(true); setState(null); };
  const handleCancel = () => { state?.resolve(false); setState(null); };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="card slide-up" style={{ width: 420, padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>⚠️</div>
              <div>
                <h2 style={{ marginBottom: '0.375rem', fontSize: '1rem' }}>Confirmation</h2>
                <p className="sm" style={{ color: 'var(--text-sub)' }}>{state.message}</p>
              </div>
            </div>
            <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={handleCancel}>Annuler</button>
              <button className="btn btn-red" onClick={handleOk}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
