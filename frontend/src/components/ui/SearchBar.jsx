import { useState, useRef, useEffect } from 'react';
import { useSearch } from '../../hooks/useSearch';

const TYPE_LABELS = {
  person: { label: 'Persona', emoji: '👤' },
  company: { label: 'Empresa', emoji: '🏢' },
  contract: { label: 'Contrato', emoji: '📋' },
};

export default function SearchBar({ onSelect, language = 'es' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, loading } = useSearch(query);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (node) => {
    setQuery(node.name);
    setOpen(false);
    onSelect?.(node);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Buscar persona, empresa, RUT o contrato..."
          style={{
            width: '100%',
            padding: '10px 16px',
            fontSize: '14px',
            border: `1px solid var(--border)`,
            borderRadius: '24px',
            backgroundColor: 'var(--bg)',
            color: 'var(--ink)',
            outline: 'none',
          }}
          onFocus={(e) => {
            if (results.length > 0) setOpen(true);
            e.target.style.borderColor = 'var(--c-person)';
          }}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
        {loading && (
          <span style={{ position: 'absolute', right: '16px', top: '10px', fontSize: '12px', opacity: 0.5 }}>
            🔍
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            zIndex: 50,
            marginTop: '8px',
            width: '100%',
            backgroundColor: 'var(--bg)',
            border: `1px solid var(--border)`,
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <li style={{ padding: '8px 16px', fontSize: '11px', opacity: 0.5, fontWeight: '600' }}>
            CASOS SUGERIDOS
          </li>
          {results.map((node) => {
            const t = TYPE_LABELS[node.type] || TYPE_LABELS.person;
            return (
              <li
                key={`${node.caseId}-${node.id}`}
                onClick={() => handleSelect(node)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: `1px solid var(--border)`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '14px' }}>{t.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: '500' }}>{node.name}</p>
                  {node.subtitle && (
                    <p style={{ fontSize: '11px', opacity: 0.6 }}>{node.subtitle}</p>
                  )}
                </div>
                {node.risk && (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--c-alert)' }}>
                    {node.risk}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
