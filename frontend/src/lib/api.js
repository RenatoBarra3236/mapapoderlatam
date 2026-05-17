import axios from 'axios';
import { DEMO_CASES, SEARCH_INDEX } from './demoData';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});

export async function healthCheck() {
  const { data } = await client.get('/health');
  return data;
}

export async function searchEntities(query, options = {}) {
  if (!query || query.trim().length < 2) return [];
  try {
    const { data } = await client.get('/search', {
      params: {
        q: query,
        type: options.type,
        country: options.country,
        limit: options.limit || 8,
      },
    });
    return (Array.isArray(data) ? data : data.results || []).map(item => ({
      id: item.id,
      entityId: item.id,
      name: item.name,
      type: item.type,
      subtitle: `${item.type} · ${item.country || 'CL'}`,
      risk: item.riskScore ?? item.risk_score ?? 0,
      fromApi: true,
    }));
  } catch {
    const lowered = query.trim().toLowerCase();
    return SEARCH_INDEX.filter(r =>
      r.name.toLowerCase().includes(lowered) ||
      r.subtitle.toLowerCase().includes(lowered)
    ).slice(0, options.limit || 8);
  }
}

export async function getEntityGraph(entityId, depth = 2) {
  const { data } = await client.get(`/graph/${entityId}`, { params: { depth } });
  return mapGraphToCase(data);
}

export async function getCases() {
  const { data } = await client.get('/cases');
  return data;
}

export async function getCase(caseId) {
  const { data } = await client.get(`/cases/${caseId}`);
  return mapGraphToCase(data);
}

export function getDemoCase(caseId) {
  return DEMO_CASES[caseId] || null;
}

function mapGraphToCase(graph) {
  const rootId = String(graph.rootId || graph.center);
  return {
    id: rootId,
    rootId,
    nodes: (graph.nodes || []).map((node, index) => ({
      id: String(node.id),
      type: node.type || 'unknown',
      name: node.name,
      subtitle: node.subtitle || node.metadata?.subtitle,
      country: node.country || 'CL',
      risk: node.riskScore ?? node.risk ?? 0,
      meta: node.meta || node.metadata || {},
      x: index === 0 ? 0 : undefined,
      y: index === 0 ? 0 : undefined,
    })),
    edges: (graph.edges || []).map(edge => ({
      id: String(edge.id),
      s: String(edge.s || edge.source || edge.source_id),
      t: String(edge.t || edge.target || edge.target_id),
      type: edge.type,
      label: edge.label,
      weight: edge.weight ?? 1,
      flag: Boolean(edge.flag || edge.suspicious),
      metadata: edge.metadata || {},
    })),
    flags: graph.flags || [],
    timeline: graph.timeline || [],
    sources: graph.sources || [],
    summary: graph.summary || {
      es: 'Datos cargados desde la API. IA real no habilitada en esta fase.',
      en: 'Data loaded from the API. Real AI is not enabled in this phase.',
    },
  };
}
