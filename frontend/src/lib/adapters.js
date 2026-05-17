const BACKEND_TYPE_LABELS = {
  es: {
    person: 'Persona',
    public_official: 'Autoridad',
    company: 'Empresa',
    organization: 'Organizacion',
    public_body: 'Organismo publico',
    contract: 'Contrato',
    tender: 'Licitacion',
    purchase_order: 'Orden de compra',
    lobby_audience: 'Audiencia de lobby',
    donation: 'Donativo',
    travel: 'Viaje',
    asset_declaration: 'Declaracion de intereses',
    political_party: 'Partido politico',
    campaign: 'Campana',
    foundation: 'Fundacion',
    transfer: 'Transferencia',
    source_document: 'Documento fuente',
    unknown: 'Entidad',
  },
  en: {
    person: 'Person',
    public_official: 'Public official',
    company: 'Company',
    organization: 'Organization',
    public_body: 'Public body',
    contract: 'Contract',
    tender: 'Tender',
    purchase_order: 'Purchase order',
    lobby_audience: 'Lobby audience',
    donation: 'Donation',
    travel: 'Travel',
    asset_declaration: 'Asset declaration',
    political_party: 'Political party',
    campaign: 'Campaign',
    foundation: 'Foundation',
    transfer: 'Transfer',
    source_document: 'Source document',
    unknown: 'Entity',
  },
};

const RELATION_LABELS = {
  es: {
    awarded_to: 'Adjudicado a',
    awarded: 'Adjudico',
    issued_by: 'Emitido por',
    purchased_from: 'Compro a',
    participated_in: 'Participo en',
    owns: 'Posee/dirige',
    represents: 'Representa',
    represented: 'Represento a',
    represented_in: 'Representado en',
    employed_by: 'Empleado por',
    employer_of: 'Empleador de',
    attended: 'Asistio',
    attended_unofficially: 'Asistio informalmente',
    met_with: 'Se reunio con',
    lobbied: 'Hizo lobby ante',
    registered_by: 'Registrado por',
    declared_interest_in: 'Declaro interes en',
    donated_to: 'Dono a',
    gave_donation_to: 'Entrego donativo a',
    received_donation: 'Recibio donativo',
    funded: 'Financio',
    transferred_to: 'Transfirio a',
    member_of: 'Miembro de',
    former_role: 'Cargo previo',
    family_of: 'Familiar de',
    signed: 'Firmo',
    holds_role_in: 'Tiene cargo en',
    made_travel: 'Viaje registrado',
    funded_by: 'Financiado por',
    related_to: 'Relacionado con',
  },
  en: {
    awarded_to: 'Awarded to',
    awarded: 'Awarded',
    issued_by: 'Issued by',
    purchased_from: 'Purchased from',
    participated_in: 'Participated in',
    owns: 'Owns/directs',
    represents: 'Represents',
    represented: 'Represented',
    represented_in: 'Represented in',
    employed_by: 'Employed by',
    employer_of: 'Employer of',
    attended: 'Attended',
    attended_unofficially: 'Attended unofficially',
    met_with: 'Met with',
    lobbied: 'Lobbied',
    registered_by: 'Registered by',
    declared_interest_in: 'Declared interest in',
    donated_to: 'Donated to',
    gave_donation_to: 'Gave donation to',
    received_donation: 'Received donation',
    funded: 'Funded',
    transferred_to: 'Transferred to',
    member_of: 'Member of',
    former_role: 'Former role',
    family_of: 'Family of',
    signed: 'Signed',
    holds_role_in: 'Holds role in',
    made_travel: 'Registered travel',
    funded_by: 'Funded by',
    related_to: 'Related to',
  },
};

const CONTRACT_TYPES = new Set([
  'contract',
  'tender',
  'purchase_order',
  'lobby_audience',
  'donation',
  'travel',
  'asset_declaration',
  'campaign',
  'transfer',
  'source_document',
]);

const COMPANY_TYPES = new Set([
  'company',
  'organization',
  'public_body',
  'political_party',
  'foundation',
]);

export function asArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizedType(type) {
  return safeString(type, 'unknown').trim().toLowerCase() || 'unknown';
}

