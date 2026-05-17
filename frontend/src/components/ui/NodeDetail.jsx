export default function NodeDetail({ node, caseData, language = 'es' }) {
  if (!node) return null;

  const typeLabels = {
    person: { label: 'PERSONA', color: '#534ab7' },
    company: { label: 'EMPRESA', color: '#0f6e56' },
    contract: { label: 'CONTRATO', color: '#993c1d' },
  };

  const typeLabel = typeLabels[node.type] || typeLabels.person;
  const relevantFlags = caseData?.flags || [];
  const riskLevel = node.risk || 0;
  const riskLabel = riskLevel >= 70 ? 'ALTO' : riskLevel >= 40 ? 'MEDIO' : 'BAJO';
  const riskColor = riskLevel >= 70 ? '#a32d2d' : riskLevel >= 40 ? '#d97706' : '#6b7280';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <p style={{ fontSize: '11px', opacity: 0.6, letterSpacing: '0.1em', marginBottom: '4px' }}>
          {typeLabel.label} • {node.country || 'CL'}
        </p>
        <h2 style={{ fontFamily: 'Source Serif 4', fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>
          {node.name}
        </h2>
        {node.subtitle && (
          <p style={{ fontSize: '13px', opacity: 0.7 }}>
            {node.subtitle}
          </p>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ padding: '16px', border: `1px solid var(--border)`, borderRadius: '6px' }}>
          <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '8px' }}>RIESGO</p>
          <p style={{ fontSize: '28px', fontWeight: '600', color: riskColor, marginBottom: '4px' }}>
            {riskLevel}
          </p>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '3px',
              backgroundColor: riskColor + '20',
              color: riskColor,
            }}
          >
            {riskLabel}
          </span>
        </div>

        <div style={{ padding: '16px', border: `1px solid var(--border)`, borderRadius: '6px' }}>
          <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '8px' }}>CONEXIONES</p>
          <p style={{ fontSize: '28px', fontWeight: '600' }}>
            {caseData?.edges?.filter((e) => e.s === node.id || e.t === node.id)?.length || 0}
          </p>
        </div>
      </div>

      {/* Relaciones marcadas */}
      {caseData && (
        <div style={{ padding: '16px', border: `1px solid var(--border)`, borderRadius: '6px' }}>
          <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '8px' }}>RELACIONES MARCADAS</p>
          <p style={{ fontSize: '16px', fontWeight: '600' }}>
            {caseData.edges?.filter((e) => e.flag)?.length || 0} / {caseData.edges?.length || 0}
          </p>
        </div>
      )}

      {/* Summary */}
      {caseData?.summary && (
        <div style={{ paddingLeft: '16px', borderLeft: `4px solid var(--c-person)` }}>
          <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '8px', fontWeight: '600' }}>RESUMEN IA</p>
          <p style={{ fontSize: '12px', lineHeight: '1.6', opacity: 0.85 }}>
            • {language === 'es' ? 'ANÁLISIS GENERADO' : 'GENERATED ANALYSIS'}
          </p>
          <p style={{ fontSize: '13px', lineHeight: '1.6', marginTop: '8px' }}>
            {caseData.summary[language] || caseData.summary.es}
          </p>
        </div>
      )}

      {/* Red Flags */}
      {relevantFlags.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '12px', fontWeight: '600' }}>
            BANDERAS ROJAS • {relevantFlags.filter((f) => f.severity === 'high').length} DETECTADAS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {relevantFlags.map((flag) => {
              const severityColor = {
                high: { bg: '#fee2e2', text: '#991b1b', label: 'ALTA' },
                medium: { bg: '#fed7aa', text: '#92400e', label: 'MEDIA' },
                low: { bg: '#f3f4f6', text: '#4b5563', label: 'BAJA' },
              }[flag.severity];

              return (
                <div
                  key={flag.id}
                  style={{
                    padding: '16px',
                    border: `1px solid`,
                    borderColor: severityColor.text + '40',
                    borderRadius: '6px',
                    backgroundColor: severityColor.bg,
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '3px 6px',
                        borderRadius: '3px',
                        backgroundColor: severityColor.text,
                        color: severityColor.bg,
                        fontWeight: '600',
                      }}
                    >
                      {severityColor.label}
                    </span>
                  </div>
                  <p style={{ fontWeight: '600', fontSize: '13px', color: severityColor.text, marginBottom: '4px' }}>
                    {flag.title[language] || flag.title.es}
                  </p>
                  <p style={{ fontSize: '12px', color: severityColor.text, opacity: 0.9, lineHeight: '1.5' }}>
                    {flag.evidence[language] || flag.evidence.es}
                  </p>
                  {flag.source && (
                    <p style={{ fontSize: '11px', marginTop: '8px', opacity: 0.7 }}>
                      📄 {flag.source.label}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
