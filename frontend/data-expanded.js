// Demo data â 11 LATAM cases (Chile, Colombia, Perú, México)
// All names and entities are FICTIONAL. Sources are placeholders.

window.DEMO_CASES = {
  // ============ CHILE ============
  fuentes: {
    id: "fuentes",
    rootId: 1,
    nodes: [
      { id: 1, type: "person", name: "Carlos Fuentes Saavedra", subtitle: "Ex-Subsecretario de Obras Públicas", country: "CL", risk: 78, x: 0, y: 0,
        meta: { rut: "8.234.567-9", born: "1962", education: "Ing. Civil, U. de Chile", currentRole: "Director – Constructora Los Andes SpA (2024–)" } },
      { id: 2, type: "company", name: "Constructora Los Andes SpA", country: "CL", risk: 64, x: -220, y: -130,
        meta: { founded: "2018", sector: "Construcción / Infraestructura", revenue: "≈ CLP 42.000M (2023)" } },
      { id: 3, type: "contract", name: "Concesión Ruta 68 – Tramo 4", country: "CL", risk: 71, x: -380, y: 60,
        meta: { amount: "CLP 184.500M", awarded: "2022-09-14", duration: "12 años" } },
      { id: 4, type: "person", name: "Ministerio de Obras Públicas", subtitle: "Entidad licitante", country: "CL", risk: 0, x: -140, y: 180, isEntity: true },
      { id: 5, type: "person", name: "Andrea Fuentes Lyon", subtitle: "Hija / Abogada", country: "CL", risk: 38, x: 230, y: -110,
        meta: { rut: "19.876.123-2", role: "Socia, Lyon & Asociados" } },
      { id: 6, type: "company", name: "Lyon & Asociados", country: "CL", risk: 41, x: 380, y: 30,
        meta: { sector: "Estudio jurídico", clients: "Constructora Los Andes (2021–)" } },
      { id: 7, type: "company", name: "Inversiones Cordillera Ltda.", country: "CL", risk: 52, x: 180, y: 200,
        meta: { founded: "2015", sector: "Holding familiar" } },
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
    ],
    timeline: [
      { date: "2018-03", title: "Asume como Subsecretario de Obras Públicas", type: "role", severity: "info" },
      { date: "2018-11", title: "Constituye Constructora Los Andes SpA mediante familiares", type: "company", severity: "warn", note: "Beneficiario final no declarado en patrimonio" },
      { date: "2021-05", title: "Lyon & Asociados (hija) firma asesoría con la constructora", type: "relation", severity: "warn" },
      { date: "2022-09", title: "Adjudicación Concesión Ruta 68 – Tramo 4", type: "contract", severity: "high", note: "CLP 184.500M – durante su gestión" },
      { date: "2022-12", title: "Deja el cargo público", type: "role", severity: "info" },
      { date: "2024-01", title: "Asume como Director de Constructora Los Andes SpA", type: "role", severity: "high", note: "Puerta giratoria – < 18 meses tras dejar el cargo" }
    ],
    flags: [
      {
        id: "f1", severity: "high", title: { es: "Puerta giratoria", en: "Revolving door" },
        evidence: {
          es: "Pasa de Subsecretario MOP (2018–2022) a Director de una empresa que adjudicó CLP 184.500M durante su gestión. Plazo entre cargos: 13 meses.",
          en: "Moves from Deputy Minister (2018–2022) to Director of a firm awarded CLP 184.5B during his tenure. Cooling period: 13 months."
        },
        source: { label: "Ley 20.880 – Art. 56", url: "#" }
      },
      {
        id: "f2", severity: "high", title: { es: "Conflicto de interés familiar", en: "Family conflict of interest" },
        evidence: {
          es: "Su hija es socia de estudio jurídico que asesora a la constructora desde 2021 – mientras Carlos era funcionario público.",
          en: "His daughter is a partner at a law firm advising the construction company since 2021 – while Carlos was a public officer."
        },
        source: { label: "Registro de intereses CPLT", url: "#" }
      }
    ],
    summary: {
      es: "Carlos Fuentes ocupó la Subsecretaría de Obras Públicas (2018–2022). Durante su gestión, la cartera adjudicó la Concesión Ruta 68 Tramo 4 (CLP 184.500M) a Constructora Los Andes SpA, empresa de la que pasaría a ser director apenas 13 meses después. Su hija es socia del estudio jurídico que asesora a la constructora.",
      en: "Carlos Fuentes served as Deputy Minister of Public Works (2018–2022). During his tenure, the ministry awarded the Route 68 Concession (CLP 184.5B) to Constructora Los Andes SpA, a firm where he became Director 13 months later. His daughter is a partner at the law firm advising the construction company."
    }
  },

  errazuriz: {
    id: "errazuriz",
    rootId: 11,
    nodes: [
      { id: 11, type: "person", name: "María José Errázuriz Pinto", subtitle: "Diputada – Comisión de Minería", country: "CL", risk: 64, x: 0, y: 0,
        meta: { rut: "13.456.789-0", born: "1978", party: "Coalición Centro", terms: "2018–presente" } },
      { id: 12, type: "person", name: "Tomás Errázuriz P.", subtitle: "Hermano / Empresario", country: "CL", risk: 47, x: 240, y: -100,
        meta: { rut: "12.987.654-3", role: "CEO MineraPacífico" } },
      { id: 13, type: "company", name: "MineraPacífico Holdings", country: "CL", risk: 58, x: 410, y: 50,
        meta: { sector: "Minería – Cobre", revenue: "USD 1.2B (2023)" } },
      { id: 14, type: "person", name: "Ministerio de Minería", subtitle: "Entidad reguladora", country: "CL", risk: 0, x: -160, y: 180, isEntity: true },
      { id: 15, type: "contract", name: "Audiencia de lobby #4421", country: "CL", risk: 49, x: -380, y: 50,
        meta: { date: "2023-06-12", topic: "Royalty minero" } },
    ],
    edges: [
      { s: 11, t: 12, type: "family_of", label: "Hermana", weight: 1 },
      { s: 12, t: 13, type: "owns", label: "CEO + 12% accionista", weight: 0.12 },
      { s: 13, t: 15, type: "signed", label: "Solicitó audiencia", weight: 1 },
      { s: 15, t: 11, type: "signed", label: "Recibió audiencia (Comisión Minería)", weight: 1 },
    ],
    timeline: [
      { date: "2018-03", title: "Asume diputación – integra Comisión de Minería", type: "role", severity: "info" },
      { date: "2023-06", title: "Recibe a MineraPacífico en audiencia de lobby (royalty minero)", type: "relation", severity: "warn" },
      { date: "2023-08", title: "Vota en contra de Ley Royalty Minero", type: "contract", severity: "high", note: "Sin abstención pese al vínculo familiar" }
    ],
    flags: [
      {
        id: "g1", severity: "high", title: { es: "Voto sin abstención", en: "Vote without recusal" },
        evidence: {
          es: "Votó en contra de Ley de Royalty Minero pese a vínculo familiar directo con MineraPacífico. Ley 20.880 obliga abstención en conflictos.",
          en: "Voted against Mining Royalty Act despite direct family ties. Law 20.880 requires recusal in direct conflicts."
        },
        source: { label: "Boletín 12.093-08", url: "#" }
      }
    ],
    summary: {
      es: "La diputada Errázuriz integra la Comisión de Minería desde 2018. Su hermano dirige MineraPacífico Holdings. Pese a este conflicto directo, la diputada votó en contra de la Ley de Royalty Minero en 2023 sin abstenerse.",
      en: "Deputy Errázuriz has sat on the Mining Committee since 2018. Her brother heads MineraPacífico Holdings. Despite this direct conflict, the deputy voted against the 2023 Mining Royalty Act without recusing herself."
    }
  },

  losandes: {
    id: "losandes",
    rootId: 21,
    nodes: [
      { id: 21, type: "company", name: "Servicios Patagonia Express SpA", country: "CL", risk: 82, x: 0, y: 0,
        meta: { rut: "76.543.210-K", founded: "2023-11-08", sector: "Logística / Transporte" } },
      { id: 22, type: "contract", name: "Suministro emergencia incendios – CONAF", country: "CL", risk: 76, x: -260, y: -110,
        meta: { amount: "CLP 7.800M", awarded: "2024-02-19", duration: "8 meses" } },
      { id: 23, type: "person", name: "Roberto Mansilla Vargas", subtitle: "Representante legal", country: "CL", risk: 54, x: 230, y: -130,
        meta: { rut: "16.234.567-1", role: "Único socio declarado" } },
      { id: 24, type: "person", name: "CONAF", country: "CL", risk: 0, x: -400, y: 30, isEntity: true },
      { id: 25, type: "person", name: "Pamela Sotomayor R.", subtitle: "Jefa Adquisiciones CONAF", country: "CL", risk: 58, x: -200, y: 200,
        meta: { rut: "14.567.890-2" } },
      { id: 26, type: "company", name: "GrupoMansilla Ltda.", country: "CL", risk: 47, x: 390, y: 30,
        meta: { sector: "Holding (3 empresas)" } },
    ],
    edges: [
      { s: 23, t: 21, type: "owns", label: "100% socio único", weight: 1 },
      { s: 21, t: 22, type: "awarded", label: "Adjudicataria – 11 días post-constitución", weight: 1, flag: true },
      { s: 24, t: 22, type: "awarded", label: "Adjudicó por trato directo", weight: 1, flag: true },
      { s: 25, t: 22, type: "signed", label: "Firmó adjudicación", weight: 1 },
      { s: 23, t: 26, type: "owns", label: "Beneficiario final", weight: 1 },
      { s: 25, t: 23, type: "family_of", label: "Ex-cuñados", weight: 1, flag: true }
    ],
    timeline: [
      { date: "2023-11-08", title: "Constitución Servicios Patagonia Express SpA", type: "company", severity: "info" },
      { date: "2024-02-08", title: "CONAF abre proceso de emergencia por incendios", type: "contract", severity: "info" },
      { date: "2024-02-19", title: "Adjudicación trato directo a Patagonia Express", type: "contract", severity: "high", note: "11 días después de constituida" },
    ],
    flags: [
      {
        id: "h1", severity: "high", title: { es: "Empresa fantasma", en: "Shell company" },
        evidence: {
          es: "Constituida 11 días antes de adjudicarse el contrato. Sin historial operativo, sin patrimonio inicial.",
          en: "Incorporated 11 days before being awarded the contract. No operational history, no initial capital."
        },
        source: { label: "Registro SII + Mercado Público", url: "#" }
      }
    ],
    summary: {
      es: "Servicios Patagonia Express fue constituida en noviembre 2023 y adjudicó por trato directo un contrato de emergencia con CONAF (CLP 7.800M) apenas 11 días después. El controlador ya había recibido contratos similares mediante otra empresa.",
      en: "Servicios Patagonia Express was incorporated in November 2023 and was directly awarded an emergency contract with CONAF (CLP 7.8B) just 11 days after creation. The ultimate controller had previously received similar contracts through a related company."
    }
  },

  // ============ COLOMBIA ============
  secop_colombia: {
    id: "secop_colombia",
    rootId: 31,
    nodes: [
      { id: 31, type: "person", name: "Jorge Valenzuela Méndez", subtitle: "Ex-Procurador / Asesor privado", country: "CO", risk: 71, x: 0, y: 0,
        meta: { cedula: "98.765.432-1", born: "1965", role: "Ex-funcionario público (2016–2022)" } },
      { id: 32, type: "company", name: "Soluciones Integrales & Cía", country: "CO", risk: 68, x: -280, y: -140,
        meta: { nit: "900.123.456-7", founded: "2022-03", sector: "Consultoría pública / Asesoría" } },
      { id: 33, type: "contract", name: "Contrato SECOP: Sistema de información para salud", country: "CO", risk: 74, x: -420, y: 80,
        meta: { amount: "COP 2.400M", awarded: "2023-07-15", duration: "18 meses" } },
      { id: 34, type: "person", name: "Ministerio de Salud Colombia", subtitle: "Entidad contratante", country: "CO", risk: 0, x: -140, y: 200, isEntity: true },
      { id: 35, type: "person", name: "Diana Rojas Ospina", subtitle: "Directora Adquisiciones", country: "CO", risk: 52, x: 240, y: 100,
        meta: { cedula: "65.432.123-4", note: "Excolega de Valenzuela en Procuraduría" } },
    ],
    edges: [
      { s: 31, t: 34, type: "former_role", label: "Procurador delegado (2016–2022)", weight: 1, flag: true },
      { s: 34, t: 33, type: "awarded", label: "Adjudicó contrato", weight: 1 },
      { s: 32, t: 33, type: "awarded", label: "Adjudicataria", weight: 1, flag: true },
      { s: 31, t: 32, type: "owns", label: "Asesor principal / Beneficiario", weight: 1, flag: true },
      { s: 35, t: 31, type: "family_of", label: "Excolega, relación cercana", weight: 1 },
    ],
    timeline: [
      { date: "2016-03", title: "Asume como Procurador delegado en Salud", type: "role", severity: "info" },
      { date: "2022-01", title: "Renuncia a la Procuraduría", type: "role", severity: "info" },
      { date: "2022-03", title: "Funda Soluciones Integrales & Cía", type: "company", severity: "warn", note: "2 meses después de dejar cargo público" },
      { date: "2023-07", title: "Su empresa adjudica contrato SECOP por COP 2.400M", type: "contract", severity: "high", note: "16 meses después de haber dejado Procuraduría" },
    ],
    flags: [
      {
        id: "co1", severity: "high", title: { es: "Puerta giratoria – Sector salud", en: "Revolving door – Health sector" },
        evidence: {
          es: "Pasa de Procurador en salud (2016–2022) a asesor privado de empresa que gana contratos ante el mismo ministerio.",
          en: "Moves from Health Prosecutor (2016–2022) to private consultant for firms winning contracts with the same ministry."
        },
        source: { label: "SECOP + Registro Procuraduría", url: "#" }
      },
      {
        id: "co2", severity: "medium", title: { es: "Contacto reciente con funcionario", en: "Recent contact with official" },
        evidence: {
          es: "La directora de adquisiciones trabajó con Valenzuela en la Procuraduría. No se registró recusación en la adjudicación.",
          en: "The procurement director previously worked with Valenzuela at the Prosecutor's Office. No recusal on record."
        },
        source: { label: "CV funcional Procuraduría", url: "#" }
      }
    ],
    summary: {
      es: "Jorge Valenzuela fue Procurador en salud (2016–2022). Dos meses después de dejar el cargo fundó Soluciones Integrales & Cía, empresa que 16 meses más tarde adjudicó un contrato de COP 2.400M ante el mismo ministerio donde trabajó. La directora de adquisiciones fue su excolega.",
      en: "Jorge Valenzuela was Health Prosecutor (2016–2022). Two months after leaving, he founded Soluciones Integrales & Cía, which won a COP 2.4B contract with the same ministry 16 months later. The procurement director was his former colleague."
    }
  },

  // ============ PERÚ ============
  mining_peru: {
    id: "mining_peru",
    rootId: 41,
    nodes: [
      { id: 41, type: "person", name: "Vicente Alcántara Huamán", subtitle: "Congresista / Propietario minería", country: "PE", risk: 76, x: 0, y: 0,
        meta: { dni: "08.765.432", born: "1970", dept: "Junín", role: "Congresista por minería (2021–)" } },
      { id: 42, type: "company", name: "Minería Altiplano SAC", country: "PE", risk: 69, x: -300, y: -130,
        meta: { ruc: "20.543.210.876", founded: "2019", sector: "Explotación de cobre" } },
      { id: 43, type: "contract", name: "Licencia ambiental: Proyecto Altiplano 2", country: "PE", risk: 72, x: -420, y: 90,
        meta: { date: "2023-04-20", authority: "MINAM", conflict: "Población civil opuesta" } },
      { id: 44, type: "person", name: "Ministerio del Ambiente (MINAM)", subtitle: "Entidad reguladora", country: "PE", risk: 0, x: -140, y: 210, isEntity: true },
      { id: 45, type: "person", name: "Comunidad Andina Yauricocha", subtitle: "Pueblo afectado", country: "PE", risk: 45, x: 260, y: 150,
        meta: { population: "~2,500" } },
    ],
    edges: [
      { s: 41, t: 42, type: "owns", label: "Accionista principal (45%)", weight: 0.45, flag: true },
      { s: 42, t: 43, type: "signed", label: "Solicitó licencia ambiental", weight: 1 },
      { s: 44, t: 43, type: "awarded", label: "Otorgó licencia", weight: 1 },
      { s: 41, t: 44, type: "signed", label: "Intervino en debate legislativo", weight: 1, flag: true },
      { s: 43, t: 45, type: "signed", label: "Afecta territorio comunal", weight: 1 },
    ],
    timeline: [
      { date: "2019-08", title: "Funda Minería Altiplano SAC", type: "company", severity: "info" },
      { date: "2021-06", title: "Asume como Congresista por Junín", type: "role", severity: "info", note: "Es propietario de empresa minera en su región" },
      { date: "2022-11", title: "Participa en debates sobre normativa minero-ambiental", type: "relation", severity: "warn" },
      { date: "2023-04", title: "MINAM otorga licencia ambiental a su empresa", type: "contract", severity: "high", note: "Sin recusación parlamentaria" },
      { date: "2023-08", title: "Conflicto social: comunidad rechaza proyecto", type: "relation", severity: "high" },
    ],
    flags: [
      {
        id: "pe1", severity: "high", title: { es: "Conflicto de interés directo", en: "Direct conflict of interest" },
        evidence: {
          es: "Congresista que posee 45% de empresa minera participa en debates sobre normativa ambiental y minera, afectando sus propios intereses.",
          en: "Congressman owning 45% of mining company participates in debates on environmental and mining regulations affecting his own interests."
        },
        source: { label: "Registro de accionistas SUNARP", url: "#" }
      },
      {
        id: "pe2", severity: "high", title: { es: "Licencia sin transparencia", en: "License granted without transparency" },
        evidence: {
          es: "MINAM otorgó licencia ambiental sin participación clara de comunidades afectadas. Congresista no se abstuvo en debates.",
          en: "MINAM granted environmental license without clear participation of affected communities. Congressman did not recuse himself."
        },
        source: { label: "MINAM expediente + acta congresional", url: "#" }
      }
    ],
    summary: {
      es: "Vicente Alcántara es Congresista por Junín y accionista principal (45%) de Minería Altiplano SAC. En 2023, su empresa recibió licencia ambiental del MINAM para operar en territorio de comunidad indígena. Alcántara participa activamente en debates sobre normativa minera sin declarar su conflicto.",
      en: "Vicente Alcántara is a Congressman from Junín and principal shareholder (45%) of Minería Altiplano SAC. In 2023, his company received an environmental license from MINAM to operate in indigenous community territory. Alcántara actively participates in mining regulation debates without declaring his conflict."
    }
  },

  // ============ MÉXICO ============
  inframexico: {
    id: "inframexico",
    rootId: 51,
    nodes: [
      { id: 51, type: "person", name: "Raúl Mendoza Torres", subtitle: "Ex-Director IMSS / Empresario", country: "MX", risk: 74, x: 0, y: 0,
        meta: { rfc: "MEN-750815-XY1", born: "1975", role: "Ex-IMSS director (2018–2021)" } },
      { id: 52, type: "company", name: "Infraestructura México Global S.A.", country: "MX", risk: 71, x: -320, y: -150,
        meta: { rfc: "IMG-190615-AB2", founded: "2019-06", sector: "Construcción / Infraestructura médica" } },
      { id: 53, type: "contract", name: "CompraNet: Ampliación Hospital Central IMSS", country: "MX", risk: 78, x: -480, y: 70,
        meta: { amount: "MXN 890M", awarded: "2022-11-03", duration: "24 meses", notes: "Modalidad: Adjudicación directa" } },
      { id: 54, type: "person", name: "IMSS México", subtitle: "Instituto de Seguridad Social", country: "MX", risk: 0, x: -140, y: 220, isEntity: true },
      { id: 55, type: "person", name: "Gerardo López Sánchez", subtitle: "Actual Director IMSS", country: "MX", risk: 48, x: 280, y: 120,
        meta: { rfc: "LOS-650722-MC9", note: "Cercano a Mendoza en círculos políticos" } },
    ],
    edges: [
      { s: 51, t: 54, type: "former_role", label: "Director (2018–2021)", weight: 1, flag: true },
      { s: 54, t: 53, type: "awarded", label: "Adjudicó contrato", weight: 1 },
      { s: 52, t: 53, type: "awarded", label: "Adjudicataria (modalidad: directa)", weight: 1, flag: true },
      { s: 51, t: 52, type: "owns", label: "Socio mayoritario (62%)", weight: 0.62, flag: true },
      { s: 55, t: 51, type: "family_of", label: "Círculo político / amistad declarada", weight: 1 },
    ],
    timeline: [
      { date: "2018-06", title: "Asume como Director IMSS", type: "role", severity: "info" },
      { date: "2019-06", title: "Funda Infraestructura México Global S.A. (aún siendo director)", type: "company", severity: "high", note: "Conflicto no reportado" },
      { date: "2021-02", title: "Renuncia como Director IMSS", type: "role", severity: "info" },
      { date: "2022-11", title: "Su empresa adjudica contrato CompraNet por MXN 890M", type: "contract", severity: "high", note: "19 meses después de dejar IMSS, mediante adjudicación directa" },
      { date: "2023-09", title: "Auditoría externa cuestiona obras entregadas (calidad inferior)", type: "relation", severity: "high" }
    ],
    flags: [
      {
        id: "mx1", severity: "high", title: { es: "Empresa fundada en cargo", en: "Company founded while in office" },
        evidence: {
          es: "Fundó empresa de construcción en 2019 mientras era Director del IMSS. Operó sin declarar conflicto durante 2 años.",
          en: "Founded construction company in 2019 while serving as IMSS Director. Operated without declaring conflict for 2 years."
        },
        source: { label: "Registro Público de Comercio + IMSS", url: "#" }
      },
      {
        id: "mx2", severity: "high", title: { es: "Adjudicación directa sin licitación", en: "Direct award without bidding" },
        evidence: {
          es: "Contrato de MXN 890M adjudicado por modalidad directa (sin competencia). Suma superior a límite de adjudicación directa (MXN 280M).",
          en: "Contract for MXN 890M awarded directly without competition. Amount exceeds direct award threshold (MXN 280M)."
        },
        source: { label: "CompraNet + Ley de Adquisiciones", url: "#" }
      }
    ],
    summary: {
      es: "Raúl Mendoza fue Director del IMSS (2018–2021). Mientras desempeñaba el cargo fundó Infraestructura México Global sin reportar conflicto. En 2022, su empresa adjudicó por modalidad directa un contrato de MXN 890M con el IMSS. Auditoría posterior cuestionó la calidad de las obras.",
      en: "Raúl Mendoza was IMSS Director (2018–2021). While in office, he founded Infraestructura México Global without reporting conflict. In 2022, his company was directly awarded a MXN 890M contract with IMSS. A subsequent audit questioned work quality."
    }
  },
};

