// Demo data – 3 fictional LATAM cases with graph + timeline + red flags
// All names and entities are FICTIONAL. Sources are placeholders.

export const DEMO_CASES = {
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
      { date: "2022-09", title: "Adjudicación Concesión Ruta 68 – Tramo 4", type: "contract", severity: "high", note: "CLP 184.500M – durante su gestión" },
      { date: "2022-12", title: "Deja el cargo público", type: "role", severity: "info" },
      { date: "2024-01", title: "Asume como Director de Constructora Los Andes SpA", type: "role", severity: "high", note: "Puerta giratoria – < 18 meses tras dejar el cargo" }
    ],
    flags: [
      {
        id: "f1", severity: "high", title: { es: "Puerta giratoria", en: "Revolving door" },
        evidence: {
          es: "Pasa de Subsecretario MOP (2018–2022) a Director de una empresa que adjudicó CLP 184.500M durante su gestión. Plazo entre cargos: 13 meses.",
          en: "Moves from Deputy Minister of Public Works (2018–2022) to Director of a company awarded CLP 184.5B during his tenure. Cooling period: 13 months."
        }
      },
      {
        id: "f2", severity: "high", title: { es: "Conflicto de interés familial", en: "Family conflict of interest" },
        evidence: {
          es: "Su hija es asesora legal de la empresa que dirige, creando un conflicto potencial.",
          en: "His daughter is the legal advisor to the company he leads, creating potential conflict."
        }
      },
      {
        id: "f3", severity: "medium", title: { es: "Estructura corporativa opaca", en: "Opaque structure" },
        evidence: {
          es: "Usa Inversiones Cordillera (holding familiar) como vehículo de inversión indirecta.",
          en: "Uses Inversiones Cordillera (family holding) as indirect investment vehicle."
        }
      }
    ],
    summary: {
      es: "Carlos Fuentes es un ejemplo clásico de 'puerta giratoria': pasó de funcionario público a director de una empresa que se benefició directamente de decisiones que él ayudó a tomar. Su familia está profundamente integrada en la estructura corporativa.",
      en: "Carlos Fuentes is a classic case of a 'revolving door': he moved from public office to directing a company that directly benefited from decisions he helped make. His family is deeply integrated in the corporate structure."
    }
  },
  errazuriz: {
    id: "errazuriz",
    rootId: 101,
    nodes: [
      { id: 101, type: "person", name: "Alejandra Errázuriz Menéndez", subtitle: "Presidenta Ejecutiva", country: "CL", risk: 55, x: 0, y: 0,
        meta: { sector: "Retail / Distribución", experience: "20 años en comercio" } },
      { id: 102, type: "company", name: "Grupo Errázuriz S.A.", country: "CL", risk: 48, x: -200, y: -100,
        meta: { employees: "2,800", founded: "1995", revenue: "CLP 450.000M" } },
      { id: 103, type: "person", name: "Roberto Errázuriz Menéndez", subtitle: "Hermano / Consejero", country: "CL", risk: 42, x: -200, y: 100,
        meta: { role: "Consejero desde 2015" } },
      { id: 104, type: "company", name: "Inversora Familia Errázuriz", country: "CL", risk: 50, x: -350, y: 0,
        meta: { sector: "Holding de inversiones" } },
      { id: 105, type: "person", name: "Juan Carlos Aguilar", subtitle: "Proveedor clave", country: "CL", risk: 38, x: 200, y: -100,
        meta: { relationship: "Proveedor de logística" } },
      { id: 106, type: "company", name: "LogisticaPro SpA", country: "CL", risk: 35, x: 350, y: -100,
        meta: { contracts: "Grupo Errázuriz (2010–)" } }
    ],
    edges: [
      { s: 101, t: 102, type: "owns", label: "Presidenta Ejecutiva, 35% participación", weight: 0.35 },
      { s: 103, t: 102, type: "owns", label: "Consejero, 25% participación", weight: 0.25 },
      { s: 102, t: 104, type: "owns", label: "Controlada por", weight: 1 },
      { s: 101, t: 104, type: "owns", label: "Beneficiaria final (70%)", weight: 0.7 },
      { s: 102, t: 105, type: "signed", label: "Proveedor exclusivo (20 años)", weight: 1 },
      { s: 105, t: 106, type: "owns", label: "Propietario 60%", weight: 0.6 }
    ],
    timeline: [
      { date: "1995-07", title: "Fundación de Grupo Errázuriz", type: "company", severity: "info" },
      { date: "2010-03", title: "LogisticaPro comienza como proveedor", type: "contract", severity: "info" },
      { date: "2015-01", title: "Roberto ingresa como consejero", type: "role", severity: "info" },
      { date: "2020-06", title: "Alejandra asume presidencia ejecutiva", type: "role", severity: "info" },
      { date: "2023-09", title: "Auditoría revela concentración de proveedores", type: "contract", severity: "warn" }
    ],
    flags: [
      {
        id: "f4", severity: "medium", title: { es: "Concentración de proveedores", en: "Supplier concentration" },
        evidence: {
          es: "LogisticaPro, relacionada al propietario Juan Carlos Aguilar, es proveedor exclusivo hace 20 años.",
          en: "LogisticaPro, related to owner Juan Carlos Aguilar, has been exclusive provider for 20 years."
        }
      }
    ],
    summary: {
      es: "Grupo Errázuriz es controlado por la familia Errázuriz a través de una estructura de holding. Existe potencial conflicto de interés en la relación con proveedores clave.",
      en: "Grupo Errázuriz is controlled by the Errázuriz family through a holding structure. Potential conflict of interest exists in key supplier relationships."
    }
  },
  losandes: {
    id: "losandes",
    rootId: 201,
    nodes: [
      { id: 201, type: "company", name: "Constructora Los Andes Fantasma SpA", country: "CL", risk: 89, x: 0, y: 0,
        meta: { founded: "2022-03-15", status: "Activa", employees: "12 (registrados)" } },
      { id: 202, type: "person", name: "Marco Venegas Cortés", subtitle: "Gerente General", country: "CL", risk: 85, x: -250, y: -50,
        meta: { background: "Sin experiencia previa en construcción" } },
      { id: 203, type: "person", name: "Patricia Soto López", subtitle: "Accionista oculta", country: "CL", risk: 82, x: -250, y: 50,
        meta: { relationship: "Exfuncionaria de Bienes Nacionales" } },
      { id: 204, type: "contract", name: "Licitación 2023-045 (Puente Collipullí)", country: "CL", risk: 88, x: 250, y: 0,
        meta: { awarded: "2023-08-15", amount: "CLP 856.200M", duration: "36 meses" } },
      { id: 205, type: "contract", name: "Licitación 2023-089 (Caminos Rurales Ñuble)", country: "CL", risk: 84, x: 250, y: -120,
        meta: { awarded: "2023-11-22", amount: "CLP 342.100M" } }
    ],
    edges: [
      { s: 202, t: 201, type: "owns", label: "Gerente General, 30% participación", weight: 0.3 },
      { s: 203, t: 201, type: "owns", label: "Accionista oculta (70%)", weight: 0.7, flag: true },
      { s: 201, t: 204, type: "awarded", label: "Ganadora", weight: 1 },
      { s: 201, t: 205, type: "awarded", label: "Ganadora", weight: 1 },
      { s: 203, t: 204, type: "signed", label: "Influencia indirecta", weight: 1 }
    ],
    timeline: [
      { date: "2022-03", title: "Constitución de Constructora Los Andes Fantasma SpA", type: "company", severity: "high", note: "Dirección registrada es una oficina compartida" },
      { date: "2023-08", title: "Adjudicación Licitación 2023-045 (CLP 856.200M)", type: "contract", severity: "high" },
      { date: "2023-11", title: "Adjudicación Licitación 2023-089 (CLP 342.100M)", type: "contract", severity: "high" },
      { date: "2024-02", title: "Auditoria detecta irregularidades en documentación", type: "contract", severity: "high" }
    ],
    flags: [
      {
        id: "f5", severity: "high", title: { es: "Empresa fantasma", en: "Shell company" },
        evidence: {
          es: "Creada 5 meses antes de ganar licitaciones por CLP 1.198B. Personal registrado no existe en domicilios públicos.",
          en: "Created 5 months before winning bids worth CLP 1.2B. Registered staff don't exist at public addresses."
        }
      },
      {
        id: "f6", severity: "high", title: { es: "Accionista oculta con conflicto", en: "Hidden stakeholder with conflict" },
        evidence: {
          es: "Patricia Soto López era funcionaria de Bienes Nacionales, el ministerio que adjudica estas licitaciones.",
          en: "Patricia Soto López was an official at Bienes Nacionales, the ministry awarding these contracts."
        }
      }
    ],
    summary: {
      es: "Caso de alto riesgo: Empresa creada semanas antes de adjudicarse contratos por más de mil millones. Accionista oculta con relaciones directas al ministerio que adjudica. Documentación presenta irregularidades graves.",
      en: "High-risk case: Company created weeks before winning contracts worth over $1B. Hidden shareholder with direct ties to awarding ministry. Documentation shows serious irregularities."
    }
  }
};

