// Deterministic mock for the chatbot. Replace with real /api/ai/chat call later.
// Ported from reference/panels.jsx.

export function fakeAnswer(question, caseData, lang) {
  const lc = question.toLowerCase();
  const root = caseData.nodes.find(n => n.id === caseData.rootId);
  if (!root) {
    return lang === 'es'
      ? 'Por ahora puedo resumir entidades, relaciones y fuentes visibles cuando hay un caso cargado.'
      : 'For now I can summarize visible entities, relationships and sources when a case is loaded.';
  }

  if (caseData.fromApi) {
    if (lc.includes('fuente') || lc.includes('source')) {
      return lang === 'es'
        ? `Esta red tiene ${caseData.sources.length} fuentes registradas. Las fuentes disponibles aparecen en el panel derecho y en la tabla de relaciones cuando vienen asociadas a un vinculo.`
        : `This network has ${caseData.sources.length} registered sources. Available sources are shown in the right panel and in the relations table when linked to an edge.`;
    }
    if (lc.includes('riesgo') || lc.includes('risk') || lc.includes('conflict') || lc.includes('interés') || lc.includes('interes')) {
      const high = caseData.flags.filter(f => f.severity === 'high');
      if (high.length) {
        const title = typeof high[0].title === 'string' ? high[0].title : high[0].title?.[lang] || high[0].title?.es;
        const evidence = typeof high[0].evidence === 'string' ? high[0].evidence : high[0].evidence?.[lang] || high[0].evidence?.es;
        return lang === 'es'
          ? `La principal señal registrada es "${title}". ${evidence}`
          : `The main registered signal is "${title}". ${evidence}`;
      }
      return lang === 'es'
        ? `No veo banderas fuertes registradas para ${root.name}. El grafo muestra ${caseData.edges.length} relaciones documentadas que conviene revisar con sus fuentes.`
        : `I do not see high-severity flags registered for ${root.name}. The graph shows ${caseData.edges.length} documented relationships that should be reviewed with their sources.`;
    }
    return lang === 'es'
      ? `Vista centrada en ${root.name}: ${caseData.nodes.length} entidades, ${caseData.edges.length} relaciones y ${caseData.sources.length} fuentes. Esta respuesta es deterministica; la IA avanzada queda para una fase posterior.`
      : `View centered on ${root.name}: ${caseData.nodes.length} entities, ${caseData.edges.length} relationships and ${caseData.sources.length} sources. This answer is deterministic; advanced AI is planned for a later phase.`;
  }

  if (lc.includes('conflict') || lc.includes('interés') || lc.includes('interes')) {
    const high = caseData.flags.filter(f => f.severity === 'high');
    if (high.length) {
      return lang === 'es'
        ? `El más grave: ${high[0].title.es.toLowerCase()}. ${high[0].evidence.es}`
        : `Most serious: ${high[0].title.en.toLowerCase()}. ${high[0].evidence.en}`;
    }
  }
  if (lc.includes('famil')) {
    const fam = caseData.edges.find(e => e.type === 'family_of');
    if (fam) {
      const a = caseData.nodes.find(n => n.id === fam.s);
      const b = caseData.nodes.find(n => n.id === fam.t);
      return lang === 'es'
        ? `Se detecta un vínculo familiar entre ${a.name} y ${b.name} (${fam.label}). Esto activa la regla de abstención cuando hay decisiones que los afectan económicamente.`
        : `A family tie between ${a.name} and ${b.name} (${fam.label}). This triggers a recusal rule for decisions affecting them economically.`;
    }
  }
  if (lc.includes('inusual') || lc.includes('unusual') || lc.includes('patrón') || lc.includes('pattern')) {
    return lang === 'es'
      ? `El patrón está dentro del 7% más anómalo de la base. La combinación de ${caseData.flags.length} señales graves en un mismo nodo es lo que dispara el score de ${root.risk}.`
      : `The pattern is in the top 7% most anomalous of our dataset. The combination of ${caseData.flags.length} serious signals on a single node drives the risk score of ${root.risk}.`;
  }
  if (lc.includes('extranj') || lc.includes('foreign') || lc.includes('offshore')) {
    return lang === 'es'
      ? `No se detectaron vínculos offshore directos en esta búsqueda. Para verificar, cruzaríamos con ICIJ Offshore Leaks (pendiente).`
      : `No direct offshore ties detected in this search. To verify, we'd cross-check against ICIJ Offshore Leaks (pending integration).`;
  }
  return lang === 'es'
    ? `Buscando en el subgrafo de ${root.name}: ${caseData.summary.es.split('. ')[0]}.`
    : `Searching the subgraph of ${root.name}: ${caseData.summary.en.split('. ')[0]}.`;
}
