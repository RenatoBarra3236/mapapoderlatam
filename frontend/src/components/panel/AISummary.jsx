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
  const fetchedRef = useRef(null);

  const entityId = caseData?.rootId || caseData?.center;

  useEffect(() => {
    if (!entityId || fetchedRef.current === `${entityId}-${lang}`) return;
    fetchedRef.current = `${entityId}-${lang}`;

    let cancelled = false;
    setLoading(true);
    setText(null);

    getAISummary(entityId, lang)
      .then(res => {
        if (cancelled) return;
        setText(res.summary);
        setCached(res.cached);
      })
      .catch(() => {
        if (cancelled) return;
        setText(fallbackSummary(caseData, lang));
        setCached(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [entityId, lang]);

  const eyebrow = loading
    ? (lang === 'es' ? 'Generando análisis...' : 'Generating analysis...')
    : cached
      ? (lang === 'es' ? 'Análisis verificado · caché' : 'Verified analysis · cached')
      : (lang === 'es' ? 'Análisis de red generado' : 'Network analysis generated');

  return (
    <div className="section">
      <div className="section-title">{t.aiSummary}</div>
      <div className="ai-summary-card">
        <div className="ai-eyebrow">
          <span className={`pulse-dot${loading ? ' pulse-dot--active' : ''}`} />
          {eyebrow}
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
          <div className="ai-summary-body">{text || fallbackSummary(caseData, lang)}</div>
        )}
      </div>
    </div>
  );
}
