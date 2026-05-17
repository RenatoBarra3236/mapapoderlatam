import React from 'react';
import { I18N } from '../../lib/i18n';
import { formatDate } from '../../lib/formatters';

export default function TimelineView({ caseData, lang = 'es' }) {
  const t = I18N[lang];
  if (!caseData?.timeline?.length) {
    return (
      <div className="timeline-view">
        <div className="empty-panel-note">{t.noTimeline}</div>
      </div>
    );
  }

  return (
    <div className="timeline-view">
      <div className="timeline-track">
        {caseData.timeline.map((item, i) => (
          <div
            key={i}
            className={`timeline-item ${item.severity} slide-up`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="date">{formatDate(item.date, lang) || item.date}</div>
            <div className="title">{item.title}</div>
            {item.note && <div className="note">{item.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
