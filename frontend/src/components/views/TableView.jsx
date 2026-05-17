export default function TableView({ edges, nodes, language = 'es' }) {
  if (!edges || edges.length === 0) {
    return <div style={{ padding: '32px', textAlign: 'center', opacity: 0.5 }}>No hay relaciones</div>;
  }

  const getNodeName = (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    return node?.name || `Node ${nodeId}`;
  };

  return (
    <div style={{ overflowX: 'auto', padding: '24px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid var(--border)` }}>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', opacity: 0.7, fontWeight: '600' }}>
              DESDE
            </th>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', opacity: 0.7, fontWeight: '600' }}>
              RELACIÓN
            </th>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '12px', opacity: 0.7, fontWeight: '600' }}>
              HACIA
            </th>
            <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '12px', opacity: 0.7, fontWeight: '600' }}>
              MAGNITUD
            </th>
            <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: '12px', opacity: 0.7, fontWeight: '600' }}>
              MARCADA
            </th>
          </tr>
        </thead>
        <tbody>
          {edges.map((edge, idx) => (
            <tr key={idx} style={{ borderBottom: `1px solid var(--border)` }}>
              <td style={{ padding: '12px 8px', fontSize: '13px' }}>{getNodeName(edge.source_id || edge.s)}</td>
              <td style={{ padding: '12px 8px', fontSize: '13px', opacity: 0.7 }}>{edge.label || edge.type}</td>
              <td style={{ padding: '12px 8px', fontSize: '13px' }}>{getNodeName(edge.target_id || edge.t)}</td>
              <td style={{ padding: '12px 8px', fontSize: '13px', textAlign: 'center', opacity: 0.7 }}>
                {edge.weight ? edge.weight.toFixed(2) : '—'}
              </td>
              <td style={{ padding: '12px 8px', fontSize: '13px', textAlign: 'center' }}>
                {edge.flag ? '🚩' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
