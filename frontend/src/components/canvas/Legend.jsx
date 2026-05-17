import React from 'react';

export default function Legend({ lang, showChord }) {
  const labels = lang === 'es'
    ? { person: 'Persona', company: 'Empresa', contract: 'Contrato', flag: 'Vínculo marcado', chord: 'Vínculo cruzado' }
    : { person: 'Person', company: 'Company', contract: 'Contract', flag: 'Flagged tie', chord: 'Cross link' };
  return (
    <div className="graph-legend">
      <span><span className="type-dot person" />{labels.person}</span>
      <span><span className="type-dot company" />{labels.company}</span>
      <span><span className="type-dot contract" />{labels.contract}</span>
      {showChord && (
        <span style={{ borderLeft: '1px solid var(--line)', paddingLeft: 10 }}>
          <span style={{ display: 'inline-block', width: 14, height: 1, background: 'var(--ink-3)', borderTop: '1px dotted var(--ink-3)', marginRight: 4 }} />
          {labels.chord}
        </span>
      )}
      <span style={{ color: 'var(--c-alert)', paddingLeft: showChord ? 0 : 10, borderLeft: showChord ? 'none' : '1px solid var(--line)' }}>
        <span style={{ display: 'inline-block', width: 14, height: 1, background: 'var(--c-alert)', borderTop: '1px dashed', marginRight: 4 }} />
        {labels.flag}
      </span>
    </div>
  );
}
