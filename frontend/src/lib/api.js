import axios from 'axios';
import { DEMO_CASES, SEARCH_INDEX } from './demoData';
import {
  asArray,
  demoCaseSummary,
  fallbackCaseFromEntity,
  normalizeBackendGraph,
  normalizeBackendSearchResult,
  normalizeDemoCase,
  normalizeDemoSearchResult,
} from './adapters';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const USE_BACKEND = import.meta.env.VITE_USE_BACKEND !== 'false';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 6500,
});

export class ApiError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ApiError';
    this.cause = cause;
  }
}

function readableError(error) {
  if (error?.code === 'ECONNABORTED') return 'La API demoro demasiado en responder.';
  if (error?.response?.status) return `La API respondio con estado ${error.response.status}.`;
  if (error?.request) return 'El backend no esta disponible.';
  return 'No se pudo leer la API.';
}

async function request(path, config = {}) {
  if (!USE_BACKEND) {
    throw new ApiError('Backend desactivado por VITE_USE_BACKEND=false.');
  }
  try {
    const { data } = await client.get(path, config);
    return data;
  } catch (error) {
    throw new ApiError(readableError(error), error);
  }
}

function demoCaseById(caseId) {
  const key = String(caseId || '');
  return DEMO_CASES[key] ? normalizeDemoCase(DEMO_CASES[key]) : null;
}

function demoCaseSummaries() {
  return Object.values(DEMO_CASES).map(demoCaseSummary).filter(Boolean);
}

function fallbackSearch(query, limit = 8) {
  const lowered = String(query || '').trim().toLowerCase();
  if (!lowered) return [];
  return SEARCH_INDEX
    .filter(item =>
      item.name.toLowerCase().includes(lowered) ||
      item.subtitle.toLowerCase().includes(lowered)
    )
    .slice(0, limit)
    .map(normalizeDemoSearchResult)
    .filter(Boolean);
}

export async function healthCheck() {
  if (!USE_BACKEND) return { status: 'disabled', ok: false, demo: true };
  return request('/health');
}

export async function searchEntities(query, options = {}) {
  if (!query || query.trim().length < 2) return [];
  const limit = options.limit || 8;

  if (!USE_BACKEND) return fallbackSearch(query, limit);

  try {
    const data = await request('/search', {
      params: {
        q: query,
        type: options.type,
        country: options.country,
        limit,
      },
    });
    return asArray(data).map(normalizeBackendSearchResult).filter(Boolean);
  } catch {
    return fallbackSearch(query, limit);
  }
}

export async function getEntity(entityId) {
  const data = await request(`/entities/${entityId}`);
  return normalizeBackendSearchResult(data);
}

export async function getEntityGraph(entityId, options = {}) {
  const depth = options.depth || 2;
  const demoCase = options.caseId ? demoCaseById(options.caseId) : demoCaseById(entityId);

  if (!USE_BACKEND) {
    if (demoCase) return demoCase;
    throw new ApiError('Backend desactivado y no hay caso demo equivalente.');
  }

  try {
    const data = await request(`/graph/${entityId}`, { params: { depth } });
    return normalizeBackendGraph(data);
  } catch (error) {
    if (demoCase) return demoCase;
    throw error;
  }
}

export async function getCases() {
  if (!USE_BACKEND) return demoCaseSummaries();

  try {
    const data = await request('/cases');
    const cases = asArray(data).map(normalizeBackendSearchResult).filter(Boolean);
    return cases.length ? cases : demoCaseSummaries();
  } catch {
    return demoCaseSummaries();
  }
}

export async function getCase(caseId) {
  const demoCase = demoCaseById(caseId);
  if (!USE_BACKEND) {
    if (demoCase) return demoCase;
    throw new ApiError('Backend desactivado y no hay caso demo equivalente.');
  }

  try {
    const data = await request(`/cases/${caseId}`);
    return normalizeBackendGraph(data);
  } catch (error) {
    if (demoCase) return demoCase;
    throw error;
  }
}

export function getDemoCase(caseId) {
  return demoCaseById(caseId);
}

export function getDemoCases() {
  return demoCaseSummaries();
}

export function entityToFallbackCase(entity) {
  return fallbackCaseFromEntity(entity);
}
