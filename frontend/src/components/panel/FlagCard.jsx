import React from 'react';

// `flag` may come from the AI (title/evidence as strings) or from the demo
// fallback (title/evidence as { es, en }). Resolve uniformly.
function pick(value, lang) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.es || value.en || '';
}

export default function FlagCard({ flag, lang, t, index }) {
  const label = flag.severity === 'high' ? t.severityHigh
    : flag.severity === 'medium' ? t.severityMedium
    : t.severityLow;
  return (
    <div className="flag-card slide-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="head">
        <span className={`flag-badge ${flag.severity}`}>{label}</span>
        <div className="flag-title">{pick(flag.title, lang)}</div>
      </div>
      <div className="flag-evidence">{pick(flag.evidence, lang)}</div>
      <a className="flag-source" href={flag.source?.url || '#'} onClick={e => e.preventDefault()}>
        ↗ {flag.source?.label || 'Fuente'}
      </a>
    </div>
  );
}
