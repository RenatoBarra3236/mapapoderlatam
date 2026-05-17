export function formatDate(raw, lang = 'es') {
  if (!raw) return null;
  const iso = String(raw).length === 10 ? `${raw}T12:00:00Z` : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(raw);
  try {
    return d.toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(raw);
  }
}

export function formatConfidence(score) {
  if (score == null) return null;
  const pct = Math.round(Number(score) * 100);
  return isNaN(pct) ? null : `${pct}%`;
}

export function formatRiskScore(value) {
  const n = Number(value);
  return isNaN(n) ? '—' : String(n);
}
