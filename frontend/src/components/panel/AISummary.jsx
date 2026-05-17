import React from 'react';

export default function AISummary({ caseData, lang, t }) {
  return (
    <div className="section">
      <div className="section-title">{t.aiSummary}</div>
      <div className="ai-summary-card">
        <div className="ai-eyebrow">
          <span className="pulse-dot" />
          {lang === 'es' ? 'Análisis generado' : 'Generated analysis'}
        </div>
        <div className="ai-summary-body">{caseData.summary[lang]}</div>
      </div>
    </div>
  );
}
