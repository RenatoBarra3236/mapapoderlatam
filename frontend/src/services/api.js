// Thin API client.
// - In dev: Vite proxies `/api` → http://localhost:3001 (see vite.config.js).
// - In prod (Vercel/Netlify): set VITE_API_URL to the deployed backend, e.g.
//   `https://redpoder-backend.onrender.com/api`.
// Trailing slash gets stripped so endpoint paths concatenate cleanly.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

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

export async function postAppeal(caseId, body) {
  const res = await fetch(`${BASE}/appeals/${caseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
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
