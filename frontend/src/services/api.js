// Thin API client. Vite proxies /api → http://localhost:3001 (vite.config.js).

const BASE = '/api';

export async function fetchSummary(caseId, lang) {
  const res = await fetch(`${BASE}/ai/summary/${caseId}?lang=${lang}`);
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return res.json();
}

export async function fetchFlags(caseId, lang) {
  const res = await fetch(`${BASE}/flags/${caseId}?lang=${lang}`);
  if (!res.ok) throw new Error(`flags ${res.status}`);
  return res.json();
}

export async function postChat(caseId, { question, lang, history }) {
  const res = await fetch(`${BASE}/ai/chat/${caseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, lang, history })
  });
  if (!res.ok) throw new Error(`chat ${res.status}`);
  return res.json();
}
