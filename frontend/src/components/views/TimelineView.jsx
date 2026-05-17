export default function TimelineView({ timeline, language = 'es' }) {
  if (!timeline || timeline.length === 0) {
    return <div style={{ padding: '32px', textAlign: 'center', opacity: 0.5 }}>No hay eventos</div>;
  }

  const severityColors = {
    info: '#6b7280',
    warn: '#d97706',
    high: '#a32d2d',
  };

  return (
    <div style={{ padding: '32px', paddingLeft: '80px' }}>
      {timeline.map((event, idx) => (
        <div key={idx} style={{ marginBottom: '32px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '-40px', top: '2px' }}>
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: severityColors[event.severity] || '#999',
                border: '2px solid var(--bg)',
              }}
            />
          </div>
          <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>{event.date}</p>
          <p style={{ fontFamily: 'Source Serif 4', fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            {event.title}
          </p>
          {event.note && <p style={{ fontSize: '13px', opacity: 0.7 }}>{event.note}</p>}
        </div>
      ))}
    </div>
  );
}
