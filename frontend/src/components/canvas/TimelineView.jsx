import React from 'react';

export default function TimelineView({ caseData }) {
  return (
    <div className="timeline-view">
      <div className="timeline-track">
        {caseData.timeline.map((item, i) => (
          <div
            key={i}
            className={`timeline-item ${item.severity} slide-up`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="date">{item.date}</div>
            <div className="title">{item.title}</div>
            {item.note && <div className="note">{item.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