export function visualType(type) {
  const rawType = normalizedType(type);
  if (rawType === 'person' || rawType === 'public_official') return 'person';
  if (COMPANY_TYPES.has(rawType)) return 'company';
  if (CONTRACT_TYPES.has(rawType)) return 'contract';
  return 'contract';
}

function titleize(value) {
  return safeString(value, 'Entidad')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function typeLabel(type, lang = 'es') {
  const rawType = normalizedType(type);
  return BACKEND_TYPE_LABELS[lang]?.[rawType] || titleize(rawType);
}

export function relationLabel(type, lang = 'es') {
  const rawType = normalizedType(type || 'related_to');
  return RELATION_LABELS[lang]?.[rawType] || titleize(rawType);
}

function resolveRisk(item) {
  return safeNumber(item?.riskScore ?? item?.risk_score ?? item?.risk, 0);
}

function resolveMetadata(item) {
  return item?.metadata || item?.meta || {};
}

function resolveCountry(item, metadata = {}) {
  return safeString(item?.country || item?.country_code || metadata.country || 'CL', 'CL');
}

function sourceLabel(item, metadata = {}) {
  return safeString(
    item?.sourceName ||
      item?.source_name ||
      item?.source?.label ||
      metadata.source_name ||
      metadata.source ||
      '',
  );
}

function humanSubtitle(rawType, country, sourceName = '') {
  return [typeLabel(rawType, 'es'), country, sourceName].filter(Boolean).join(' · ');
}

export function normalizeBackendSearchResult(raw) {
  const id = raw?.id ?? raw?.entityId ?? raw?.entity_id;
  if (id === null || id === undefined) return null;
  const metadata = resolveMetadata(raw);
  const rawType = normalizedType(raw?.type || raw?.entity_type || metadata.type);
  const country = resolveCountry(raw, metadata);
  const sourceName = sourceLabel(raw, metadata);
  return {
    id: safeString(id),
    entityId: safeString(raw?.entityId ?? raw?.entity_id ?? id),
    caseId: raw?.caseId ? safeString(raw.caseId) : null,
    name: safeString(raw?.name || raw?.display_name || raw?.canonical_name, `Entidad ${id}`),
    type: visualType(rawType),
    rawType,
    typeLabel: { es: typeLabel(rawType, 'es'), en: typeLabel(rawType, 'en') },
    subtitle: safeString(raw?.subtitle || metadata.subtitle, humanSubtitle(rawType, country, sourceName)),
    country,
    risk: resolveRisk(raw),
    meta: metadata,
    sourceMode: raw?.sourceMode || raw?.source_mode || metadata.source_mode,
    sourceName,
    fromApi: true,
    fromDemo: false,
  };
}

export function normalizeDemoSearchResult(raw) {
  if (!raw) return null;
  const rawType = normalizedType(raw.type);
  return {
    id: safeString(raw.id),
    entityId: raw.entityId ? safeString(raw.entityId) : null,
    caseId: safeString(raw.caseId || raw.id),
    name: safeString(raw.name, 'Caso demo'),
    type: visualType(rawType),
    rawType,
    typeLabel: { es: typeLabel(rawType, 'es'), en: typeLabel(rawType, 'en') },
    subtitle: safeString(raw.subtitle, humanSubtitle(rawType, raw.country || 'CL')),
    country: safeString(raw.country || 'CL'),
    risk: safeNumber(raw.risk, 0),
    meta: raw.meta || {},
    sourceMode: 'fixture',
    sourceName: 'demo',
    fromApi: false,
    fromDemo: true,
  };
}

export function demoCaseSummary(caseData) {
  const normalized = normalizeDemoCase(caseData);
  const root = normalized.nodes.find(n => n.id === normalized.rootId) || normalized.nodes[0];
  if (!root) return null;
  return {
    id: normalized.id,
    entityId: root.id,
    caseId: normalized.id,
    name: root.name,
    type: root.type,
    rawType: root.rawType,
    typeLabel: root.typeLabel,
    subtitle: root.subtitle,
    description: normalized.summary?.es || root.subtitle,
    country: root.country,
    risk: root.risk,
    sourceMode: 'fixture',
    sourceName: 'demo',
    fromDemo: true,
    fromApi: false,
  };
}

export function normalizeBackendNode(node, index = 0, rootId = null) {
  const id = safeString(node?.id ?? node?.entity_id ?? node?.entityId, `node-${index}`);
  const metadata = resolveMetadata(node);
  const rawType = normalizedType(node?.type || node?.entity_type || metadata.type);
  const country = resolveCountry(node, metadata);
  return {
    id,
    type: visualType(rawType),
    rawType,
    typeLabel: { es: typeLabel(rawType, 'es'), en: typeLabel(rawType, 'en') },
    name: safeString(node?.name || node?.display_name || node?.canonical_name, `Entidad ${id}`),
    subtitle: safeString(node?.subtitle || metadata.subtitle, humanSubtitle(rawType, country, sourceLabel(node, metadata))),
    country,
    risk: resolveRisk(node),
    riskScore: resolveRisk(node),
    meta: metadata,
    sources: asArray(node?.sources),
    isEntity: Boolean(node?.isEntity || node?.is_entity || rawType === 'public_body' || node?.id === rootId),
    x: id === rootId || index === 0 ? 0 : undefined,
    y: id === rootId || index === 0 ? 0 : undefined,
  };
}

export function normalizeBackendEdge(edge, index = 0) {
  const source = edge?.s ?? edge?.source ?? edge?.source_id ?? edge?.source_entity_id ?? edge?.from;
  const target = edge?.t ?? edge?.target ?? edge?.target_id ?? edge?.target_entity_id ?? edge?.to;
  if (source === null || source === undefined || target === null || target === undefined) return null;
  const rawType = normalizedType(edge?.type || edge?.relationship_type);
  const metadata = edge?.metadata || edge?.meta || {};
  const confidence = safeNumber(edge?.confidenceScore ?? edge?.confidence_score ?? metadata.confidence_score, 1);
  return {
    id: safeString(edge?.id, `edge-${index}`),
    s: safeString(source),
    t: safeString(target),
    type: rawType,
    label: safeString(edge?.label || relationLabel(rawType, 'es'), relationLabel(rawType, 'es')),
    labelI18n: { es: relationLabel(rawType, 'es'), en: relationLabel(rawType, 'en') },
    weight: safeNumber(edge?.weight, 1),
    confidenceScore: confidence,
    flag: Boolean(edge?.flag || edge?.suspicious || confidence < 0.55),
    metadata,
    sourceId: edge?.sourceId ?? edge?.source_id ?? metadata.source_id ?? null,
  };
}

export function normalizeSource(source) {
  if (!source) return null;
  const metadata = source.metadata || source.meta || {};
  const id = source.id ?? source.source_id ?? source.externalId ?? source.external_id ?? source.sourceUrl ?? source.source_url;
  return {
    id: safeString(id, source.sourceName || source.source_name || 'source'),
    label: safeString(source.label || source.sourceName || source.source_name || metadata.source_name, 'Fuente registrada'),
    type: safeString(source.sourceType || source.source_type || metadata.source_type, ''),
    url: safeString(source.url || source.sourceUrl || source.source_url, ''),
    externalId: safeString(source.externalId || source.external_id, ''),
    fetchedAt: safeString(source.fetchedAt || source.fetched_at, ''),
    license: safeString(source.license || metadata.license, ''),
    metadata,
  };
}

function normalizeFlag(flag, index = 0) {
  const severity = normalizedType(flag?.severity);
  const safeSeverity = ['high', 'medium', 'low'].includes(severity) ? severity : severity === 'warn' ? 'medium' : 'low';
  const title = flag?.title;
  const evidence = flag?.evidence || flag?.description;
  return {
    id: safeString(flag?.id, `flag-${index}`),
    severity: safeSeverity,
    type: safeString(flag?.type || flag?.flag_type, 'risk_flag'),
    title: typeof title === 'object'
      ? { es: safeString(title.es || title.en, 'Senal de riesgo'), en: safeString(title.en || title.es, 'Risk signal') }
      : { es: safeString(title, 'Senal de riesgo'), en: safeString(title, 'Risk signal') },
    evidence: typeof evidence === 'object'
      ? { es: safeString(evidence.es || evidence.en), en: safeString(evidence.en || evidence.es) }
      : { es: safeString(evidence), en: safeString(evidence) },
    source: {
      label: safeString(flag?.source?.label || flag?.source_name, 'Fuente registrada'),
      url: safeString(flag?.source?.url || flag?.source_url || '#', '#'),
    },
    metadata: flag?.metadata || flag?.meta || {},
  };
}

function normalizeTimelineEvent(event, index = 0) {
  if (!event) return null;
  const date = event.date || event.valid_from || event.created_at || event.fetched_at;
  if (!date) return null;
  return {
    date: safeString(date).slice(0, 10),
    title: safeString(event.title || event.label || event.name, 'Evento documentado'),
    type: safeString(event.type || 'event'),
    severity: ['high', 'warn', 'medium', 'low', 'info'].includes(event.severity) ? event.severity : 'info',
    note: safeString(event.note || event.description || event.evidence, ''),
    id: safeString(event.id, `timeline-${index}`),
  };
}

function pickMetadataDate(metadata = {}) {
  const dates = metadata.dates || {};
  const candidates = [
    metadata.date,
    metadata.created_at,
    metadata.updated_at,
    metadata.valid_from,
    metadata.fetched_at,
    dates.FechaAdjudicacion,
    dates.FechaPublicacion,
    dates.FechaCreacion,
    dates.FechaEnvio,
    dates.FechaInicio,
  ];
  return candidates.find(Boolean);
}

function derivedTimeline(nodes, edges, sources) {
  const events = [];
  nodes.forEach(node => {
    const date = pickMetadataDate(node.meta);
    if (!date) return;
    events.push({
      date: safeString(date).slice(0, 10),
      title: `${typeLabel(node.rawType, 'es')} registrado: ${node.name}`,
      severity: node.risk >= 65 ? 'high' : node.risk >= 40 ? 'warn' : 'info',
      note: node.subtitle,
      type: node.rawType,
    });
  });
  edges.forEach(edge => {
    const date = edge.metadata.valid_from || edge.metadata.date || edge.metadata.created_at;
    if (!date) return;
    events.push({
      date: safeString(date).slice(0, 10),
      title: `Relacion documentada: ${edge.label}`,
      severity: edge.flag ? 'warn' : 'info',
      note: edge.confidenceScore < 1 ? `Confianza: ${Math.round(edge.confidenceScore * 100)}%` : '',
      type: edge.type,
    });
  });
  sources.forEach(source => {
    if (!source.fetchedAt) return;
    events.push({
      date: source.fetchedAt.slice(0, 10),
      title: `Fuente registrada: ${source.label}`,
      severity: 'info',
      note: source.type,
      type: 'source',
    });
  });
  return events
    .filter(event => event.date)
    .sort((a, b) => safeString(a.date).localeCompare(safeString(b.date)))
    .slice(0, 12);
}

function deterministicSummary(root, nodes, edges, sources) {
  const rootName = root?.name || 'esta entidad';
  return {
    es: `Esta vista muestra una red centrada en ${rootName}. Se encontraron ${nodes.length} entidades y ${edges.length} relaciones documentadas a partir de fuentes publicas registradas en el backend${sources.length ? ` (${sources.length} fuentes asociadas)` : ''}. El grafo describe vinculos relevantes para revisar, sin afirmar ilegalidad por si solo.`,
    en: `This view shows a network centered on ${rootName}. It contains ${nodes.length} entities and ${edges.length} documented relationships from public sources registered in the backend${sources.length ? ` (${sources.length} linked sources)` : ''}. The graph describes relevant ties for review and does not imply wrongdoing by itself.`,
  };
}

export function normalizeBackendGraph(rawGraph = {}, centerEntity = null) {
  const rawNodes = asArray(rawGraph.nodes).length ? asArray(rawGraph.nodes) : asArray(rawGraph.entities);
  const rawEdges = asArray(rawGraph.edges).length ? asArray(rawGraph.edges) : asArray(rawGraph.relationships);
  const inferredRoot = rawGraph.rootId || rawGraph.root_id || rawGraph.center || rawGraph.id || centerEntity?.id || rawNodes[0]?.id;
  const mappedRootId = safeString(inferredRoot);

  let nodes = rawNodes.map((node, index) => normalizeBackendNode(node, index, mappedRootId));
  if (!nodes.length && centerEntity) nodes = [normalizeBackendNode(centerEntity, 0, safeString(centerEntity.id))];
  const nodeIds = new Set(nodes.map(node => node.id));
  const rootId = nodeIds.has(mappedRootId) ? mappedRootId : (nodes[0]?.id || mappedRootId);
  const edges = rawEdges
    .map(normalizeBackendEdge)
    .filter(edge => edge && nodeIds.has(edge.s) && nodeIds.has(edge.t));
  const sources = asArray(rawGraph.sources).map(normalizeSource).filter(Boolean);
  const flags = asArray(rawGraph.flags).map(normalizeFlag);
  const root = nodes.find(node => node.id === rootId) || nodes[0];
  const timeline = asArray(rawGraph.timeline).map(normalizeTimelineEvent).filter(Boolean);

  return {
    id: rootId,
    rootId,
    title: root?.name || 'Red de entidades',
    subtitle: root?.subtitle || '',
    nodes,
    edges,
    flags,
    timeline: timeline.length ? timeline : derivedTimeline(nodes, edges, sources),
    sources,
    summary: rawGraph.summary || deterministicSummary(root, nodes, edges, sources),
    profile: rawGraph.profile || root?.meta || {},
    dataMode: 'api',
    fromApi: true,
    fromDemo: false,
    partial: !rawNodes.length || !rawEdges.length,
  };
}

export function normalizeDemoCase(caseData = {}) {
  const rootId = safeString(caseData.rootId || caseData.id);
  const nodes = asArray(caseData.nodes).map((node, index) => {
    const rawType = normalizedType(node.type);
    const id = safeString(node.id, `demo-node-${index}`);
    return {
      ...node,
      id,
      type: visualType(rawType),
      rawType,
      typeLabel: { es: typeLabel(rawType, 'es'), en: typeLabel(rawType, 'en') },
      country: safeString(node.country || 'CL'),
      risk: resolveRisk(node),
      riskScore: resolveRisk(node),
      meta: node.meta || {},
      isEntity: Boolean(node.isEntity),
    };
  });
  const edges = asArray(caseData.edges).map((edge, index) => ({
    ...edge,
    id: safeString(edge.id, `demo-edge-${index}`),
    s: safeString(edge.s),
    t: safeString(edge.t),
    type: normalizedType(edge.type),
    label: safeString(edge.label || relationLabel(edge.type, 'es'), relationLabel(edge.type, 'es')),
    labelI18n: { es: relationLabel(edge.type, 'es'), en: relationLabel(edge.type, 'en') },
    weight: safeNumber(edge.weight, 1),
    confidenceScore: safeNumber(edge.confidenceScore ?? edge.confidence_score, 1),
    flag: Boolean(edge.flag),
    metadata: edge.metadata || {},
  }));
  return {
    ...caseData,
    id: safeString(caseData.id),
    rootId,
    nodes,
    edges,
    flags: asArray(caseData.flags).map(normalizeFlag),
    timeline: asArray(caseData.timeline).map(normalizeTimelineEvent).filter(Boolean),
    sources: asArray(caseData.sources).map(normalizeSource).filter(Boolean),
    summary: caseData.summary || deterministicSummary(nodes.find(node => node.id === rootId), nodes, edges, []),
    dataMode: 'demo',
    fromDemo: true,
    fromApi: false,
  };
}

export function fallbackCaseFromEntity(entity) {
  const node = normalizeBackendNode(entity, 0, safeString(entity?.id || entity?.entityId));
  return {
    id: node.id,
    rootId: node.id,
    title: node.name,
    subtitle: node.subtitle,
    nodes: [node],
    edges: [],
    flags: [],
    timeline: derivedTimeline([node], [], []),
    sources: [],
    summary: deterministicSummary(node, [node], [], []),
    profile: node.meta,
    dataMode: 'api',
    fromApi: true,
    fromDemo: false,
    partial: true,
  };
}
