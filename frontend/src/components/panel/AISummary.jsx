import React, { useEffect, useRef, useState } from 'react';
import { getAISummary } from '../../lib/api';

function fallbackSummary(caseData, lang) {
  const summary = typeof caseData.summary === 'string'
    ? caseData.summary
    : caseData.summary?.[lang] || caseData.summary?.es || caseData.summary?.en || '';
  return summary;
}

export default function AISummary({ caseData, lang, t }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);
  const [provider, setProvider] = useState(null);
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(null);

  const entityId = caseData?.rootId || caseData?.center;

  function loadSummary(refresh = false) {
    if (!entityId) return () => {};
    const key = `${entityId}-${lang}`;
    if (!refresh && fetchedRef.current === key) return () => {};
    fetchedRef.current = key;

    let cancelled = false;
    setLoading(true);
    setText(null);
    setError(null);

    getAISummary(entityId, lang, { refresh })
      .then(res => {
        if (cancelled) return;
        setText(res.summary);
        setCached(res.cached);
        setProvider(res.provider || null);
        setModel(res.model || null);
      })
      .catch(err => {
        if (cancelled) return;
        setText(fallbackSummary(caseData, lang));
        setCached(false);
        setProvider(null);
        setModel(null);
        setError(err?.message || (lang === 'es' ? 'La IA no respondió.' : 'AI did not respond.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }

  useEffect(() => {
    return loadSummary(false);
  }, [entityId, lang]);

  const eyebrow = loading
    ? (lang === 'es' ? 'Generando análisis...' : 'Generating analysis...')
    : error
      ? (lang === 'es' ? 'Resumen local · IA no disponible' : 'Local summary · AI unavailable')
      : cached
      ? (lang === 'es' ? 'Análisis verificado · caché' : 'Verified analysis · cached')
      : provider && model
        ? `${provider} · ${model}`
        : (lang === 'es' ? 'Análisis de red generado' : 'Network analysis generated');

  return (
    <div className="section">
      <div className="section-title">{t.aiSummary}</div>
      <div className="ai-summary-card">
        <div className="ai-eyebrow">
          <span className={`pulse-dot${loading ? ' pulse-dot--active' : ''}`} />
          {eyebrow}
          {!loading && (
            <button
              type="button"
              className="ai-refresh"
              onClick={() => loadSummary(true)}
              title={lang === 'es' ? 'Regenerar análisis' : 'Regenerate analysis'}
            >
              ↻
            </button>
          )}
        </div>
        {loading ? (
          <div className="ai-summary-skeleton" aria-busy="true" aria-label={lang === 'es' ? 'Cargando resumen' : 'Loading summary'}>
            <div className="skeleton-line skeleton-line--wide" />
            <div className="skeleton-line skeleton-line--full" />
            <div className="skeleton-line skeleton-line--full" />
            <div className="skeleton-line skeleton-line--mid" />
            <div className="skeleton-line skeleton-line--full" />
            <div className="skeleton-line skeleton-line--narrow" />
          </div>
        ) : (
          <>
            {error && <div className="ai-error">{error}</div>}
            <div className="ai-summary-body">{text || fallbackSummary(caseData, lang)}</div>
          </>
        )}
      </div>
    </div>
  );
}
