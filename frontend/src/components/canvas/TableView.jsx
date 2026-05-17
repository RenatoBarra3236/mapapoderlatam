import React from 'react';
import { I18N, RELATION_LABELS } from '../../lib/i18n';

export default function TableView({ caseData, lang }) {
  const t = I18N[lang];
  const labels = RELATION_LABELS[lang];
  const nodeById = Object.fromEntries(caseData.nodes.map(n => [n.id, n]));
  const sourceById = Object.fromEntries((caseData.sources || []).map(s => [String(s.id), s]));
  const edges = caseData.edges.filter(e => nodeById[e.s] && nodeById[e.t]);

  if (!edges.length) {
    return (
      <div className="table-view">
        <div className="empty-panel-note">
          {lang === 'es'
            ? 'No hay relaciones registradas para mostrar en esta red.'
            : 'No relationships found to display for this network.'}
        </div>
      </div>
    );
  }

  return (
    <div className="table-view">
      <table className="rel-table">
        <thead>
          <tr>
            <th>{t.from}</th>
            <th>{t.relation}</th>
            <th>{t.to}</th>
            <th>{t.weight}</th>
            <th>{lang === 'es' ? 'Confianza' : 'Confidence'}</th>
            <th>{lang === 'es' ? 'Fuente' : 'Source'}</th>
            <th>{t.flagged}</th>
          </tr>
        </thead>
        <tbody>
          {edges.map((e, i) => {
            const s = nodeById[e.s];
            const tgt = nodeById[e.t];
            return (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`type-dot ${s.type}`} aria-hidden="true" />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }} title={s.name}>{s.name}</div>
                      {s.subtitle && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }} title={s.subtitle}>{s.subtitle}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`rel-type ${e.flag ? 'flag' : ''}`}>{e.labelI18n?.[lang] || labels[e.type] || e.type}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`type-dot ${tgt.type}`} aria-hidden="true" />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }} title={tgt.name}>{tgt.name}</div>
                      {tgt.subtitle && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }} title={tgt.subtitle}>{tgt.subtitle}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.weight}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {Math.round((e.confidenceScore ?? 1) * 100)}%
                </td>
                <td>
                  {(() => {
                    const source = e.sourceId ? sourceById[String(e.sourceId)] : null;
                    if (!source) return <span style={{ color: 'var(--ink-3)' }}>—</span>;
                    return source.url
                      ? <a className="table-source-link" href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                      : <span className="table-source-link">{source.label}</span>;
                  })()}
                </td>
                <td>
                  {e.flag
                    ? <span className="flag-chip">● {t.flagged}</span>
                    : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