export const SEARCH_INDEX = [
  { id: "fuentes", caseId: "fuentes", name: "Carlos Fuentes Saavedra", subtitle: "Ex-Subsecretario de Obras Públicas", type: "person" },
  { id: "fuentes-empresa", caseId: "fuentes", name: "Constructora Los Andes SpA", subtitle: "Empresa relacionada", type: "company" },
  { id: "errazuriz", caseId: "errazuriz", name: "Alejandra Errázuriz Menéndez", subtitle: "Presidenta Ejecutiva", type: "person" },
  { id: "errazuriz-empresa", caseId: "errazuriz", name: "Grupo Errázuriz S.A.", subtitle: "Empresa principal", type: "company" },
  { id: "losandes", caseId: "losandes", name: "Constructora Los Andes Fantasma SpA", subtitle: "Empresa de alto riesgo", type: "company" },
  { id: "losandes-gerente", caseId: "losandes", name: "Marco Venegas Cortés", subtitle: "Gerente General", type: "person" }
];

export const I18N = {
  es: {
    appTitle: "Mapa de Poder LATAM",
    searchPlaceholder: "Buscar RUT, nombre o empresa...",
    suggested: "Casos sugeridos",
    neural: "🧠 Red Neuronal",
    orbit: "🌐 Órbitas",
    timeline: "📈 Línea de tiempo",
    table: "📊 Tabla"
  },
  en: {
    appTitle: "Power Map LATAM",
    searchPlaceholder: "Search RUT, name or company...",
    suggested: "Suggested cases",
    neural: "🧠 Neural Network",
    orbit: "🌐 Orbits",
    timeline: "📈 Timeline",
    table: "📊 Table"
  }
};

export const RELATION_LABELS = {
  owns: { es: "Propietario", en: "Owner" },
  awarded: { es: "Adjudicada", en: "Awarded" },
  signed: { es: "Firmó/Asesora", en: "Signed/Advises" },
  family_of: { es: "Familiar de", en: "Family of" },
  former_role: { es: "Rol anterior", en: "Former role" }
};
