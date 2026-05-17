// Demo data — 3 fictional LATAM cases with graph + timeline + red flags
// All names and entities are FICTIONAL. Sources are placeholders.

window.DEMO_CASES = {
  fuentes: {
    id: "fuentes",
    rootId: 1,
    nodes: [
      { id: 1, type: "person", name: "Carlos Fuentes Saavedra", subtitle: "Ex-Subsecretario de Obras Públicas", country: "CL", risk: 78, x: 0, y: 0,
        meta: { rut: "8.234.567-9", born: "1962", education: "Ing. Civil, U. de Chile", currentRole: "Director — Constructora Los Andes SpA (2024–)" } },
      { id: 2, type: "company", name: "Constructora Los Andes SpA", country: "CL", risk: 64, x: -220, y: -130,
        meta: { founded: "2018", sector: "Construcción / Infraestructura", revenue: "≈ CLP 42.000M (2023)" } },
      { id: 3, type: "contract", name: "Concesión Ruta 68 — Tramo 4", country: "CL", risk: 71, x: -380, y: 60,
        meta: { amount: "CLP 184.500M", awarded: "2022-09-14", duration: "12 años" } },
      { id: 4, type: "person", name: "Ministerio de Obras Públicas", subtitle: "Entidad licitante", country: "CL", risk: 0, x: -140, y: 180, isEntity: true },
      { id: 5, type: "person", name: "Andrea Fuentes Lyon", subtitle: "Hija / Abogada", country: "CL", risk: 38, x: 230, y: -110,
        meta: { rut: "19.876.123-2", role: "Socia, Lyon & Asociados" } },
      { id: 6, type: "company", name: "Lyon & Asociados", country: "CL", risk: 41, x: 380, y: 30,
        meta: { sector: "Estudio jurídico", clients: "Constructora Los Andes (2021–)" } },
      { id: 7, type: "company", name: "Inversiones Cordillera Ltda.", country: "CL", risk: 52, x: 180, y: 200,
        meta: { founded: "2015", sector: "Holding familiar" } },
      { id: 8, type: "contract", name: "Mantención Hospital Regional Talca", country: "CL", risk: 44, x: -380, y: -240,
        meta: { amount: "CLP 12.300M", awarded: "2020-03-02" } }
    ],
    edges: [
      { s: 1, t: 4, type: "former_role", label: "Subsecretario (2018–2022)", weight: 1 },
      { s: 4, t: 3, type: "awarded", label: "Adjudicó licitación", weight: 1 },
      { s: 2, t: 3, type: "awarded", label: "Adjudicataria", weight: 1 },
      { s: 1, t: 2, type: "owns", label: "Director (2024–) · 18% participación", weight: 0.18, flag: true },
      { s: 1, t: 5, type: "family_of", label: "Padre", weight: 1 },
      { s: 5, t: 6, type: "owns", label: "Socia 50%", weight: 0.5 },
      { s: 6, t: 2, type: "signed", label: "Asesora legal desde 2021", weight: 1, flag: true },
      { s: 1, t: 7, type: "owns", label: "Beneficiario final 70%", weight: 0.7 },
      { s: 2, t: 8, type: "awarded", label: "Contrato menor", weight: 1 }
    ],
    timeline: [
      { date: "2018-03", title: "Asume como Subsecretario de Obras Públicas", type: "role", severity: "info" },
      { date: "2018-11", title: "Constituye Constructora Los Andes SpA mediante familiares", type: "company", severity: "warn", note: "Beneficiario final no declarado en patrimonio" },
      { date: "2020-03", title: "Constructora Los Andes adjudica contrato Hospital Talca", type: "contract", severity: "warn" },
      { date: "2021-05", title: "Lyon & Asociados (hija) firma asesoría con la constructora", type: "relation", severity: "warn" },
      { date: "2022-09", title: "Adjudicación Concesión Ruta 68 — Tramo 4", type: "contract", severity: "high", note: "CLP 184.500M — durante su gestión" },
      { date: "2022-12", title: "Deja el cargo público", type: "role", severity: "info" },
      { date: "2024-01", title: "Asume como Director de Constructora Los Andes SpA", type: "role", severity: "high", note: "Puerta giratoria — < 18 meses tras dejar el cargo" }
    ],
    flags: [
      {
        id: "f1", severity: "high", title: { es: "Puerta giratoria", en: "Revolving door" },
        evidence: {
          es: "Pasa de Subsecretario MOP (2018–2022) a Director de una empresa que adjudicó CLP 184.500M durante su gestión. Plazo entre cargos: 13 meses.",
          en: "Moves from Deputy Minister of Public Works (2018–2022) to Director of a company awarded CLP 184.5B during his tenure. Cooling period: 13 months."
        },
        source: { label: "Ley 20.880 — Art. 56", url: "#" }
      },
      {
        id: "f2", severity: "high", title: { es: "Conflicto de interés familiar", en: "Family conflict of interest" },
        evidence: {
          es: "Su hija, Andrea Fuentes Lyon, es socia 50% de Lyon & Asociados, asesor legal de la constructora desde 2021 — mientras Carlos era funcionario público.",
          en: "His daughter holds 50% of Lyon & Asociados, legal counsel for the construction firm since 2021 — while Carlos was a public officer."
        },
        source: { label: "Registro de intereses CPLT", url: "#" }
      },
      {
        id: "f3", severity: "medium", title: { es: "Patrimonio inconsistente", en: "Inconsistent wealth declaration" },
        evidence: {
          es: "Inversiones Cordillera Ltda. (70% beneficiario final) no aparece en declaración patrimonial 2021–2022.",
          en: "Inversiones Cordillera Ltda. (70% beneficial owner) is missing from 2021–2022 wealth declaration."
        },
        source: { label: "Declaración CPLT 2022", url: "#" }
      }
    ],
    summary: {
      es: "Carlos Fuentes ocupó la Subsecretaría de Obras Públicas entre 2018 y 2022. Durante su gestión, la cartera adjudicó la Concesión Ruta 68 Tramo 4 (CLP 184.500M) a Constructora Los Andes SpA, empresa de la que pasaría a ser director apenas 13 meses después de dejar el cargo. La hija de Fuentes es además socia del estudio jurídico que asesora a la constructora desde 2021. Hay indicios de un holding familiar no declarado en patrimonio.",
      en: "Carlos Fuentes served as Deputy Minister of Public Works (2018–2022). During his tenure, the ministry awarded the Route 68 — Section 4 Concession (CLP 184.5B) to Constructora Los Andes SpA, a firm where he became Director just 13 months after leaving office. Fuentes' daughter is also a partner at the law firm advising the construction company since 2021. There are signs of an undisclosed family holding."
    }
  },

  errazuriz: {
    id: "errazuriz",
    rootId: 11,
    nodes: [
      { id: 11, type: "person", name: "María José Errázuriz Pinto", subtitle: "Diputada — Comisión de Minería", country: "CL", risk: 64, x: 0, y: 0,
        meta: { rut: "13.456.789-0", born: "1978", party: "Coalición Centro", terms: "2018–presente" } },
      { id: 12, type: "person", name: "Tomás Errázuriz P.", subtitle: "Hermano / Empresario", country: "CL", risk: 47, x: 240, y: -100,
        meta: { rut: "12.987.654-3", role: "CEO MineraPacífico" } },
      { id: 13, type: "company", name: "MineraPacífico Holdings", country: "CL", risk: 58, x: 410, y: 50,
        meta: { sector: "Minería — Cobre", revenue: "USD 1.2B (2023)" } },
      { id: 14, type: "company", name: "Fundación Horizonte Verde", country: "CL", risk: 33, x: -210, y: -150,
        meta: { sector: "ONG — Causas ambientales (de fachada según querella)" } },
      { id: 15, type: "contract", name: "Audiencia de lobby #4421", country: "CL", risk: 49, x: -380, y: 50,
        meta: { date: "2023-06-12", topic: "Royalty minero" } },
      { id: 16, type: "contract", name: "Donación campaña 2021", country: "CL", risk: 51, x: 120, y: 220,
        meta: { amount: "CLP 28M", source: "MineraPacífico via fundación" } },
      { id: 17, type: "company", name: "Ley Royalty Minero — Voto", country: "CL", risk: 0, x: -160, y: 180, isEntity: true }
    ],
    edges: [
      { s: 11, t: 12, type: "family_of", label: "Hermana", weight: 1 },
      { s: 12, t: 13, type: "owns", label: "CEO + 12% accionista", weight: 0.12 },
      { s: 13, t: 14, type: "donated_to", label: "Aporte CLP 45M (2020–2023)", weight: 1, flag: true },
      { s: 14, t: 16, type: "signed", label: "Canalizó donación de campaña", weight: 1, flag: true },
      { s: 16, t: 11, type: "donated_to", label: "Recibió aporte CLP 28M", weight: 1 },
      { s: 13, t: 15, type: "signed", label: "Solicitó audiencia", weight: 1 },
      { s: 15, t: 11, type: "signed", label: "Recibió audiencia (Comisión Minería)", weight: 1 },
      { s: 11, t: 17, type: "signed", label: "Votó en contra del royalty (2023)", weight: 1, flag: true }
    ],
    timeline: [
      { date: "2018-03", title: "Asume diputación — integra Comisión de Minería", type: "role", severity: "info" },
      { date: "2020-09", title: "MineraPacífico (hermano) inicia aportes a Fundación Horizonte Verde", type: "relation", severity: "warn" },
      { date: "2021-08", title: "Donación de campaña vía fundación: CLP 28M", type: "contract", severity: "high" },
      { date: "2023-06", title: "Recibe a MineraPacífico en audiencia de lobby (royalty minero)", type: "relation", severity: "warn" },
      { date: "2023-08", title: "Vota en contra de Ley Royalty Minero", type: "contract", severity: "high", note: "Sin abstención pese al vínculo familiar" }
    ],
    flags: [
      {
        id: "g1", severity: "high", title: { es: "Donación canalizada por ONG vinculada", en: "Donation laundered via linked NGO" },
        evidence: {
          es: "MineraPacífico (empresa del hermano) transfiere CLP 45M a Fundación Horizonte Verde, que a su vez aporta CLP 28M a la campaña 2021 de la diputada.",
          en: "MineraPacífico (brother's firm) transfers CLP 45M to Fundación Horizonte Verde, which then donates CLP 28M to the deputy's 2021 campaign."
        },
        source: { label: "Servel + CPLT", url: "#" }
      },
      {
        id: "g2", severity: "high", title: { es: "Voto sin abstención", en: "Vote without recusal" },
        evidence: {
          es: "Votó en contra de la Ley de Royalty Minero pese al vínculo familiar directo con MineraPacífico. La Ley 20.880 obliga a abstenerse en conflictos directos.",
          en: "Voted against the Mining Royalty Act despite direct family ties to MineraPacífico. Law 20.880 requires recusal in direct conflicts."
        },
        source: { label: "Boletín 12.093-08", url: "#" }
      },
      {
        id: "g3", severity: "medium", title: { es: "Audiencia de lobby no declarada en plazo", en: "Late-disclosed lobbying meeting" },
        evidence: {
          es: "Audiencia con MineraPacífico (junio 2023) declarada con 41 días de retraso. Plazo legal: 5 días hábiles.",
          en: "Lobbying meeting with MineraPacífico (June 2023) disclosed 41 days late. Legal deadline: 5 business days."
        },
        source: { label: "Ley 20.730 — Art. 8", url: "#" }
      }
    ],
    summary: {
      es: "La diputada Errázuriz integra la Comisión de Minería desde 2018. Su hermano dirige MineraPacífico Holdings, la cual ha canalizado donaciones de campaña a través de una fundación ambientalista vinculada. Pese a este conflicto directo, la diputada votó en contra de la Ley de Royalty Minero en 2023 sin abstenerse.",
      en: "Deputy Errázuriz has sat on the Mining Committee since 2018. Her brother heads MineraPacífico Holdings, which has funneled campaign donations through a linked environmental foundation. Despite this direct conflict, the deputy voted against the 2023 Mining Royalty Act without recusing herself."
    }
  },

  losandes: {
    id: "losandes",
    rootId: 21,
    nodes: [
      { id: 21, type: "company", name: "Servicios Patagonia Express SpA", country: "CL", risk: 82, x: 0, y: 0,
        meta: { rut: "76.543.210-K", founded: "2023-11-08", sector: "Logística / Transporte" } },
      { id: 22, type: "contract", name: "Suministro emergencia incendios — CONAF", country: "CL", risk: 76, x: -260, y: -110,
        meta: { amount: "CLP 7.800M", awarded: "2024-02-19", duration: "8 meses" } },
      { id: 23, type: "person", name: "Roberto Mansilla Vargas", subtitle: "Representante legal", country: "CL", risk: 54, x: 230, y: -130,
        meta: { rut: "16.234.567-1", role: "Único socio declarado" } },
      { id: 24, type: "company", name: "CONAF", country: "CL", risk: 0, x: -400, y: 30, isEntity: true },
      { id: 25, type: "person", name: "Pamela Sotomayor R.", subtitle: "Jefa Adquisiciones CONAF", country: "CL", risk: 58, x: -200, y: 200,
        meta: { rut: "14.567.890-2" } },
      { id: 26, type: "company", name: "GrupoMansilla Ltda.", country: "CL", risk: 47, x: 390, y: 30,
        meta: { sector: "Holding (3 empresas)" } },
      { id: 27, type: "company", name: "Logística Austral S.A. (relacionada)", country: "CL", risk: 49, x: 380, y: -240,
        meta: { sector: "Transporte", history: "Adjudicó contratos CONAF 2019–2022" } }
    ],
    edges: [
      { s: 23, t: 21, type: "owns", label: "100% socio único", weight: 1 },
      { s: 21, t: 22, type: "awarded", label: "Adjudicataria — 11 días post-constitución", weight: 1, flag: true },
      { s: 24, t: 22, type: "awarded", label: "Adjudicó por trato directo", weight: 1, flag: true },
      { s: 25, t: 22, type: "signed", label: "Firmó adjudicación", weight: 1 },
      { s: 23, t: 26, type: "owns", label: "Beneficiario final", weight: 1 },
      { s: 26, t: 27, type: "owns", label: "Controla 80%", weight: 0.8 },
      { s: 25, t: 23, type: "family_of", label: "Ex-cuñados", weight: 1, flag: true }
    ],
    timeline: [
      { date: "2023-11-08", title: "Constitución Servicios Patagonia Express SpA", type: "company", severity: "info" },
      { date: "2024-02-08", title: "CONAF abre proceso de emergencia por incendios", type: "contract", severity: "info" },
      { date: "2024-02-19", title: "Adjudicación trato directo a Patagonia Express", type: "contract", severity: "high", note: "11 días después de constituida la empresa" },
      { date: "2024-04", title: "Reportajes vinculan empresa con red familiar de adquisiciones CONAF", type: "relation", severity: "high" }
    ],
    flags: [
      {
        id: "h1", severity: "high", title: { es: "Empresa fantasma", en: "Shell company" },
        evidence: {
          es: "La empresa fue constituida 11 días antes de adjudicarse el contrato. Sin historial operativo, sin empleados declarados, sin patrimonio inicial.",
          en: "The company was incorporated 11 days before being awarded the contract. No operational history, no declared employees, no initial capital."
        },
        source: { label: "Registro SII + Mercado Público", url: "#" }
      },
      {
        id: "h2", severity: "high", title: { es: "Vínculo familiar con adjudicadora", en: "Family tie with awarding officer" },
        evidence: {
          es: "El representante legal y la jefa de adquisiciones de CONAF fueron cuñados entre 2016 y 2021. Sin abstención registrada en el proceso.",
          en: "The legal representative and CONAF's procurement chief were brothers-in-law between 2016 and 2021. No recusal on record."
        },
        source: { label: "Registro Civil + ChileCompra", url: "#" }
      },
      {
        id: "h3", severity: "medium", title: { es: "Patrón histórico", en: "Historical pattern" },
        evidence: {
          es: "GrupoMansilla (mismo controlador) ha tenido al menos 3 contratos con CONAF desde 2019, todos vía trato directo.",
          en: "GrupoMansilla (same beneficial owner) has had at least 3 contracts with CONAF since 2019, all via direct deal."
        },
        source: { label: "ChileCompra histórico", url: "#" }
      }
    ],
    summary: {
      es: "Servicios Patagonia Express fue constituida en noviembre de 2023 y adjudicó por trato directo un contrato de emergencia con CONAF (CLP 7.800M) apenas 11 días después de su creación. Su representante legal mantuvo vínculo familiar con la jefa de adquisiciones que firmó la adjudicación. El controlador final ya había recibido contratos similares mediante otra empresa relacionada.",
      en: "Servicios Patagonia Express was incorporated in November 2023 and was directly awarded an emergency contract with CONAF (CLP 7.8B) just 11 days after its creation. Its legal representative was related by marriage to CONAF's procurement chief who signed the award. The ultimate controller had previously received similar contracts through a related company."
    }
  }
};

