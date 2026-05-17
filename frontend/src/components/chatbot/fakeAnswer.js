// Deterministic mock for the chatbot. Replace with real /api/ai/chat call later.
// Ported from reference/panels.jsx.

export function fakeAnswer(question, caseData, lang) {
  const lc = question.toLowerCase();
  const root = caseData.nodes.find(n => n.id === caseData.rootId);

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
