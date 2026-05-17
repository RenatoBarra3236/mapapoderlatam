import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchEntities } from '../../lib/api';

export default function SearchBar({ t, lang, onPick }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [apiResults, setApiResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function runSearch() {
      if (!debounced) {
        setApiResults([]);
        setSearching(false);
        setUsedFallback(false);
        return;
      }
      setSearching(true);
      try {
        const results = await searchEntities(debounced, { limit: 8 });
        if (!cancelled) {
          setApiResults(results);
          setUsedFallback(results.length > 0 && results.every(r => r.fromDemo));
        }
      } catch {
        if (!cancelled) {
          setApiResults([]);
          setUsedFallback(false);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }
    runSearch();
    return () => { cancelled = true; };
  }, [debounced]);

  const results = useMemo(() => {
    if (!debounced) return [];
    return apiResults;
  }, [apiResults, debounced]);

  const showDropdown = open && (query.length > 0);

  function pick(result) {
    onPick(result);
    setQuery('');
    setOpen(false);
  }

  function riskPillClass(risk) {
    if (risk >= 65) return 'risk-tag';
    if (risk >= 40) return 'risk-tag med';
    return 'risk-tag low';
  }

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search-input-row">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-label={t.searchPlaceholder}
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls="search-results"
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); } }}
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            aria-label={lang === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
            onClick={() => { setQuery(''); setOpen(false); }}
          >✕</button>
        ) : (
          <span className="search-kbd" aria-hidden="true">⌘K</span>
        )}
      </div>

      {showDropdown && (
        <div className="search-dropdown" role="listbox" id="search-results">
          {searching ? (
            <div className="search-section-title">{lang === 'es' ? 'Buscando…' : 'Searching…'}</div>
          ) : results.length === 0 ? (
            <div className="search-section-title">{t.noResults}</div>
          ) : (
            <>
              <div className="search-section-title">
                {usedFallback ? (lang === 'es' ? 'Coincidencias demo' : 'Demo matches') : t.suggested}
              </div>
              {results.map((r, i) => (
                <button key={i} className="search-result" onClick={() => pick(r)}>
                  <span className={`type-dot ${r.type}`} />
                  <span>
                    <div className="name">{r.name}</div>
                    <div className="sub">
                      {r.subtitle}
                      {r.fromDemo && ` · ${lang === 'es' ? 'demo' : 'demo'}`}
                    </div>
                  </span>
                  <span className={`${riskPillClass(r.risk)} risk-pill`}>{r.risk}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
