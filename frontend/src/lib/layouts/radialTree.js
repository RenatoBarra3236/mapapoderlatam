// Radial tree layout — tree edges never cross. Non-tree (chord) edges are
// returned separately so we can draw them as arcs through the centre.
// Ported verbatim from reference/graph.jsx (do not modify the algorithm).

export function radialTreeLayout(caseData, ringRadius = 150) {
  const adj = new Map();
  caseData.nodes.forEach(n => adj.set(n.id, []));
  caseData.edges.forEach(e => {
    if (adj.has(e.s)) adj.get(e.s).push({ to: e.t, edge: e });
    if (adj.has(e.t)) adj.get(e.t).push({ to: e.s, edge: e });
  });

  // BFS spanning tree
  const parent = new Map([[caseData.rootId, null]]);
  const depth = new Map([[caseData.rootId, 0]]);
  const children = new Map();
  caseData.nodes.forEach(n => children.set(n.id, []));
  const q = [caseData.rootId];
  while (q.length) {
    const cur = q.shift();
    const nbs = [...(adj.get(cur) || [])].sort((a, b) => (a.edge.flag ? 1 : 0) - (b.edge.flag ? 1 : 0));
    for (const { to } of nbs) {
      if (!parent.has(to)) {
        parent.set(to, cur);
        depth.set(to, depth.get(cur) + 1);
        children.get(cur).push(to);
        q.push(to);
      }
    }
  }
  caseData.nodes.forEach(n => {
    if (!parent.has(n.id)) {
      parent.set(n.id, caseData.rootId);
      depth.set(n.id, 1);
      children.get(caseData.rootId).push(n.id);
    }
  });

  // Sectors = direct children of root, each owns its full subtree
  const sectorIds = children.get(caseData.rootId) || [];
  const sectorOf = new Map();
  function tagSector(id, sid) {
    sectorOf.set(id, sid);
    for (const c of children.get(id) || []) tagSector(c, sid);
  }
  sectorIds.forEach(sid => tagSector(sid, sid));
  sectorOf.set(caseData.rootId, null);

  // Count chord edges between each pair of sectors
  const chordPair = new Map();
  caseData.edges.forEach(e => {
    const sa = sectorOf.get(e.s), sb = sectorOf.get(e.t);
    if (sa == null || sb == null || sa === sb) return;
    const k = sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
    chordPair.set(k, (chordPair.get(k) || 0) + 1 + (e.flag ? 2 : 0));
  });

  // Greedy sector ordering
  const leafCount = new Map();
  function countLeaves(id) {
    const ch = children.get(id) || [];
    if (!ch.length) { leafCount.set(id, 1); return 1; }
    let total = 0;
    for (const c of ch) total += countLeaves(c);
    leafCount.set(id, total);
    return total;
  }
  countLeaves(caseData.rootId);

  const orderedSectors = [];
  const remaining = new Set(sectorIds);
  if (sectorIds.length) {
    let first = sectorIds[0];
    sectorIds.forEach(s => { if ((leafCount.get(s) || 0) > (leafCount.get(first) || 0)) first = s; });
    orderedSectors.push(first);
    remaining.delete(first);
    while (remaining.size) {
      const tail = orderedSectors[orderedSectors.length - 1];
      let best = null, bestScore = -1;
      remaining.forEach(s => {
        const k = tail < s ? `${tail}:${s}` : `${s}:${tail}`;
        const tie = chordPair.get(k) || 0;
        const score = tie * 10 + (leafCount.get(s) || 0);
        if (score > bestScore) { bestScore = score; best = s; }
      });
      orderedSectors.push(best);
      remaining.delete(best);
    }
  }

  children.set(caseData.rootId, orderedSectors);

  // For each non-root node, sort children by type so siblings cluster nicely
  const typeOrder = { person: 0, company: 1, contract: 2 };
  const nodeById = new Map(caseData.nodes.map(n => [n.id, n]));
  children.forEach((arr, id) => {
    if (id === caseData.rootId) return;
    arr.sort((a, b) => {
      const na = nodeById.get(a), nb = nodeById.get(b);
      return (typeOrder[na.type] ?? 9) - (typeOrder[nb.type] ?? 9) || a - b;
    });
  });

  // Place
  const positions = new Map();
  positions.set(caseData.rootId, { x: 0, y: 0, angle: 0, depth: 0, sector: null });
  const sectorBounds = new Map();

  function place(id, startAngle, endAngle) {
    const ch = children.get(id) || [];
    if (!ch.length) return;
    const totalLeaves = leafCount.get(id);
    let cursor = startAngle;
    for (const c of ch) {
      const slice = ((leafCount.get(c) || 1) / totalLeaves) * (endAngle - startAngle);
      const mid = cursor + slice / 2;
      const d = depth.get(c);
      const r = d * ringRadius;
      positions.set(c, { x: Math.cos(mid) * r, y: Math.sin(mid) * r, angle: mid, depth: d, sector: sectorOf.get(c) });
      if (id === caseData.rootId) {
        sectorBounds.set(c, { startAngle: cursor, endAngle: cursor + slice, midAngle: mid });
      }
      const inset = slice * 0.04;
      place(c, cursor + inset, cursor + slice - inset);
      cursor += slice;
    }
  }
  place(caseData.rootId, -Math.PI / 2 - Math.PI, -Math.PI / 2 + Math.PI);

  const isTreeEdge = caseData.edges.map(e =>
    parent.get(e.t) === e.s || parent.get(e.s) === e.t
  );

  const maxDepth = Math.max(...depth.values());
  return { positions, depth, isTreeEdge, maxDepth, parent, children, sectorIds: orderedSectors, sectorOf, sectorBounds };
}
