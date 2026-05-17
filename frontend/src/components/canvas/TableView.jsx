import React from 'react';
import { I18N, RELATION_LABELS } from '../../lib/i18n';

export default function TableView({ caseData, lang }) {
  const t = I18N[lang];
  const labels = RELATION_LABELS[lang];
  const nodeById = Object.fromEntries(caseData.nodes.map(n => [n.id, n]));
  const edges = caseData.edges.filter(e => nodeById[e.s] && nodeById[e.t]);

  return (
    <div className="table-view">
      <table className="rel-table">
        <thead>
          <tr>
            <th>{t.from}</th>
            <th>{t.relation}</th>
            <th>{t.to}</th>
            <th>{t.weight}</th>
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
                    <span className={`type-dot ${s.type}`} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{s.name}</div>
                      {s.subtitle && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{s.subtitle}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`rel-type ${e.flag ? 'flag' : ''}`}>{labels[e.type] || e.type}</span>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>{e.label}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`type-dot ${tgt.type}`} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{tgt.name}</div>
                      {tgt.subtitle && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{tgt.subtitle}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.weight}</td>
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
