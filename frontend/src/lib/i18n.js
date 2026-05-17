export const I18N = {
  es: {
    appName: "RedPoder",
    tagline: "Conexiones entre poder político, empresas y contratos públicos en LATAM",
    searchPlaceholder: "Buscar persona, empresa, RUT o contrato…",
    suggested: "Casos sugeridos",
    viewGraph: "Red",
    viewTimeline: "Línea de tiempo",
    viewTable: "Tabla",
    profile: "Perfil",
    aiSummary: "Resumen IA",
    redFlags: "Banderas rojas",
    sources: "Fuente",
    riskScore: "Riesgo",
    askProfile: "Pregúntale al perfil",
    askPlaceholder: "Escribe una pregunta sobre este perfil…",
    suggestedQs: "Preguntas sugeridas",
    relationsTable: "Relaciones detectadas",
    relation: "Relación",
    from: "Desde",
    to: "Hacia",
    weight: "Magnitud",
    flagged: "Marcada",
    noResults: "Sin resultados",
    empty: "Busca un nombre, RUT o empresa para comenzar",
    emptyHint: "O elige uno de los casos sugeridos",
    severityHigh: "Alta",
    severityMedium: "Media",
    severityLow: "Baja",
    poweredBy: "Datos de fuentes públicas · Análisis con Claude",
    nodeTypes: { person: "Persona", company: "Empresa", contract: "Contrato" }
  },
  en: {
    appName: "RedPoder",
    tagline: "Connections between political power, companies and public contracts in LATAM",
    searchPlaceholder: "Search person, company, ID or contract…",
    suggested: "Featured cases",
    viewGraph: "Network",
    viewTimeline: "Timeline",
    viewTable: "Table",
    profile: "Profile",
    aiSummary: "AI summary",
    redFlags: "Red flags",
    sources: "Source",
    riskScore: "Risk",
    askProfile: "Ask the profile",
    askPlaceholder: "Type a question about this profile…",
    suggestedQs: "Suggested questions",
    relationsTable: "Detected relations",
    relation: "Relation",
    from: "From",
    to: "To",
    weight: "Weight",
    flagged: "Flagged",
    noResults: "No results",
    empty: "Search a name, ID or company to begin",
    emptyHint: "Or pick one of the featured cases",
    severityHigh: "High",
    severityMedium: "Medium",
    severityLow: "Low",
    poweredBy: "Public-source data · Analysis with Claude",
    nodeTypes: { person: "Person", company: "Company", contract: "Contract" }
  }
};

export const SUGGESTED_QUESTIONS = {
  es: [
    "¿Cuáles son los conflictos de interés más graves?",
    "¿Tiene vínculos con empresas extranjeras?",
    "¿Qué tan inusual es este patrón de contratación?",
    "Resume las conexiones familiares en una frase"
  ],
  en: [
    "What are the most serious conflicts of interest?",
    "Are there ties to foreign companies?",
    "How unusual is this contracting pattern?",
    "Summarize the family connections in one line"
  ]
};

export const RELATION_LABELS = {
  es: { owns: "Posee/Dirige", awarded: "Adjudicó", signed: "Firmó", family_of: "Familiar de", former_role: "Cargo previo", donated_to: "Donó a" },
  en: { owns: "Owns/Directs", awarded: "Awarded", signed: "Signed", family_of: "Family of", former_role: "Former role", donated_to: "Donated to" }
};
