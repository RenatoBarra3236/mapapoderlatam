import React from 'react';
import ProfileHead from './ProfileHead';
import AISummary from './AISummary';
import FlagCard from './FlagCard';

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
      </div>
    </aside>
  );
}
