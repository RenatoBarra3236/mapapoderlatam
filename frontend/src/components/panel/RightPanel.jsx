import React from 'react';
import ProfileHead from './ProfileHead';
import AISummary from './AISummary';
import FlagCard from './FlagCard';
import { useAISummary } from '../../hooks/useAISummary';
import { useRuleFlags } from '../../hooks/useRuleFlags';

export default function RightPanel({ caseData, lang, t }) {
  const ai = useAISummary(caseData.id, lang);
  const rules = useRuleFlags(caseData.id, lang);

  // Summary: from AI. Falls back to demo if AI fails.
  const summaryText = ai.data?.summary ?? (ai.error ? caseData.summary[lang] : '');

  // Flags: rule-based (deterministic). Falls back to demo if rules endpoint fails.
  const flags = rules.flags?.length
    ? rules.flags
    : (rules.error ? caseData.flags : []);

  return (
    <aside className="right-panel">
      <ProfileHead caseData={caseData} lang={lang} t={t} />
      <AISummary text={summaryText} lang={lang} t={t} loading={ai.loading} />
      <div className="section">
        <div className="section-title">
          <span>{t.redFlags}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-alert)' }}>
            {rules.loading
              ? (lang === 'es' ? 'detectando…' : 'detecting…')
              : `${flags.length} ${lang === 'es' ? 'detectadas' : 'detected'}`}
          </span>
        </div>
        {rules.loading && <FlagSkeleton />}
        {!rules.loading && flags.map((f, i) => (
          <FlagCard key={f.id || i} flag={f} lang={lang} t={t} index={i} />
        ))}
        {rules.error && !rules.loading && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 8 }}>
            {lang === 'es'
              ? `Reglas no disponibles · datos demo (${rules.error})`
              : `Rules unavailable · demo data (${rules.error})`}
          </div>
        )}
      </div>
    </aside>
  );
}

function FlagSkeleton() {
  return (
    <>
      {[0, 1].map(i => (
        <div key={i} className="flag-card" style={{ opacity: 0.55 }}>
          <div className="head">
            <span className="flag-badge low" style={{ width: 36 }}>…</span>
            <div className="ai-skeleton" style={{ flex: 1 }}><span /></div>
          </div>
          <div className="ai-skeleton"><span /><span /><span style={{ width: '64%' }} /></div>
        </div>
      ))}
    </>
  );
}