window.SEARCH_INDEX = [
  { id: "fuentes", name: "Carlos Fuentes Saavedra", type: "person", subtitle: "Ex-Subsecretario MOP · CL", risk: 78 },
  { id: "errazuriz", name: "María José Errázuriz Pinto", type: "person", subtitle: "Diputada · Comisión Minería · CL", risk: 64 },
  { id: "losandes", name: "Servicios Patagonia Express SpA", type: "company", subtitle: "Logística · CL · Adjudicataria CONAF", risk: 82 },
  { id: "fuentes", name: "Constructora Los Andes SpA", type: "company", subtitle: "Construcción · CL", risk: 64 },
  { id: "errazuriz", name: "MineraPacífico Holdings", type: "company", subtitle: "Minería Cobre · CL", risk: 58 },
  { id: "fuentes", name: "Concesión Ruta 68 — Tramo 4", type: "contract", subtitle: "Contrato · CLP 184.500M · 2022", risk: 71 }
];

window.I18N = {
  es: {
    appName: "Mapa de Poder",
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
    appName: "Power Map",
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

window.SUGGESTED_QUESTIONS = {
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

window.RELATION_LABELS = {
  es: { owns: "Posee/Dirige", awarded: "Adjudicó", signed: "Firmó", family_of: "Familiar de", former_role: "Cargo previo", donated_to: "Donó a" },
  en: { owns: "Owns/Directs", awarded: "Awarded", signed: "Signed", family_of: "Family of", former_role: "Former role", donated_to: "Donated to" }
};
