import { useState, useRef, useEffect } from 'react';
import { useSearch } from '../../hooks/useSearch';

const TYPE_LABELS = {
  person:   { label: 'Persona',  color: 'bg-purple-900 text-purple-200' },
  company:  { label: 'Empresa',  color: 'bg-teal-900 text-teal-200' },
  contract: { label: 'Contrato', color: 'bg-orange-900 text-orange-200' },
};

export default function SearchBar({ onSelect }) {
  const [query,    setQuery]    = useState('');
  const [open,     setOpen]     = useState(false);
  const { results, loading }    = useSearch(query);
  const wrapperRef              = useRef(null);

  // Cerrar dropdown al hacer clic afuera
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
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Busca un funcionario, empresa o contrato..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        {loading && (
          <span className="absolute right-3 top-2.5 text-xs text-gray-500">Buscando…</span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
          {results.map((node) => {
            const t = TYPE_LABELS[node.type] || TYPE_LABELS.person;
            return (
              <li
                key={node.id}
                onClick={() => handleSelect(node)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 cursor-pointer"
              >
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${t.color}`}>
                  {t.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 truncate">{node.name}</p>
                  {node.metadata?.role && (
                    <p className="text-xs text-gray-500 truncate">{node.metadata.role}</p>
                  )}
                </div>
                {node.risk_score > 0 && (
                  <span className="text-xs text-gray-500 shrink-0">
                    {node.risk_score} conexiones
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
