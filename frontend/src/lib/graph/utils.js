export function typeColor(node) {
  if (node.isEntity) return 'var(--ink-3)';
  if (node.type === 'person') return 'var(--c-person)';
  if (node.type === 'company') return 'var(--c-company)';
  return 'var(--c-contract)';
}

export function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// Short label shown on edges by default — prefers any "%" in the label,
// else converts a fractional weight to a percentage.
export function shortEdgeLabel(edge) {
  const m = String(edge.label || '').match(/(\d+(\.\d+)?\s*%)/);
  if (m) return m[1].replace(/\s+/g, '');
  if (typeof edge.weight === 'number' && edge.weight > 0 && edge.weight < 1) {
    return Math.round(edge.weight * 100) + '%';
  }
  return null;
}
