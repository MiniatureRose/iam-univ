import { useState, useEffect, useRef } from 'react';
import { fetchAllSnapshots } from '../../services/api';

export default function SearchSelect({ value, onChange, placeholder = "Rechercher..." }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { if (!value) setSelectedName(''); }, [value]);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchAllSnapshots(query, 0, 10);
        setResults(data.content || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (identity) => {
    setSelectedName(`${identity.firstName} ${identity.lastName}`);
    setQuery('');
    setOpen(false);
    onChange(identity.id);
  };

  return (
    <div className="search-select" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={open ? query : selectedName}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          placeholder={selectedName || placeholder}
          style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
        {loading && <div className="spinner-xs" style={{ position: 'absolute', right: '10px', top: '10px' }}></div>}
      </div>

      {open && (results.length > 0 || query.length >= 2) && (
        <div className="card fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '5px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          {results.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              {loading ? 'Recherche...' : 'Aucun résultat'}
            </div>
          ) : results.map(snap => (
            <div
              key={snap.identity.id}
              style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
              onClick={() => handleSelect(snap.identity)}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{snap.identity.firstName} {snap.identity.lastName}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{snap.identity.primaryEmail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
