// Visualizations: ConstellationView (luminous neural-net style) + OrbitView (concentric rings by depth from root)

const { useState: useS, useEffect: useE, useRef: useR, useMemo: useM } = React;

// ─── Shared stage hook (pan + zoom + size) ──────────────────────────────────
function useStage(initialZoom = 0.92) {
  const stageRef = useR(null);
  const [dims, setDims] = useS({ w: 800, h: 600 });
  const [zoom, setZoom] = useS(initialZoom);
  const [pan, setPan] = useS({ x: 0, y: 0 });
  const [isDragging, setDragging] = useS(false);
  const dragStart = useR({ x: 0, y: 0, panX: 0, panY: 0 });

  useE(() => {
    const u = () => {
      if (stageRef.current) {
        const r = stageRef.current.getBoundingClientRect();
        setDims({ w: r.width, h: r.height });
      }
    };
    u();
    const ro = new ResizeObserver(u);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  const handlers = {
    onWheel: (e) => {
      e.preventDefault();
      const d = -e.deltaY * 0.0015;
      setZoom(z => Math.max(0.35, Math.min(2.8, z + d * z)));
    },
    onMouseDown: (e) => {
      if (e.target.closest(".node-hit")) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    onMouseMove: (e) => {
      if (!isDragging) return;
      setPan({
        x: dragStart.current.panX + (e.clientX - dragStart.current.x),
        y: dragStart.current.panY + (e.clientY - dragStart.current.y)
      });
    },
    onMouseUp: () => setDragging(false),
    onMouseLeave: () => setDragging(false)
  };

  const reset = () => { setZoom(initialZoom); setPan({ x: 0, y: 0 }); };

  return { stageRef, dims, zoom, setZoom, pan, isDragging, handlers, reset };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function computeDepths(caseData) {
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

// Radial tree layout — tree edges never cross. Non-tree (chord) edges are
// returned separately so we can draw them as arcs through the centre.
// Sectors are pre-computed (each direct child of root = a sector) and
// ordered so pairs with the most chord-edges between them sit adjacent,
// minimising chord-arc length.
function radialTreeLayout(caseData, ringRadius = 150) {
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
  const chordPair = new Map(); // "a:b" -> count
  caseData.edges.forEach(e => {
    const sa = sectorOf.get(e.s), sb = sectorOf.get(e.t);
    if (sa == null || sb == null || sa === sb) return;
    const k = sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
    chordPair.set(k, (chordPair.get(k) || 0) + 1 + (e.flag ? 2 : 0));
  });

  // Greedy sector ordering: start with the largest sector, then keep
  // appending whichever remaining sector has the strongest chord-tie to the
  // current end of the chain. Falls back to subtree-size as tie-breaker.
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
    // start with sector of largest subtree
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

  // Reorder root's children to match
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

  // Place: each sector gets an angular slice of the full circle, proportional
  // to its subtree leaf-count. Within a sector, the same rule applies recursively.
  const positions = new Map();
  positions.set(caseData.rootId, { x: 0, y: 0, angle: 0, depth: 0, sector: null });
  const sectorBounds = new Map(); // sid -> { startAngle, endAngle, color }

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

// ─── Layered (left-to-right) layout — neural-network style ─────────────────
// Each node placed in a column = BFS depth from root.
// Within each column, nodes are ordered using the barycenter heuristic to
// minimise crossings with the previous column.
function layeredLayout(caseData, colStep = 230, rowStep = 78) {
  const depthMap = computeDepths(caseData);
  const layers = new Map();
  caseData.nodes.forEach(n => {
    const d = depthMap.get(n.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d).push(n);
  });
  const layerCount = Math.max(...layers.keys()) + 1;

  // Build adjacency lookup
  const adj = new Map();
  caseData.nodes.forEach(n => adj.set(n.id, []));
  caseData.edges.forEach(e => {
    if (adj.has(e.s)) adj.get(e.s).push(e.t);
    if (adj.has(e.t)) adj.get(e.t).push(e.s);
  });

  // Order each layer: first by type, then by barycenter of neighbors in
  // the previous layer (median y position of all connected previous-layer nodes).
  const ordered = new Map();
  ordered.set(0, layers.get(0)); // root layer

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

  // Place
  const positions = new Map();
  // Centre columns horizontally around 0
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

function typeColor(node) {
  if (node.isEntity) return "var(--ink-3)";
  if (node.type === "person") return "var(--c-person)";
  if (node.type === "company") return "var(--c-company)";
  return "var(--c-contract)";
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

// Short label shown on edges by default — prefers any "%" in the label,
// else converts a fractional weight to a percentage.
function shortEdgeLabel(edge) {
  const m = String(edge.label || "").match(/(\d+(\.\d+)?\s*%)/);
  if (m) return m[1].replace(/\s+/g, "");
  if (typeof edge.weight === "number" && edge.weight > 0 && edge.weight < 1) {
    return Math.round(edge.weight * 100) + "%";
  }
  return null;
}

function ZoomControls({ zoom, setZoom, onReset, min = 0.35, max = 2.8 }) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="graph-controls">
      <button title="Zoom in" onClick={() => setZoom(z => Math.min(max, z * 1.18))}>＋</button>
      <input
        type="range"
        min={min}
        max={max}
        step={0.02}
        value={zoom}
        onChange={(e) => setZoom(parseFloat(e.target.value))}
        className="zoom-slider"
        title={`${pct}%`}
      />
      <button title="Zoom out" onClick={() => setZoom(z => Math.max(min, z / 1.18))}>−</button>
      <div className="zoom-pct" title="Reset" onClick={onReset}>{pct}%</div>
    </div>
  );
}

function Legend({ lang, mode, showChord }) {
  const labels = lang === "es"
    ? { person: "Persona", company: "Empresa", contract: "Contrato", flag: "Vínculo marcado", chord: "Vínculo cruzado" }
    : { person: "Person", company: "Company", contract: "Contract", flag: "Flagged tie", chord: "Cross link" };
  return (
    <div className="graph-legend">
      <span><span className="type-dot person" />{labels.person}</span>
      <span><span className="type-dot company" />{labels.company}</span>
      <span><span className="type-dot contract" />{labels.contract}</span>
      {showChord && (
        <span style={{ borderLeft: "1px solid var(--line)", paddingLeft: 10 }}>
          <span style={{ display: "inline-block", width: 14, height: 1, background: "var(--ink-3)", borderTop: "1px dotted var(--ink-3)", marginRight: 4 }} />
          {labels.chord}
        </span>
      )}
      <span style={{ color: "var(--c-alert)", paddingLeft: showChord ? 0 : 10, borderLeft: showChord ? "none" : "1px solid var(--line)" }}>
        <span style={{ display: "inline-block", width: 14, height: 1, background: "var(--c-alert)", borderTop: "1px dashed", marginRight: 4 }} />
        {labels.flag}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ORBIT VIEW — radial tree by BFS depth, no crossings on tree edges
// Non-tree edges drawn as chord arcs across the centre (visualises the
// "interesting" cross-connections, often where conflicts of interest live).
// ═══════════════════════════════════════════════════════════════════════════
function OrbitView({ caseData, lang, onNodeClick }) {
  const { stageRef, dims, zoom, setZoom, pan, isDragging, handlers, reset } = useStage();
  const [hoveredId, setHoveredId] = useS(null);

  useE(() => { reset(); setHoveredId(null); }, [caseData.id]);

  // Compute a layout that fits the available viewport with comfortable padding
  const { ringRadius, layout } = useM(() => {
    const probe = radialTreeLayout(caseData, 150);
    const maxD = Math.max(1, probe.maxDepth);
    const padding = 90;
    const available = Math.max(140, Math.min(dims.w, dims.h) / 2 - padding);
    const rr = Math.max(90, Math.min(170, available / maxD));
    return { ringRadius: rr, layout: radialTreeLayout(caseData, rr) };
  }, [caseData.id, dims.w, dims.h]);

  const cx = dims.w / 2 + pan.x;
  const cy = dims.h / 2 + pan.y;

  const ringLabels = lang === "es"
    ? ["", "1° grado", "2° grado", "3° grado", "4° grado"]
    : ["", "1st degree", "2nd degree", "3rd degree", "4th degree"];

  // Tree edge path — gentle outward arc from parent to child
  function treeEdgePath(sp, tp) {
    // Use a curve that follows the radial direction
    const sr = Math.sqrt(sp.x * sp.x + sp.y * sp.y);
    const tr = Math.sqrt(tp.x * tp.x + tp.y * tp.y);
    const midR = (sr + tr) / 2;
    // midpoint between angles
    const sa = Math.atan2(sp.y, sp.x);
    const ta = Math.atan2(tp.y, tp.x);
    let ma = (sa + ta) / 2;
    // handle wrap
    if (Math.abs(sa - ta) > Math.PI) ma += Math.PI;
    const mx = Math.cos(ma) * midR;
    const my = Math.sin(ma) * midR;
    return `M ${sp.x} ${sp.y} Q ${mx} ${my} ${tp.x} ${tp.y}`;
  }
  // Chord (non-tree) edge — arc through near-centre
  function chordEdgePath(sp, tp) {
    const mx = (sp.x + tp.x) * 0.18;
    const my = (sp.y + tp.y) * 0.18;
    return `M ${sp.x} ${sp.y} Q ${mx} ${my} ${tp.x} ${tp.y}`;
  }

  return (
    <div
      ref={stageRef}
      className="canvas-stage orbit-stage"
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      {...handlers}
    >
      <svg className="graph-svg" viewBox={`0 0 ${dims.w} ${dims.h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="orb-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-3)" opacity="0.5" />
          </marker>
          <marker id="orb-arr-flag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--c-alert)" />
          </marker>
        </defs>

        <g transform={`translate(${cx}, ${cy}) scale(${zoom})`}>
          {/* Sector wedges — subtle background tints, labels sit inside the sector */}
          {(() => {
            const sectorPalette = ["var(--c-person)", "var(--c-company)", "var(--c-contract)", "var(--c-warn)", "var(--c-alert)", "var(--ink-3)"];
            const outerR = (layout.maxDepth + 0.25) * ringRadius;
            // Place sector label at a radius between ring 1 and the outer ring, along the sector mid-angle
            const sectorLabelR = Math.min(outerR - 18, ringRadius * 1.5);
            return layout.sectorIds.map((sid, i) => {
              const b = layout.sectorBounds.get(sid);
              if (!b) return null;
              const startA = b.startAngle, endA = b.endAngle;
              const x1 = Math.cos(startA) * outerR, y1 = Math.sin(startA) * outerR;
              const x2 = Math.cos(endA) * outerR, y2 = Math.sin(endA) * outerR;
              const large = (endA - startA) > Math.PI ? 1 : 0;
              const wedgePath = `M 0 0 L ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} Z`;
              const labelMid = b.midAngle;
              // For sectors wider than ~80°, push label closer to outer edge (less crowded)
              const isWide = (endA - startA) > Math.PI * 0.6;
              const lr = isWide ? sectorLabelR : outerR - 6;
              const lx = Math.cos(labelMid) * lr;
              const ly = Math.sin(labelMid) * lr;
              const sectorNode = caseData.nodes.find(n => n.id === sid);
              const shortName = sectorNode
                ? truncate(sectorNode.name.split(/[ ,]/).filter(Boolean).slice(0, 2).join(" "), 16)
                : "";
              return (
                <g key={sid}>
                  <path d={wedgePath} fill={sectorPalette[i % sectorPalette.length]} opacity="0.04" />
                  <line
                    x1={0} y1={0}
                    x2={Math.cos(endA) * outerR}
                    y2={Math.sin(endA) * outerR}
                    stroke="var(--line)" strokeWidth="1" strokeDasharray="2 5" opacity="0.4"
                  />
                  {sectorNode && (
                    <g>
                      <rect
                        x={lx - shortName.length * 3.5 - 8}
                        y={ly - 8}
                        width={shortName.length * 7 + 24}
                        height={16}
                        rx={8}
                        fill="var(--bg)"
                        opacity="0.75"
                      />
                      <text
                        x={lx} y={ly + 3}
                        textAnchor="middle"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}
                        fill={sectorPalette[i % sectorPalette.length]}
                        opacity="0.95"
                      >
                        ◆ {shortName}
                      </text>
                    </g>
                  )}
                </g>
              );
            });
          })()}

          {/* Rings */}
          {Array.from({ length: layout.maxDepth }, (_, i) => i + 1).map(d => (
            <g key={d}>
              <circle cx="0" cy="0" r={d * ringRadius} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" opacity="0.55" />
              <text
                x={0} y={-d * ringRadius - 8}
                textAnchor="middle"
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}
                fill="var(--ink-3)"
              >
                {ringLabels[d] || `${d}°`}
              </text>
            </g>
          ))}

          {/* Edges — tree edges first (outer), then chord arcs */}
          {caseData.edges.map((e, i) => {
            const sp = layout.positions.get(e.s);
            const tp = layout.positions.get(e.t);
            if (!sp || !tp) return null;
            const isInvolved = hoveredId !== null && (e.s === hoveredId || e.t === hoveredId);
            const isDim = hoveredId !== null && !isInvolved;
            const isTree = layout.isTreeEdge[i];
            const path = isTree ? treeEdgePath(sp, tp) : chordEdgePath(sp, tp);
            return (
              <g key={i}>
                <path
                  className={`graph-edge ${e.flag ? "flag" : ""} ${isInvolved ? "highlight" : ""} ${isDim ? "dim" : ""} ${!isTree ? "chord" : ""}`}
                  d={path}
                  strokeWidth={isInvolved ? 2 : (isTree ? 1.2 : 1)}
                  markerEnd={e.flag ? "url(#orb-arr-flag)" : "url(#orb-arr)"}
                />
                {!isInvolved && (() => {
                  const w = shortEdgeLabel(e);
                  if (!w) return null;
                  const lx = isTree ? (sp.x + tp.x) / 2 : (sp.x + tp.x) * 0.42;
                  const ly = isTree ? (sp.y + tp.y) / 2 : (sp.y + tp.y) * 0.42;
                  return (
                    <g style={{ pointerEvents: "none" }}>
                      <rect x={lx - w.length * 3.5 - 3} y={ly - 7} width={w.length * 7 + 6} height={13} rx={3} fill="var(--bg)" opacity={isDim ? 0.4 : 0.95} />
                      <text x={lx} y={ly + 3} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, fill: e.flag ? "var(--c-alert)" : "var(--ink-2)", opacity: isDim ? 0.35 : 0.85 }}>
                        {w}
                      </text>
                    </g>
                  );
                })()}
                {isInvolved && (
                  <g className="fade-in">
                    {(() => {
                      const lx = isTree ? (sp.x + tp.x) / 2 : (sp.x + tp.x) * 0.32;
                      const ly = isTree ? (sp.y + tp.y) / 2 : (sp.y + tp.y) * 0.32;
                      return <>
                        <rect className="graph-edge-label-bg" x={lx - e.label.length * 2.7} y={ly - 7} width={e.label.length * 5.4} height={14} rx={3} />
                        <text className="graph-edge-label" x={lx} y={ly + 3} textAnchor="middle">{e.label}</text>
                      </>;
                    })()}
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {caseData.nodes.map(n => {
            const p = layout.positions.get(n.id);
            if (!p) return null;
            const isRoot = n.id === caseData.rootId;
            const isHovered = hoveredId === n.id;
            const isConnected = hoveredId !== null && caseData.edges.some(e =>
              (e.s === hoveredId && e.t === n.id) || (e.t === hoveredId && e.s === n.id)
            );
            const isDim = hoveredId !== null && !isHovered && !isConnected;
            const radius = isRoot ? 22 : (n.risk >= 65 ? 13 : 10);
            const color = typeColor(n);
            const fillSoft = n.type === "person" ? "var(--c-person-soft)" : n.type === "company" ? "var(--c-company-soft)" : "var(--c-contract-soft)";

            const name = truncate(n.name, 26);
            const sub = n.subtitle ? truncate(n.subtitle, 28) : null;

            // Label outside the ring along the radial direction.
            // Root gets its label ABOVE the circle (the densest area is usually below
            // because BFS distributes children around the full circle) with a bg pill.
            const labelOffset = radius + 8;
            const angle = isRoot ? -Math.PI / 2 : Math.atan2(p.y, p.x);
            const lx = Math.cos(angle) * labelOffset;
            const ly = Math.sin(angle) * labelOffset;
            const cx_ = Math.cos(angle);
            const anchor = isRoot ? "middle" : (cx_ > 0.25 ? "start" : cx_ < -0.25 ? "end" : "middle");
            const dy = isRoot ? -8 : (Math.sin(angle) > 0.2 ? 10 : Math.sin(angle) < -0.2 ? -4 : 4);

            return (
              <g key={n.id} className={`graph-node-group node-hit ${isDim ? "dim" : ""}`}
                 transform={`translate(${p.x}, ${p.y})`}
                 onMouseEnter={() => setHoveredId(n.id)}
                 onMouseLeave={() => setHoveredId(null)}
                 onClick={() => onNodeClick && onNodeClick(n)}>
                {isRoot && (
                  <circle r={radius + 14} fill={color} opacity="0.08">
                    <animate attributeName="r" values={`${radius + 8};${radius + 18};${radius + 8}`} dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.16;0.04;0.16" dur="3s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={radius} fill={fillSoft} stroke={color} strokeWidth={isRoot ? 2 : 1.5} />
                {!n.isEntity && n.risk >= 50 && (
                  <circle r={4} cx={radius * 0.7} cy={-radius * 0.7} fill="var(--c-alert)" />
                )}
                <g transform={`translate(${lx}, ${ly})`} style={{ pointerEvents: "none" }}>
                  <text textAnchor={anchor} y={dy} className="graph-node-label" style={{ fontWeight: isRoot ? 600 : 500 }}>
                    {name}
                  </text>
                  {sub && (
                    <text textAnchor={anchor} y={dy + 13} className="graph-node-sublabel">{sub}</text>
                  )}
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      <ZoomControls zoom={zoom} setZoom={setZoom} onReset={reset} />
      <Legend lang={lang} mode="orbit" showChord />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEURAL VIEW — layered DAG, columns by depth, barycenter ordering
// ═══════════════════════════════════════════════════════════════════════════
function NeuralView({ caseData, lang, onNodeClick }) {
  const { stageRef, dims, zoom, setZoom, pan, isDragging, handlers, reset } = useStage();
  const [hoveredId, setHoveredId] = useS(null);

  // Fit columns to the available canvas width with comfortable padding for labels
  const layout = useM(() => {
    const probe = layeredLayout(caseData, 240, 78);
    const padding = 130; // left+right room for the leftmost label and rightmost label
    const available = Math.max(360, dims.w - padding * 2);
    const colStep = Math.max(160, Math.min(280, available / Math.max(1, probe.layerCount - 1)));
    const maxNodesInColumn = Math.max(...Array.from(probe.ordered.values()).map(a => a.length));
    const availableH = Math.max(280, dims.h - 140);
    const rowStep = Math.max(56, Math.min(90, availableH / Math.max(1, maxNodesInColumn)));
    return layeredLayout(caseData, colStep, rowStep);
  }, [caseData.id, dims.w, dims.h]);

  useE(() => { reset(); setHoveredId(null); }, [caseData.id]);

  // Background neural-net micro-particles (stable per case)
  const particles = useM(() => {
    const seed = caseData.id.charCodeAt(0);
    let s = seed;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: 80 }, () => ({
      x: rng() * 1600 - 800, y: rng() * 1100 - 550,
      r: rng() * 1 + 0.3, op: rng() * 0.4 + 0.08
    }));
  }, [caseData.id]);

  const cx = dims.w / 2 + pan.x;
  const cy = dims.h / 2 + pan.y;

  // Smooth horizontal Bezier between two layer points
  function neuralPath(sp, tp) {
    const dx = tp.x - sp.x;
    const c1x = sp.x + dx * 0.5;
    const c1y = sp.y;
    const c2x = tp.x - dx * 0.5;
    const c2y = tp.y;
    return `M ${sp.x} ${sp.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tp.x} ${tp.y}`;
  }

  // Derive actual column step from the layout's placed positions
  const positionsArr = [...layout.positions.values()];
  const xs = [...new Set(positionsArr.map(p => Math.round(p.x)))].sort((a, b) => a - b);
  const colStep = xs.length > 1 ? (xs[1] - xs[0]) : 240;
  const xOffset = xs.length ? xs[0] : 0;
  const labelLang = lang === "es"
    ? ["Raíz", "1° grado", "2° grado", "3° grado", "4° grado"]
    : ["Root", "1st", "2nd", "3rd", "4th"];

  return (
    <div
      ref={stageRef}
      className="canvas-stage neural-stage"
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      {...handlers}
    >
      <svg className="graph-svg" viewBox={`0 0 ${dims.w} ${dims.h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="neural-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="neural-root-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.65" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <filter id="neural-blur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
          <linearGradient id="neural-bg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--c-person)" stopOpacity="0.04" />
            <stop offset="50%" stopColor="var(--c-company)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--c-contract)" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        <g transform={`translate(${cx}, ${cy}) scale(${zoom})`}>
          {/* Background dust */}
          {particles.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="var(--ink-3)" opacity={p.op} />
          ))}

          {/* Column guides + labels */}
          {(() => {
            const xs = [...new Set([...layout.positions.values()].map(p => Math.round(p.x)))].sort((a, b) => a - b);
            const maxAbsY = Math.max(40, ...[...layout.positions.values()].map(p => Math.abs(p.y))) + 32;
            const halfH = maxAbsY + 36;
            return xs.map((x, d) => (
              <g key={d}>
                <line x1={x} y1={-halfH} x2={x} y2={halfH} stroke="var(--line)" strokeWidth="1" strokeDasharray="1 5" opacity="0.5" />
                <text
                  x={x} y={-maxAbsY}
                  textAnchor="middle"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}
                  fill="var(--ink-3)"
                >
                  {labelLang[d] || `${d}°`}
                </text>
              </g>
            ));
          })()}

          {/* Connections */}
          {caseData.edges.map((e, i) => {
            const sp = layout.positions.get(e.s);
            const tp = layout.positions.get(e.t);
            if (!sp || !tp) return null;
            const isInvolved = hoveredId !== null && (e.s === hoveredId || e.t === hoveredId);
            const isDim = hoveredId !== null && !isInvolved;
            // Backward/intra-layer edges drawn as gentle arcs above/below
            const sameLayer = sp.depth === tp.depth;
            let path;
            if (sameLayer) {
              const mx = (sp.x + tp.x) / 2 + (Math.abs(sp.y - tp.y) > 0 ? -40 : 0);
              const my = (sp.y + tp.y) / 2;
              path = `M ${sp.x} ${sp.y} Q ${mx} ${my} ${tp.x} ${tp.y}`;
            } else {
              path = neuralPath(sp, tp);
            }
            const opacity = isInvolved ? 0.95 : (isDim ? 0.07 : (e.flag ? 0.6 : 0.32));
            const stroke = e.flag ? "var(--c-alert)" : "currentColor";
            return (
              <g key={i} style={{ color: "var(--ink-2)" }}>
                <path d={path} fill="none" stroke={stroke} strokeWidth={isInvolved ? 6 : 4} opacity={isInvolved ? 0.18 : 0.04} filter="url(#neural-blur)" />
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isInvolved ? 1.8 : 1.1}
                  opacity={opacity}
                  strokeDasharray={e.flag ? "5 3" : "none"}
                  style={{ animation: e.flag ? "dashMove 30s linear infinite" : "none" }}
                />
                {!isInvolved && (() => {
                  const w = shortEdgeLabel(e);
                  if (!w) return null;
                  const lx = (sp.x + tp.x) / 2;
                  const ly = sameLayer ? (sp.y + tp.y) / 2 - 18 : (sp.y + tp.y) / 2 - 4;
                  return (
                    <g style={{ pointerEvents: "none" }}>
                      <rect x={lx - w.length * 3.5 - 3} y={ly - 7} width={w.length * 7 + 6} height={13} rx={3} fill="var(--bg)" opacity={isDim ? 0.4 : 0.92} />
                      <text x={lx} y={ly + 3} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, fill: e.flag ? "var(--c-alert)" : "var(--ink-2)", opacity: isDim ? 0.35 : 0.85 }}>
                        {w}
                      </text>
                    </g>
                  );
                })()}
                {isInvolved && (
                  <g className="fade-in">
                    {(() => {
                      const lx = (sp.x + tp.x) / 2;
                      const ly = sameLayer ? (sp.y + tp.y) / 2 - 20 : (sp.y + tp.y) / 2;
                      const w = e.label.length * 5.4;
                      return <>
                        <rect x={lx - w/2 - 4} y={ly - 8} width={w + 8} height={15} rx={3} fill="var(--bg)" stroke="var(--line)" />
                        <text x={lx} y={ly + 3} textAnchor="middle" className="graph-edge-label">{e.label}</text>
                      </>;
                    })()}
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes — luminous points with label on right side */}
          {caseData.nodes.map(n => {
            const p = layout.positions.get(n.id);
            if (!p) return null;
            const isRoot = n.id === caseData.rootId;
            const isHovered = hoveredId === n.id;
            const isConnected = hoveredId !== null && caseData.edges.some(e =>
              (e.s === hoveredId && e.t === n.id) || (e.t === hoveredId && e.s === n.id)
            );
            const isDim = hoveredId !== null && !isHovered && !isConnected;
            const baseR = isRoot ? 9 : (n.risk >= 65 ? 6.5 : n.risk >= 40 ? 5.5 : 4.5);
            const glowR = isRoot ? 80 : (n.risk >= 50 ? 36 : 26);
            const color = typeColor(n);

            const name = truncate(n.name, 22);
            const sub = n.subtitle ? truncate(n.subtitle, 26) : null;

            // Label centred below the node
            const labelOff = baseR + 14;

            return (
              <g
                key={n.id}
                className={`node-hit ${isDim ? "constellation-dim" : ""}`}
                transform={`translate(${p.x}, ${p.y})`}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onNodeClick && onNodeClick(n)}
                style={{ cursor: "pointer" }}
              >
                <g style={{ color }}>
                  <circle r={glowR} fill={`url(#${isRoot ? "neural-root-glow" : "neural-glow"})`} opacity={isHovered ? 1 : 0.85} />
                </g>
                {isRoot && (
                  <circle r={baseR + 6} fill="none" stroke={color} strokeWidth="1" opacity="0.5">
                    <animate attributeName="r" values={`${baseR + 4};${baseR + 16};${baseR + 4}`} dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={baseR + 2} fill="var(--bg)" />
                <circle r={baseR} fill={color} />
                {!n.isEntity && n.risk >= 65 && (
                  <circle r={baseR + 3.5} fill="none" stroke="var(--c-alert)" strokeWidth="1.2" />
                )}

                <g style={{ pointerEvents: "none" }}>
                  <text textAnchor="middle" y={labelOff} className="constellation-label" style={{ fontWeight: isRoot ? 600 : 500 }}>
                    {name}
                  </text>
                  {sub && (
                    <text textAnchor="middle" y={labelOff + 13} className="constellation-sublabel">{sub}</text>
                  )}
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      <ZoomControls zoom={zoom} setZoom={setZoom} onReset={reset} />
      <Legend lang={lang} mode="neural" />
    </div>
  );
}

window.OrbitView = OrbitView;
window.NeuralView = NeuralView;
window.ConstellationView = NeuralView; // back-compat alias
