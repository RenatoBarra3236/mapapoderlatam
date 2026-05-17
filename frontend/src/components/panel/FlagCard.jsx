import React from 'react';

export default function FlagCard({ flag, lang, t, index }) {
  const label = flag.severity === 'high' ? t.severityHigh : flag.severity === 'medium' ? t.severityMedium : t.severityLow;
  return (
    <div className="flag-card slide-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="head">
        <span className={`flag-badge ${flag.severity}`}>{label}</span>
        <div className="flag-title">{flag.title[lang]}</div>
      </div>
      <div className="flag-evidence">{flag.evidence[lang]}</div>
      <a className="flag-source" href={flag.source.url} onClick={e => e.preventDefault()}>
        ↗ {flag.source.label}
      </a>
    </div>
  );
}
