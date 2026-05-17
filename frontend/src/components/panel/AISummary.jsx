import React from 'react';

export default function AISummary({ caseData, lang, t }) {
  const summary = typeof caseData.summary === 'string'
    ? caseData.summary
    : caseData.summary?.[lang] || caseData.summary?.es || caseData.summary?.en || '';

  return (
    <div className="section">
      <div className="section-title">{t.aiSummary}</div>
      <div className="ai-summary-card">
        <div className="ai-eyebrow">
          <span className="pulse-dot" />
          {caseData.fromApi
            ? (lang === 'es' ? 'Resumen estructurado' : 'Structured summary')
            : (lang === 'es' ? 'Análisis generado' : 'Generated analysis')}
        </div>
        <div className="ai-summary-body">{summary}</div>
      </div>
    </div>
  );
}
