// Demo data — 3 fictional LATAM cases (ported from reference/data.js)
// Expanded with more company/contract connections for the hackathon demo.
// All names and entities are FICTIONAL. Sources are placeholders.

export const DEMO_CASES = {
  fuentes: {
    id: "fuentes",
    rootId: 1,
    nodes: [
      { id: 1, type: "person", name: "Carlos Fuentes Saavedra", subtitle: "Ex-Subsecretario de Obras Públicas", country: "CL", risk: 78, x: 0, y: 0,
        meta: { rut: "8.234.567-9", born: "1962", education: "Ing. Civil, U. de Chile", currentRole: "Director — Constructora Los Andes SpA (2024–)" } },
      { id: 2, type: "company", name: "Constructora Los Andes SpA", country: "CL", risk: 64, x: 0, y: 0,
        meta: { founded: "2018", sector: "Construcción / Infraestructura", revenue: "≈ CLP 42.000M (2023)" } },
      { id: 3, type: "contract", name: "Concesión Ruta 68 — Tramo 4", country: "CL", risk: 71, x: 0, y: 0,
        meta: { amount: "CLP 184.500M", awarded: "2022-09-14", duration: "12 años" } },
      { id: 4, type: "person", name: "Ministerio de Obras Públicas", subtitle: "Entidad licitante", country: "CL", risk: 0, x: 0, y: 0, isEntity: true },
      { id: 5, type: "person", name: "Andrea Fuentes Lyon", subtitle: "Hija / Abogada", country: "CL", risk: 38, x: 0, y: 0,
        meta: { rut: "19.876.123-2", role: "Socia, Lyon & Asociados" } },
      { id: 6, type: "company", name: "Lyon & Asociados", country: "CL", risk: 41, x: 0, y: 0,
        meta: { sector: "Estudio jurídico", clients: "Constructora Los Andes (2021–)" } },
      { id: 7, type: "company", name: "Inversiones Cordillera Ltda.", country: "CL", risk: 52, x: 0, y: 0,
        meta: { founded: "2015", sector: "Holding familiar" } },
      { id: 8, type: "contract", name: "Mantención Hospital Regional Talca", country: "CL", risk: 44, x: 0, y: 0,
        meta: { amount: "CLP 12.300M", awarded: "2020-03-02" } },
      // ── Expansion ──────────────────────────────────────────────────────
      { id: 9, type: "person", name: "Patricia Saavedra Donoso", subtitle: "Cónyuge / Empresaria", country: "CL", risk: 44, x: 0, y: 0,
        meta: { rut: "9.123.456-7", role: "Socia 30% Inversiones Cordillera" } },
      { id: 10, type: "contract", name: "Concesión Aeropuerto Carriel Sur", country: "CL", risk: 68, x: 0, y: 0,
        meta: { amount: "CLP 96.200M", awarded: "2021-11-08", duration: "10 años" } },
      { id: 11, type: "company", name: "Constructora del Sur Ltda.", country: "CL", risk: 47, x: 0, y: 0,
        meta: { founded: "2020", sector: "Construcción regional", parent: "Constructora Los Andes (60%)" } },
      { id: 12, type: "contract", name: "Concesión Ruta 5 Tramo Norte", country: "CL", risk: 59, x: 0, y: 0,
        meta: { amount: "CLP 142.800M", awarded: "2022-04-22", duration: "10 años" } },
      { id: 13, type: "contract", name: "Audiencia Lobby #2298", country: "CL", risk: 36, x: 0, y: 0,
        meta: { date: "2020-06-12", topic: "Plan de Concesiones Viales 2020–2025" } },
      { id: 14, type: "company", name: "Cordillera Capital S.A.", country: "CL", risk: 49, x: 0, y: 0,
        meta: { founded: "2019", sector: "Holding financiero", parent: "Inversiones Cordillera (85%)" } },
      { id: 15, type: "company", name: "Fundación Andes Sustentable", country: "CL", risk: 34, x: 0, y: 0,
        meta: { sector: "ONG ambiental", funding: "Aportes Inversiones Cordillera 2020–2023" } },
      { id: 16, type: "company", name: "Servicios Andinos SpA", country: "CL", risk: 42, x: 0, y: 0,
        meta: { founded: "2019", sector: "Servicios técnicos / construcción", owner: "Patricia Saavedra" } },
      { id: 17, type: "contract", name: "Mantenimiento Vialidad Región VIII", country: "CL", risk: 56, x: 0, y: 0,
        meta: { amount: "CLP 28.700M", awarded: "2021-03-15", duration: "5 años" } },
      { id: 18, type: "person", name: "Eduardo Larraín Hidalgo", subtitle: "Ex-Director Vialidad MOP / Gerente Constructora", country: "CL", risk: 51, x: 0, y: 0,
        meta: { rut: "11.345.678-K", role: "Director Vialidad 2018–2022 → Gerente Constructora 2023" } }
    ],
    edges: [
      // Originales
      { s: 1, t: 4, type: "former_role", label: "Subsecretario (2018–2022)", weight: 1 },
      { s: 4, t: 3, type: "awarded", label: "Adjudicó licitación", weight: 1 },
      { s: 2, t: 3, type: "awarded", label: "Adjudicataria", weight: 1 },
      { s: 1, t: 2, type: "owns", label: "Director (2024–) · 18% participación", weight: 0.18, flag: true },
      { s: 1, t: 5, type: "family_of", label: "Padre", weight: 1 },
      { s: 5, t: 6, type: "owns", label: "Socia 50%", weight: 0.5 },
      { s: 6, t: 2, type: "signed", label: "Asesora legal desde 2021", weight: 1, flag: true },
      { s: 1, t: 7, type: "owns", label: "Beneficiario final 70%", weight: 0.7 },
      { s: 2, t: 8, type: "awarded", label: "Contrato menor", weight: 1 },
      // Expansión: cónyuge + holding familiar
      { s: 1, t: 9, type: "family_of", label: "Esposa", weight: 1 },
      { s: 9, t: 7, type: "owns", label: "Socia 30%", weight: 0.3 },
      // Más contratos MOP → Constructora (refuerza patrón puerta giratoria)
      { s: 4, t: 10, type: "awarded", label: "Adjudicó concesión", weight: 1 },
      { s: 2, t: 10, type: "awarded", label: "Adjudicataria Aeropuerto Carriel Sur", weight: 1, flag: true },
      // Subsidiaria de Constructora
      { s: 2, t: 11, type: "owns", label: "Matriz · 60%", weight: 0.6 },
      { s: 4, t: 12, type: "awarded", label: "Adjudicó concesión", weight: 1 },
      { s: 11, t: 12, type: "awarded", label: "Adjudicataria · vía empresa relacionada", weight: 1, flag: true },
      // Audiencia de lobby durante el mandato
      { s: 2, t: 13, type: "signed", label: "Solicitó audiencia (Constructora Los Andes)", weight: 1 },
      { s: 13, t: 1, type: "signed", label: "Concedida durante gestión MOP", weight: 1, flag: true },
      // Inversiones Cordillera → subsidiarias + donaciones
      { s: 7, t: 14, type: "owns", label: "Matriz · 85%", weight: 0.85 },
      { s: 7, t: 15, type: "donated_to", label: "Aportes CLP 18M (2020–2023)", weight: 1 },
      { s: 15, t: 2, type: "signed", label: "Campaña PR ambiental para constructora", weight: 1, flag: true },
      // Empresa de la esposa también adjudicada por MOP
      { s: 9, t: 16, type: "owns", label: "Socia 70%", weight: 0.7 },
      { s: 4, t: 17, type: "awarded", label: "Adjudicó contrato", weight: 1 },
      { s: 16, t: 17, type: "awarded", label: "Adjudicataria", weight: 1, flag: true },
      // Ex-subordinado pasa a la empresa (segunda puerta giratoria)
      { s: 18, t: 4, type: "former_role", label: "Director Vialidad (2018–2022)", weight: 1 },
      { s: 18, t: 2, type: "owns", label: "Gerente General (2023–)", weight: 1, flag: true },
      // Compartir clientes — Lyon también asesora a la subsidiaria
      { s: 6, t: 11, type: "signed", label: "Asesoría legal · Constructora del Sur", weight: 1 }
    ],
    timeline: [
      { date: "2018-03", title: "Asume como Subsecretario de Obras Públicas", type: "role", severity: "info" },
      { date: "2018-11", title: "Constituye Constructora Los Andes SpA mediante familiares", type: "company", severity: "warn", note: "Beneficiario final no declarado en patrimonio" },
      { date: "2020-03", title: "Constructora Los Andes adjudica contrato Hospital Talca", type: "contract", severity: "warn" },
      { date: "2020-06", title: "Audiencia de lobby con Constructora durante su gestión", type: "relation", severity: "warn" },
      { date: "2021-03", title: "Servicios Andinos (esposa) adjudica contrato vialidad", type: "contract", severity: "warn" },
      { date: "2021-05", title: "Lyon & Asociados (hija) firma asesoría con la constructora", type: "relation", severity: "warn" },
      { date: "2021-11", title: "Adjudicación Concesión Aeropuerto Carriel Sur", type: "contract", severity: "high", note: "CLP 96.200M — durante su gestión" },
      { date: "2022-04", title: "Constructora del Sur adjudica Ruta 5 Tramo Norte", type: "contract", severity: "high" },
      { date: "2022-09", title: "Adjudicación Concesión Ruta 68 — Tramo 4", type: "contract", severity: "high", note: "CLP 184.500M — durante su gestión" },
      { date: "2022-12", title: "Deja el cargo público", type: "role", severity: "info" },
      { date: "2023-08", title: "Eduardo Larraín (ex-Director Vialidad) pasa a gerente de Constructora", type: "role", severity: "high", note: "Segunda puerta giratoria — < 12 meses" },
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
    rootId: 21,
    nodes: [
      { id: 21, type: "person", name: "María José Errázuriz Pinto", subtitle: "Diputada — Comisión de Minería", country: "CL", risk: 64, x: 0, y: 0,
        meta: { rut: "13.456.789-0", born: "1978", party: "Coalición Centro", terms: "2018–presente" } },
      { id: 22, type: "person", name: "Tomás Errázuriz P.", subtitle: "Hermano / Empresario", country: "CL", risk: 47, x: 0, y: 0,
        meta: { rut: "12.987.654-3", role: "CEO MineraPacífico" } },
      { id: 23, type: "company", name: "MineraPacífico Holdings", country: "CL", risk: 58, x: 0, y: 0,
        meta: { sector: "Minería — Cobre", revenue: "USD 1.2B (2023)" } },
      { id: 24, type: "company", name: "Fundación Horizonte Verde", country: "CL", risk: 33, x: 0, y: 0,
        meta: { sector: "ONG — Causas ambientales (de fachada según querella)" } },
      { id: 25, type: "contract", name: "Audiencia de lobby #4421", country: "CL", risk: 49, x: 0, y: 0,
        meta: { date: "2023-06-12", topic: "Royalty minero" } },
      { id: 26, type: "contract", name: "Donación campaña 2021", country: "CL", risk: 51, x: 0, y: 0,
        meta: { amount: "CLP 28M", source: "MineraPacífico via fundación" } },
      { id: 27, type: "company", name: "Ley Royalty Minero — Voto", country: "CL", risk: 0, x: 0, y: 0, isEntity: true },
      // ── Expansion ──────────────────────────────────────────────────────
      { id: 28, type: "person", name: "Pablo Errázuriz Pinto", subtitle: "Hermano / Contador", country: "CL", risk: 38, x: 0, y: 0,
        meta: { rut: "14.234.567-K", role: "Contador MineraPacífico + Cobre Andino" } },
      { id: 29, type: "company", name: "Cobre Andino Ltda.", country: "CL", risk: 54, x: 0, y: 0,
        meta: { founded: "2017", sector: "Minería — Cobre / Litio", parent: "MineraPacífico (51%)" } },
      { id: 30, type: "contract", name: "Concesión Minera Atacama Sur", country: "CL", risk: 67, x: 0, y: 0,
        meta: { amount: "USD 340M", awarded: "2024-03-18", duration: "30 años" } },
      { id: 31, type: "company", name: "Ley Modificación Código Minero — Voto", country: "CL", risk: 0, x: 0, y: 0, isEntity: true },
      { id: 32, type: "contract", name: "Donación campaña 2025", country: "CL", risk: 53, x: 0, y: 0,
        meta: { amount: "CLP 34M", source: "Vía Fundación Horizonte Verde (segunda vez)" } },
      { id: 33, type: "contract", name: "Audiencia de lobby #6890", country: "CL", risk: 42, x: 0, y: 0,
        meta: { date: "2024-09-04", topic: "Concesiones mineras zona norte" } },
      { id: 34, type: "company", name: "Inmobiliaria Pacífico SpA", country: "CL", risk: 46, x: 0, y: 0,
        meta: { founded: "2020", sector: "Inmobiliaria comercial", owner: "Tomás Errázuriz 60%" } },
      { id: 35, type: "contract", name: "Concesión Inmobiliaria Antofagasta", country: "CL", risk: 49, x: 0, y: 0,
        meta: { amount: "CLP 18.500M", awarded: "2022-08-09", duration: "20 años" } },
      { id: 36, type: "company", name: "SERNAGEOMIN", country: "CL", risk: 0, x: 0, y: 0, isEntity: true },
      { id: 37, type: "company", name: "Estudio Echegaray & Cía.", country: "CL", risk: 44, x: 0, y: 0,
        meta: { sector: "Asesoría legal minera", clients: "MineraPacífico, Cobre Andino" } }
    ],
    edges: [
      // Originales
      { s: 21, t: 22, type: "family_of", label: "Hermana", weight: 1 },
      { s: 22, t: 23, type: "owns", label: "CEO + 12% accionista", weight: 0.12 },
      { s: 23, t: 24, type: "donated_to", label: "Aporte CLP 45M (2020–2023)", weight: 1, flag: true },
      { s: 24, t: 26, type: "signed", label: "Canalizó donación de campaña", weight: 1, flag: true },
      { s: 26, t: 21, type: "donated_to", label: "Recibió aporte CLP 28M", weight: 1 },
      { s: 23, t: 25, type: "signed", label: "Solicitó audiencia", weight: 1 },
      { s: 25, t: 21, type: "signed", label: "Recibió audiencia (Comisión Minería)", weight: 1 },
      { s: 21, t: 27, type: "signed", label: "Votó en contra del royalty (2023)", weight: 1, flag: true },
      // Expansión: segundo hermano (contador)
      { s: 21, t: 28, type: "family_of", label: "Hermana", weight: 1 },
      { s: 28, t: 23, type: "signed", label: "Contador MineraPacífico (2018–)", weight: 1 },
      // Subsidiaria minera + contrato grande
      { s: 23, t: 29, type: "owns", label: "Controla 51%", weight: 0.51 },
      { s: 28, t: 29, type: "signed", label: "Contador externo Cobre Andino", weight: 1 },
      { s: 29, t: 30, type: "awarded", label: "Adjudicataria · USD 340M", weight: 1, flag: true },
      // Segunda votación (refuerza voto sin abstención)
      { s: 21, t: 31, type: "signed", label: "Votó a favor (Modificación Código Minero 2024)", weight: 1, flag: true },
      // Segunda donación canalizada (refuerza patrón)
      { s: 23, t: 32, type: "donated_to", label: "Aporte CLP 50M (2024)", weight: 1, flag: true },
      { s: 24, t: 32, type: "signed", label: "Canalizó donación (segunda vez)", weight: 1, flag: true },
      { s: 32, t: 21, type: "donated_to", label: "Recibió aporte CLP 34M", weight: 1 },
      // Segunda audiencia de lobby (tardía)
      { s: 23, t: 33, type: "signed", label: "Solicitó audiencia (declarada 38 días tarde)", weight: 1, flag: true },
      { s: 33, t: 21, type: "signed", label: "Recibió audiencia", weight: 1 },
      // Hermano también dueño de inmobiliaria
      { s: 22, t: 34, type: "owns", label: "Socio 60%", weight: 0.6 },
      { s: 34, t: 35, type: "awarded", label: "Adjudicataria concesión inmobiliaria", weight: 1 },
      // Regulador que no fiscalizó
      { s: 36, t: 30, type: "signed", label: "No objetó concesión pese a observaciones", weight: 1, flag: true },
      // Estudio jurídico asesor de la familia
      { s: 37, t: 23, type: "signed", label: "Asesoría legal MineraPacífico", weight: 1 },
      { s: 37, t: 29, type: "signed", label: "Asesoría legal Cobre Andino", weight: 1 },
      { s: 37, t: 21, type: "signed", label: "Asesoría legal pro-bono diputada", weight: 1, flag: true }
    ],
    timeline: [
      { date: "2018-03", title: "Asume diputación — integra Comisión de Minería", type: "role", severity: "info" },
      { date: "2020-09", title: "MineraPacífico (hermano) inicia aportes a Fundación Horizonte Verde", type: "relation", severity: "warn" },
      { date: "2021-08", title: "Donación de campaña vía fundación: CLP 28M", type: "contract", severity: "high" },
      { date: "2022-08", title: "Inmobiliaria del hermano adjudica concesión Antofagasta", type: "contract", severity: "warn" },
      { date: "2023-06", title: "Recibe a MineraPacífico en audiencia de lobby (royalty minero)", type: "relation", severity: "warn" },
      { date: "2023-08", title: "Vota en contra de Ley Royalty Minero", type: "contract", severity: "high", note: "Sin abstención pese al vínculo familiar" },
      { date: "2024-03", title: "Cobre Andino (subsidiaria) adjudica Concesión Atacama Sur · USD 340M", type: "contract", severity: "high" },
      { date: "2024-09", title: "Segunda audiencia de lobby — declarada 38 días tarde", type: "relation", severity: "warn" },
      { date: "2024-11", title: "Vota a favor de Modificación Código Minero", type: "contract", severity: "high", note: "Beneficiaría a subsidiarias familiares" },
      { date: "2025-02", title: "Segunda donación canalizada · CLP 34M", type: "contract", severity: "high" }
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
    rootId: 41,
    nodes: [
      { id: 41, type: "company", name: "Servicios Patagonia Express SpA", country: "CL", risk: 82, x: 0, y: 0,
        meta: { rut: "76.543.210-K", founded: "2023-11-08", sector: "Logística / Transporte" } },
      { id: 42, type: "contract", name: "Suministro emergencia incendios — CONAF", country: "CL", risk: 76, x: 0, y: 0,
        meta: { amount: "CLP 7.800M", awarded: "2024-02-19", duration: "8 meses" } },
      { id: 43, type: "person", name: "Roberto Mansilla Vargas", subtitle: "Representante legal", country: "CL", risk: 54, x: 0, y: 0,
        meta: { rut: "16.234.567-1", role: "Único socio declarado" } },
      { id: 44, type: "company", name: "CONAF", country: "CL", risk: 0, x: 0, y: 0, isEntity: true },
      { id: 45, type: "person", name: "Pamela Sotomayor R.", subtitle: "Jefa Adquisiciones CONAF", country: "CL", risk: 58, x: 0, y: 0,
        meta: { rut: "14.567.890-2" } },
      { id: 46, type: "company", name: "GrupoMansilla Ltda.", country: "CL", risk: 47, x: 0, y: 0,
        meta: { sector: "Holding (3 empresas)" } },
      { id: 47, type: "company", name: "Logística Austral S.A. (relacionada)", country: "CL", risk: 49, x: 0, y: 0,
        meta: { sector: "Transporte", history: "Adjudicó contratos CONAF 2019–2022" } },
      // ── Expansion ──────────────────────────────────────────────────────
      { id: 48, type: "person", name: "Marisol Mansilla Vargas", subtitle: "Hermana / Ex-CONAF / Gerente Patagonia Express", country: "CL", risk: 62, x: 0, y: 0,
        meta: { rut: "17.890.123-4", role: "Analista CONAF 2019–2022 → Gerente Patagonia (2023–)" } },
      { id: 49, type: "contract", name: "Caminos Forestales Aysén", country: "CL", risk: 58, x: 0, y: 0,
        meta: { amount: "CLP 4.500M", awarded: "2022-07-14" } },
      { id: 50, type: "person", name: "Eladio Sotomayor Reinike", subtitle: "Hermano de Pamela", country: "CL", risk: 51, x: 0, y: 0,
        meta: { rut: "13.456.789-5", role: "Dueño Transportes Sotomayor" } },
      { id: 51, type: "company", name: "Transportes Sotomayor Ltda.", country: "CL", risk: 56, x: 0, y: 0,
        meta: { founded: "2018", sector: "Transporte carga", subcontracts: "Patagonia Express" } },
      { id: 52, type: "contract", name: "Combustible Emergencia CONAF 2024", country: "CL", risk: 64, x: 0, y: 0,
        meta: { amount: "CLP 2.300M", awarded: "2024-05-22" } },
      { id: 53, type: "contract", name: "Subsidio Estatal Reactivación", country: "CL", risk: 41, x: 0, y: 0,
        meta: { amount: "CLP 1.800M", awarded: "2024-07-30" } },
      { id: 54, type: "company", name: "Forestal Patagonia Ltda.", country: "CL", risk: 48, x: 0, y: 0,
        meta: { founded: "2022", sector: "Forestal", parent: "GrupoMansilla (80%)" } },
      { id: 55, type: "contract", name: "Reforestación Magallanes 2024", country: "CL", risk: 53, x: 0, y: 0,
        meta: { amount: "CLP 3.200M", awarded: "2024-04-10" } },
      { id: 56, type: "company", name: "Contraloría General de la República", country: "CL", risk: 0, x: 0, y: 0, isEntity: true }
    ],
    edges: [
      // Originales
      { s: 43, t: 41, type: "owns", label: "100% socio único", weight: 1 },
      { s: 41, t: 42, type: "awarded", label: "Adjudicataria — 11 días post-constitución", weight: 1, flag: true },
      { s: 44, t: 42, type: "awarded", label: "Adjudicó por trato directo", weight: 1, flag: true },
      { s: 45, t: 42, type: "signed", label: "Firmó adjudicación", weight: 1 },
      { s: 43, t: 46, type: "owns", label: "Beneficiario final", weight: 1 },
      { s: 46, t: 47, type: "owns", label: "Controla 80%", weight: 0.8 },
      { s: 45, t: 43, type: "family_of", label: "Ex-cuñados", weight: 1, flag: true },
      // Expansión: hermana puerta giratoria interna
      { s: 43, t: 48, type: "family_of", label: "Hermana", weight: 1 },
      { s: 48, t: 44, type: "former_role", label: "Analista CONAF (2019–2022)", weight: 1 },
      { s: 48, t: 41, type: "owns", label: "Gerente General (2023–)", weight: 1, flag: true },
      // Segundo contrato (Logística Austral)
      { s: 47, t: 49, type: "awarded", label: "Adjudicataria", weight: 1 },
      { s: 44, t: 49, type: "awarded", label: "Adjudicó trato directo", weight: 1, flag: true },
      // Sub-contratación intra-familia
      { s: 45, t: 50, type: "family_of", label: "Hermano", weight: 1 },
      { s: 50, t: 51, type: "owns", label: "Dueño 100%", weight: 1 },
      { s: 41, t: 51, type: "signed", label: "Subcontrata · CLP 1.200M (2024)", weight: 1, flag: true },
      // Más contratos CONAF a Patagonia
      { s: 44, t: 52, type: "awarded", label: "Adjudicó por trato directo", weight: 1, flag: true },
      { s: 41, t: 52, type: "awarded", label: "Adjudicataria · combustible", weight: 1, flag: true },
      // Subsidio estatal al grupo
      { s: 46, t: 53, type: "awarded", label: "Beneficiaria subsidio", weight: 1 },
      // Forestal Patagonia + reforestación
      { s: 46, t: 54, type: "owns", label: "Controla 80%", weight: 0.8 },
      { s: 44, t: 55, type: "awarded", label: "Adjudicó", weight: 1 },
      { s: 54, t: 55, type: "awarded", label: "Adjudicataria · vía empresa relacionada", weight: 1, flag: true },
      // Contraloría omite fiscalizar
      { s: 56, t: 42, type: "signed", label: "No objetó adjudicación pese a observaciones", weight: 1, flag: true }
    ],
    timeline: [
      { date: "2018", title: "Eladio Sotomayor funda Transportes Sotomayor", type: "company", severity: "info" },
      { date: "2019", title: "Marisol Mansilla ingresa como analista CONAF", type: "role", severity: "info" },
      { date: "2022-07", title: "Logística Austral adjudica Caminos Forestales Aysén", type: "contract", severity: "warn" },
      { date: "2022-12", title: "Marisol Mansilla deja CONAF", type: "role", severity: "info" },
      { date: "2023-01", title: "Marisol asume gerencia de Patagonia Express", type: "role", severity: "high", note: "1 mes tras dejar CONAF" },
      { date: "2023-11-08", title: "Constitución Servicios Patagonia Express SpA", type: "company", severity: "info" },
      { date: "2024-02-08", title: "CONAF abre proceso de emergencia por incendios", type: "contract", severity: "info" },
      { date: "2024-02-19", title: "Adjudicación trato directo a Patagonia Express", type: "contract", severity: "high", note: "11 días después de constituida la empresa" },
      { date: "2024-04", title: "Forestal Patagonia (grupo) adjudica reforestación Magallanes", type: "contract", severity: "warn" },
      { date: "2024-05", title: "Segundo contrato CONAF (combustible) a Patagonia Express", type: "contract", severity: "high" },
      { date: "2024-07", title: "GrupoMansilla recibe subsidio estatal de reactivación", type: "contract", severity: "warn" }
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

export const SEARCH_INDEX = [
  { id: "fuentes", name: "Carlos Fuentes Saavedra", type: "person", subtitle: "Ex-Subsecretario MOP · CL", risk: 78 },
  { id: "errazuriz", name: "María José Errázuriz Pinto", type: "person", subtitle: "Diputada · Comisión Minería · CL", risk: 64 },
  { id: "losandes", name: "Servicios Patagonia Express SpA", type: "company", subtitle: "Logística · CL · Adjudicataria CONAF", risk: 82 },
  { id: "fuentes", name: "Constructora Los Andes SpA", type: "company", subtitle: "Construcción · CL", risk: 64 },
  { id: "errazuriz", name: "MineraPacífico Holdings", type: "company", subtitle: "Minería Cobre · CL", risk: 58 },
  { id: "fuentes", name: "Concesión Ruta 68 — Tramo 4", type: "contract", subtitle: "Contrato · CLP 184.500M · 2022", risk: 71 },
  { id: "errazuriz", name: "Cobre Andino Ltda.", type: "company", subtitle: "Minería · subsidiaria MineraPacífico", risk: 54 },
  { id: "losandes", name: "GrupoMansilla Ltda.", type: "company", subtitle: "Holding · CL", risk: 47 }
];
