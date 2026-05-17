import React from 'react';

export default function AISummary({ text, lang, t, loading }) {
  return (
    <div className="section">
      <div className="section-title">{t.aiSummary}</div>
      <div className="ai-summary-card">
        <div className="ai-eyebrow">
          <span className="pulse-dot" />
          {lang === 'es'
            ? (loading ? 'Analizando con Claude…' : 'Análisis generado')
            : (loading ? 'Analyzing with Claude…' : 'Generated analysis')}
        </div>
        <div className="ai-summary-body">
          {loading ? <SummarySkeleton /> : text}
        </div>
      </div>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="ai-skeleton">
      <span /><span /><span /><span style={{ width: '72%' }} />
    </div>
  );
}
