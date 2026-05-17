import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SEARCH_INDEX } from '../../lib/demoData';
import { searchEntities } from '../../lib/api';

export default function SearchBar({ t, lang, onPick }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [apiResults, setApiResults] = useState([]);
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
        return;
      }
      const results = await searchEntities(debounced, { limit: 8 });
      if (!cancelled) setApiResults(results);
    }
    runSearch();
    return () => { cancelled = true; };
  }, [debounced]);

  const results = useMemo(() => {
    if (!debounced) return [];
    if (apiResults.length > 0) return apiResults;
    return SEARCH_INDEX.filter(r =>
      r.name.toLowerCase().includes(debounced) ||
      r.subtitle.toLowerCase().includes(debounced)
    ).slice(0, 8);
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <span className="search-kbd">⌘K</span>
      </div>

      {showDropdown && (
        <div className="search-dropdown">
          {results.length === 0 ? (
            <div className="search-section-title">{t.noResults}</div>
          ) : (
            <>
              <div className="search-section-title">{t.suggested}</div>
              {results.map((r, i) => (
                <button key={i} className="search-result" onClick={() => pick(r)}>
                  <span className={`type-dot ${r.type}`} />
                  <span>
                    <div className="name">{r.name}</div>
                    <div className="sub">{r.subtitle}</div>
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
