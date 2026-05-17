import React from 'react';
import { DEMO_CASES } from '../../lib/demoData';
import { I18N } from '../../lib/i18n';

const CASE_DESCRIPTIONS = {
  fuentes: {
    es: "Ex-funcionario MOP pasa a dirigir empresa que adjudicó CLP 184.500M durante su gestión.",
    en: "Former Public Works officer joins the board of a firm awarded CLP 184.5B on his watch."
  },
  errazuriz: {
    es: "Diputada vota en contra del royalty minero pese a vínculos familiares con el sector.",
    en: "Deputy votes against the mining royalty despite family ties to the industry."
  },
  losandes: {
    es: "Empresa adjudica contrato CONAF 11 días después de ser constituida.",
    en: "Company awarded CONAF contract 11 days after being incorporated."
  }
};

function riskTag(risk, t) {
  if (risk >= 65) return <span className="risk-tag">{t.severityHigh}</span>;
  if (risk >= 40) return <span className="risk-tag med">{t.severityMedium}</span>;
  return <span className="risk-tag low">{t.severityLow}</span>;
}

export default function EmptyState({ t, lang, onPick }) {
  const cases = Object.values(DEMO_CASES).map(c => ({
    ...c,
    root: c.nodes.find(n => n.id === c.rootId)
  }));

  const title = lang === 'es'
    ? <>DeQuiénes te muestra los datos. <em>Nosotros te decimos qué significan.</em></>
    : <>DeQuiénes shows you the data. <em>We tell you what it means.</em></>;

  const subtitle = lang === 'es'
    ? "La IA detecta conflictos de interés, puertas giratorias y patrones sospechosos en segundos."
    : "AI detects conflicts of interest, revolving doors and suspicious patterns in seconds.";

  const eyebrow = lang === 'es'
    ? "Plataforma de transparencia · LATAM"
    : "Transparency platform · LATAM";

  return (
    <div className="empty fade-in">
      <span className="empty-eyebrow">{eyebrow}</span>
      <h1 className="empty-title">{title}</h1>
      <p className="empty-sub">{subtitle}</p>

      <div className="suggested-grid">
        {cases.map(c => (
          <button key={c.id} className="suggested-case" onClick={() => onPick(c.id)}>
            <span className="label">{I18N[lang].nodeTypes[c.root.type]} · {c.root.country}</span>
            <span className="name">{c.root.name}</span>
            <span className="desc">{CASE_DESCRIPTIONS[c.id][lang]}</span>
            <div className="risk-row">
              <span className="label">{t.riskScore} {c.root.risk}</span>
              {riskTag(c.root.risk, t)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
