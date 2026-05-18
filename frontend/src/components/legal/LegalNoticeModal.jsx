import React, { useEffect, useRef } from 'react';

const CONTENT = {
  es: {
    title: 'Avisos legales y privacidad',
    close: 'Cerrar',
    sections: [
      {
        head: 'Naturaleza de los datos',
        body: 'Los 6 casos demostrativos de esta plataforma son completamente ficticios. Las personas, empresas, contratos y vínculos no corresponden a personas reales y han sido construidos únicamente con fines de demostración técnica para el hackathon. Cualquier coincidencia con personas o entidades reales es involuntaria.'
      },
      {
        head: 'Base legal del tratamiento (al usar datos reales)',
        body: 'Cuando la plataforma se conecte a datos reales de fuentes públicas (Mercado Público, Servel, CPLT, registros de lobby, declaraciones de patrimonio, Registro Civil, registros mercantiles), el tratamiento se realizará al amparo del interés público y del ejercicio periodístico-investigativo, según lo permitido por la Ley 21.719 sobre Protección de Datos Personales (Chile · vigencia plena diciembre 2026) y la Ley 20.880 sobre Probidad y su modernización (BCN id 1209272).'
      },
      {
        head: 'Análisis algorítmico y decisiones automatizadas',
        body: 'El score de riesgo y las banderas rojas se generan mediante reglas determinísticas (detectores hard-coded) y análisis con IA (Anthropic Claude). Son interpretaciones automatizadas — no constituyen una determinación legal ni una sanción. Cualquier persona o entidad mencionada tiene derecho a la revisión humana, a la rectificación de inexactitudes y a la oposición al tratamiento.'
      },
      {
        head: 'Transferencia internacional',
        body: 'El análisis con IA se realiza vía la API de Anthropic (Estados Unidos). Si conectamos datos reales, esta transferencia estará amparada en cláusulas contractuales tipo, manteniendo el nivel de protección exigido por la Ley 21.719.'
      },
      {
        head: 'Derechos del titular (ARCOPOL)',
        body: 'Acceso, Rectificación, Cancelación, Oposición, Portabilidad y Bloqueo. Las solicitudes podrán dirigirse al responsable del tratamiento que se designará al pasar a producción.'
      },
      {
        head: 'Cobertura jurisdiccional',
        body: 'La plataforma cita normativa específica del país de cada caso: 🇨🇱 Chile (Ley 20.880 + modernización, Ley 19.886, Ley 20.730, Ley 21.719), 🇲🇽 México (LGRA, INE, SAT, CompraNet), 🇵🇪 Perú (Ley 27815, ONPE, SEACE), 🇨🇴 Colombia (Ley 1474 de 2011, CNE, DIAN, SECOP II). Las respuestas del chatbot están ancladas al país del caso abierto y no mezclan jurisdicciones.'
      }
    ]
  },
  en: {
    title: 'Legal notices and privacy',
    close: 'Close',
    sections: [
      {
        head: 'Nature of the data',
        body: 'The 6 demo cases in this platform are completely fictional. People, companies, contracts and ties do not correspond to real persons and have been built solely for hackathon demonstration. Any resemblance to real people or entities is unintended.'
      },
      {
        head: 'Legal basis for processing (when using real data)',
        body: 'When connected to real public-source data (Mercado Público, Servel, CPLT, lobby registries, asset declarations, civil registry, corporate registries), processing will rely on public interest and journalistic-investigative grounds, as allowed by Chile\'s Personal Data Protection Act (Ley 21.719, full effect December 2026) and the Probity Act (Ley 20.880 + modernization).'
      },
      {
        head: 'Algorithmic analysis and automated decisions',
        body: 'The risk score and red flags are produced via deterministic rules and AI analysis (Anthropic Claude). They are automated interpretations — not legal determinations or sanctions. Any person or entity mentioned has the right to human review, rectification, and objection to processing.'
      },
      {
        head: 'International transfer',
        body: 'AI analysis runs via Anthropic\'s API (United States). With real data, this transfer will be covered by standard contractual clauses preserving the protection level required by Ley 21.719.'
      },
      {
        head: 'Data subject rights (ARCOPOL)',
        body: 'Access, Rectification, Cancellation, Opposition, Portability and Blocking. Requests can be addressed to the data controller to be designated upon production deployment.'
      },
      {
        head: 'Jurisdictional coverage',
        body: 'The platform cites country-specific rules per case: 🇨🇱 Chile (Ley 20.880 + modernization, Ley 19.886, Ley 20.730, Ley 21.719), 🇲🇽 Mexico (LGRA, INE, SAT, CompraNet), 🇵🇪 Peru (Ley 27815, ONPE, SEACE), 🇨🇴 Colombia (Ley 1474 of 2011, CNE, DIAN, SECOP II). Chatbot responses are anchored to the country of the open case and do not mix jurisdictions.'
      }
    ]
  }
};

export default function LegalNoticeModal({ open, onClose, lang }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const c = CONTENT[lang] || CONTENT.es;

  return (
    <div className="legal-overlay" onClick={onClose}>
      <div
        className="legal-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="legal-head">
          <h2 id="legal-title">{c.title}</h2>
          <button className="legal-close" onClick={onClose} aria-label={c.close}>✕</button>
        </div>
        <div className="legal-body">
          {c.sections.map((s, i) => (
            <section key={i} className="legal-section">
              <h3>{s.head}</h3>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