window.SEARCH_INDEX = [
  // CHILE
  { id: "fuentes", name: "Carlos Fuentes Saavedra", type: "person", subtitle: "Ex-Subsecretario MOP · CL", risk: 78 },
  { id: "fuentes", name: "Constructora Los Andes SpA", type: "company", subtitle: "Construcción · CL", risk: 64 },
  { id: "errazuriz", name: "María José Errázuriz Pinto", type: "person", subtitle: "Diputada · Minería · CL", risk: 64 },
  { id: "errazuriz", name: "MineraPacífico Holdings", type: "company", subtitle: "Minería Cobre · CL", risk: 58 },
  { id: "losandes", name: "Servicios Patagonia Express SpA", type: "company", subtitle: "Logística · CL", risk: 82 },
  // COLOMBIA
  { id: "secop_colombia", name: "Jorge Valenzuela Méndez", type: "person", subtitle: "Ex-Procurador · CO", risk: 71 },
  { id: "secop_colombia", name: "Soluciones Integrales & Cía", type: "company", subtitle: "Consultoría · CO", risk: 68 },
  { id: "secop_colombia", name: "Diana Rojas Ospina", type: "person", subtitle: "Funcionaria MSALUD · CO", risk: 52 },
  // PERÚ
  { id: "mining_peru", name: "Vicente Alcántara Huamán", type: "person", subtitle: "Congresista · Minería · PE", risk: 76 },
  { id: "mining_peru", name: "Minería Altiplano SAC", type: "company", subtitle: "Cobre · PE", risk: 69 },
  { id: "mining_peru", name: "Comunidad Andina Yauricocha", type: "person", subtitle: "Pueblo afectado · PE", risk: 45 },
  // MÉXICO
  { id: "inframexico", name: "Raúl Mendoza Torres", type: "person", subtitle: "Ex-Director IMSS · MX", risk: 74 },
  { id: "inframexico", name: "Infraestructura México Global S.A.", type: "company", subtitle: "Infraestructura · MX", risk: 71 },
  { id: "inframexico", name: "Gerardo López Sánchez", type: "person", subtitle: "Director IMSS · MX", risk: 48 },
];

window.I18N = {
  es: {
    appName: "Mapa de Poder",
    tagline: "Conexiones entre poder político, empresas y contratos públicos en LATAM",
    searchPlaceholder: "Buscar persona, empresa, RUT o contrato…",
    suggested: "Casos destacados",
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
