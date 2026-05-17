import React from 'react';

const TAB_KEYS = ['neural', 'orbit', 'timeline', 'table'];

const TAB_LABELS = {
  es: { neural: 'Red Neuronal', orbit: 'Órbitas', timeline: 'Línea de tiempo', table: 'Tabla' },
  en: { neural: 'Neural Net', orbit: 'Orbits', timeline: 'Timeline', table: 'Table' }
};

export default function CanvasTabs({ view, setView, lang, caseData }) {
  const labels = TAB_LABELS[lang];
  const meta = lang === 'es'
    ? { nodes: 'nodos', edges: 'vínculos', flags: 'marcados' }
    : { nodes: 'nodes', edges: 'edges', flags: 'flagged' };
  const flagged = caseData.edges.filter(e => e.flag).length;

  return (
    <div className="canvas-tabs">
      <div className="tabs-group">
        {TAB_KEYS.map(k => (
          <button
            key={k}
            className={`tab-btn ${view === k ? 'active' : ''}`}
            onClick={() => setView(k)}
          >
            {labels[k]}
          </button>
        ))}
      </div>
      <div className="canvas-meta">
        <span><strong>{caseData.nodes.length}</strong> {meta.nodes}</span>
        <span className="divider-dot">·</span>
        <span><strong>{caseData.edges.length}</strong> {meta.edges}</span>
        {flagged > 0 && (
          <>
            <span className="divider-dot">·</span>
            <span style={{ color: 'var(--c-alert)' }}><strong>{flagged}</strong> {meta.flags}</span>
          </>
        )}
      </div>
    </div>
  );
}
