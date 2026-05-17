import React from 'react';

export default function FlagCard({ flag, lang, t, index }) {
  const label = flag.severity === 'high' ? t.severityHigh : flag.severity === 'medium' ? t.severityMedium : t.severityLow;
  const title = typeof flag.title === 'string' ? flag.title : flag.title?.[lang] || flag.title?.es || '';
  const evidence = typeof flag.evidence === 'string' ? flag.evidence : flag.evidence?.[lang] || flag.evidence?.es || '';
  const source = flag.source || {};
  const hasUrl = source.url && source.url !== '#';
  return (
    <div className="flag-card slide-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="head">
        <span className={`flag-badge ${flag.severity}`}>{label}</span>
        <div className="flag-title">{title}</div>
      </div>
      <div className="flag-evidence">{evidence}</div>
      <a
        className="flag-source"
        href={hasUrl ? source.url : '#'}
        target={hasUrl ? '_blank' : undefined}
        rel={hasUrl ? 'noreferrer' : undefined}
        onClick={hasUrl ? undefined : e => e.preventDefault()}
      >
        ↗ {source.label || t.sources}
      </a>
    </div>
  );
}
