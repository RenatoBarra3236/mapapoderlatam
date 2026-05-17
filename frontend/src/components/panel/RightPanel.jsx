import React from 'react';
import ProfileHead from './ProfileHead';
import AISummary from './AISummary';
import FlagCard from './FlagCard';

function SourceList({ sources, lang, t }) {
  if (!sources?.length) return null;
  return (
    <div className="section">
      <div className="section-title">
        <span>{lang === 'es' ? 'Fuentes' : 'Sources'}</span>
        <span>{sources.length}</span>
      </div>
      <div className="source-list">
        {sources.slice(0, 8).map(source => (
          <div className="source-row" key={source.id}>
            <div className="source-main">
              <span className="source-label">{source.label}</span>
              {source.type && <span className="source-type">{source.type}</span>}
            </div>
            <div className="source-meta">
              {source.fetchedAt && <span>{source.fetchedAt.slice(0, 10)}</span>}
              {source.license && <span>{source.license}</span>}
            </div>
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer" className="flag-source">
                ↗ {lang === 'es' ? 'Ver fuente' : 'View source'}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RightPanel({ caseData, lang, t }) {
  return (
    <aside className="right-panel">
      <ProfileHead caseData={caseData} lang={lang} t={t} />
      <AISummary caseData={caseData} lang={lang} t={t} />
      <div className="section">
        <div className="section-title">
          <span>{t.redFlags}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-alert)' }}>
            {caseData.flags.length} {lang === 'es' ? 'detectadas' : 'detected'}
          </span>
        </div>
        {caseData.flags.map((f, i) => (
          <FlagCard key={f.id} flag={f} lang={lang} t={t} index={i} />
        ))}
        {caseData.flags.length === 0 && (
          <div className="empty-panel-note">
            {lang === 'es'
              ? 'No hay banderas de riesgo registradas para esta red.'
              : 'No risk flags are registered for this network.'}
          </div>
        )}
      </div>
      <SourceList sources={caseData.sources} lang={lang} t={t} />
    </aside>
  );
}
