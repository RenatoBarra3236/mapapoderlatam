import React, { useEffect, useState } from 'react';
import { getCases } from '../../lib/api';
import { I18N } from '../../lib/i18n';

function riskTag(risk, t) {
  if (risk >= 65) return <span className="risk-tag">{t.severityHigh}</span>;
  if (risk >= 40) return <span className="risk-tag med">{t.severityMedium}</span>;
  return <span className="risk-tag low">{t.severityLow}</span>;
}

export default function EmptyState({ t, lang, onPick, status, hideSuggestions = false }) {
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);

  useEffect(() => {
    if (hideSuggestions) return;
    let cancelled = false;
    async function loadCases() {
      setLoadingCases(true);
      try {
        const nextCases = await getCases();
        if (!cancelled) setCases(nextCases);
      } catch {
        if (!cancelled) setCases([]);
      } finally {
        if (!cancelled) setLoadingCases(false);
      }
    }
    loadCases();
    return () => { cancelled = true; };
  }, [hideSuggestions]);

  const title = lang === 'es'
    ? <>DeQuiénes te muestra los datos. <em>Nosotros te decimos qué significan.</em></>
    : <>DeQuiénes shows you the data. <em>We tell you what it means.</em></>;

  const subtitle = lang === 'es'
    ? "La IA detecta conflictos de interés, puertas giratorias y patrones sospechosos en segundos."
    : "AI detects conflicts of interest, revolving doors and suspicious patterns in seconds.";

  const eyebrow = lang === 'es'
    ? "Plataforma de transparencia · LATAM"
    : "Transparency platform · LATAM";

  return (
    <div className="empty fade-in">
      <span className="empty-eyebrow">{eyebrow}</span>
      <h1 className="empty-title">{title}</h1>
      <p className="empty-sub">{status || subtitle}</p>

      {!hideSuggestions && cases.length > 0 && (
        <div className="suggested-grid">
          {cases.map(c => (
            <button key={c.id} className="suggested-case" onClick={() => onPick(c)}>
              <span className="label">
                {c.typeLabel?.[lang] || I18N[lang].nodeTypes[c.rawType] || I18N[lang].nodeTypes[c.type] || c.type} · {c.country}
              </span>
              <span className="name">{c.name}</span>
              <span className="desc">{c.description || c.subtitle}</span>
              <div className="risk-row">
                <span className="label">{t.riskScore} {c.risk}</span>
                {riskTag(c.risk, t)}
              </div>
              <span className={`data-chip ${c.fromDemo ? 'demo' : 'api'}`}>
                {c.fromDemo ? t.usingDemo : t.usingBackend}
              </span>
            </button>
          ))}
        </div>
      )}

      {!hideSuggestions && loadingCases && (
        <div className="search-section-title">{lang === 'es' ? 'Cargando casos…' : 'Loading cases…'}</div>
      )}
    </div>
  );
}
