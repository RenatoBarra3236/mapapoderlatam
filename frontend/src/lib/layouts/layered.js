// Layered (left-to-right) layout — neural-network style.
// Ported verbatim from reference/graph.jsx (do not modify the algorithm).

export function computeDepths(caseData) {
  const adj = new Map();
  caseData.nodes.forEach(n => adj.set(n.id, []));
  caseData.edges.forEach(e => {
    if (adj.has(e.s)) adj.get(e.s).push(e.t);
    if (adj.has(e.t)) adj.get(e.t).push(e.s);
  });
  const depths = new Map([[caseData.rootId, 0]]);
  const q = [caseData.rootId];
  while (q.length) {
    const c = q.shift();
    const d = depths.get(c);
    for (const nb of adj.get(c) || []) {
      if (!depths.has(nb)) { depths.set(nb, d + 1); q.push(nb); }
    }
  }
  return depths;
}

export function layeredLayout(caseData, colStep = 230, rowStep = 78) {
  const depthMap = computeDepths(caseData);
  const layers = new Map();
  caseData.nodes.forEach(n => {
    const d = depthMap.get(n.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d).push(n);
  });
  const layerCount = Math.max(...layers.keys()) + 1;

  const adj = new Map();
  caseData.nodes.forEach(n => adj.set(n.id, []));
  caseData.edges.forEach(e => {
    if (adj.has(e.s)) adj.get(e.s).push(e.t);
    if (adj.has(e.t)) adj.get(e.t).push(e.s);
  });

  const ordered = new Map();
  ordered.set(0, layers.get(0));

  const yByNode = new Map();
  layers.get(0).forEach((n, i) => yByNode.set(n.id, i));

  for (let d = 1; d < layerCount; d++) {
    const prev = ordered.get(d - 1);
    const prevIdx = new Map(prev.map((n, i) => [n.id, i]));
    const cur = layers.get(d) || [];
    const baryc = (n) => {
      const conn = (adj.get(n.id) || []).filter(id => prevIdx.has(id));
      if (!conn.length) return prev.length / 2;
      return conn.reduce((s, id) => s + prevIdx.get(id), 0) / conn.length;
    };
    const sorted = [...cur].sort((a, b) => baryc(a) - baryc(b));
    ordered.set(d, sorted);
    sorted.forEach((n, i) => yByNode.set(n.id, i));
  }

  const positions = new Map();
  const xOffset = -((layerCount - 1) * colStep) / 2;
  for (let d = 0; d < layerCount; d++) {
    const arr = ordered.get(d) || [];
    const totalH = (arr.length - 1) * rowStep;
    arr.forEach((n, i) => {
      positions.set(n.id, {
        x: xOffset + d * colStep,
        y: i * rowStep - totalH / 2,
        depth: d,
        layerIndex: i
      });
    });
  }

  return { positions, layerCount, ordered, depthMap };
}
