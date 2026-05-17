// Timeline & Table views

function TimelineView({ caseData, lang }) {
  return (
    <div className="timeline-view">
      <div className="timeline-track">
        {caseData.timeline.map((item, i) => (
          <div key={i} className={`timeline-item ${item.severity}`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="date">{item.date}</div>
            <div className="title">{item.title}</div>
            {item.note && <div className="note">{item.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableView({ caseData, lang }) {
  const t = window.I18N[lang];
  const labels = window.RELATION_LABELS[lang];
  const nodeById = Object.fromEntries(caseData.nodes.map(n => [n.id, n]));

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
          {caseData.edges.map((e, i) => {
            const s = nodeById[e.s];
            const tgt = nodeById[e.t];
            return (
              <tr key={i}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`type-dot ${s.type}`} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{s.name}</div>
                      {s.subtitle && <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{s.subtitle}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`rel-type ${e.flag ? "flag" : ""}`}>{labels[e.type] || e.type}</span>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>{e.label}</div>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`type-dot ${tgt.type}`} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{tgt.name}</div>
                      {tgt.subtitle && <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{tgt.subtitle}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{e.weight}</td>
                <td>{e.flag ? <span className="flag-chip">â {t.flagged}</span> : <span style={{ color: "var(--ink-3)" }}>â</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

window.TimelineView = TimelineView;
window.TableView = TableView;
