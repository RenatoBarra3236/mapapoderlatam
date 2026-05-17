import React, { useEffect, useMemo, useState } from 'react';
import { radialTreeLayout } from '../../lib/layouts/radialTree';
import { useStage } from '../../lib/graph/useStage';
import { typeColor, truncate, shortEdgeLabel } from '../../lib/graph/utils';
import ZoomSlider from './ZoomSlider';
import Legend from './Legend';

const SECTOR_PALETTE = [
  'var(--c-person)', 'var(--c-company)', 'var(--c-contract)',
  'var(--c-warn)', 'var(--c-alert)', 'var(--ink-3)'
];

export default function OrbitView({ caseData, lang, onNodeClick }) {
  const { stageRef, dims, zoom, setZoom, pan, isDragging, handlers, reset } = useStage();
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => { reset(); setHoveredId(null); }, [caseData.id]);

  const { ringRadius, layout } = useMemo(() => {
    const probe = radialTreeLayout(caseData, 150);
    const maxD = Math.max(1, probe.maxDepth);
    const padding = 50;
    const available = Math.max(180, Math.min(dims.w, dims.h) / 2 - padding);
    // Aim for generous spacing between rings — leaves room for node labels
    // and the sector pill to coexist without crowding.
    const rr = Math.max(155, Math.min(230, available / maxD));
    return { ringRadius: rr, layout: radialTreeLayout(caseData, rr) };
  }, [caseData.id, dims.w, dims.h]);

  const cx = dims.w / 2 + pan.x;
  const cy = dims.h / 2 + pan.y;

  const ringLabels = lang === 'es'
    ? ['', '1° grado', '2° grado', '3° grado', '4° grado']
    : ['', '1st degree', '2nd degree', '3rd degree', '4th degree'];

  function treeEdgePath(sp, tp) {
    const sr = Math.sqrt(sp.x * sp.x + sp.y * sp.y);
    const tr = Math.sqrt(tp.x * tp.x + tp.y * tp.y);
    const midR = (sr + tr) / 2;
    const sa = Math.atan2(sp.y, sp.x);
    const ta = Math.atan2(tp.y, tp.x);
    let ma = (sa + ta) / 2;
    if (Math.abs(sa - ta) > Math.PI) ma += Math.PI;
    const mx = Math.cos(ma) * midR;
    const my = Math.sin(ma) * midR;
    return `M ${sp.x} ${sp.y} Q ${mx} ${my} ${tp.x} ${tp.y}`;
  }
  function chordEdgePath(sp, tp) {
    const mx = (sp.x + tp.x) * 0.18;
    const my = (sp.y + tp.y) * 0.18;
    return `M ${sp.x} ${sp.y} Q ${mx} ${my} ${tp.x} ${tp.y}`;
  }

  return (
    <div
      ref={stageRef}
      className="canvas-stage orbit-stage"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
          {/* Sector wedges */}
          {(() => {
            const outerR = (layout.maxDepth + 0.25) * ringRadius;
            // Sector pill sits in the empty band between the root halo and the
            // first ring — clear of node labels regardless of how the children
            // are placed along the wedge.
            const sectorLabelR = ringRadius * 0.62;
            return layout.sectorIds.map((sid, i) => {
              const b = layout.sectorBounds.get(sid);
              if (!b) return null;
              const startA = b.startAngle, endA = b.endAngle;
              const x1 = Math.cos(startA) * outerR, y1 = Math.sin(startA) * outerR;
              const x2 = Math.cos(endA) * outerR, y2 = Math.sin(endA) * outerR;
              const large = (endA - startA) > Math.PI ? 1 : 0;
              const wedgePath = `M 0 0 L ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} Z`;
              const labelMid = b.midAngle;
              const lx = Math.cos(labelMid) * sectorLabelR;
              const ly = Math.sin(labelMid) * sectorLabelR;
              const sectorNode = caseData.nodes.find(n => n.id === sid);
              const shortName = sectorNode
                ? truncate(sectorNode.name.split(/[ ,]/).filter(Boolean).slice(0, 2).join(' '), 16)
                : '';
              return (
                <g key={sid}>
                  <path d={wedgePath} fill={SECTOR_PALETTE[i % SECTOR_PALETTE.length]} opacity="0.04" />
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
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}
                        fill={SECTOR_PALETTE[i % SECTOR_PALETTE.length]}
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
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                fill="var(--ink-3)"
              >
                {ringLabels[d] || `${d}°`}
              </text>
            </g>
          ))}

          {/* Edges */}
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
                  className={`graph-edge ${e.flag ? 'flag' : ''} ${isInvolved ? 'highlight' : ''} ${isDim ? 'dim' : ''} ${!isTree ? 'chord' : ''}`}
                  d={path}
                  strokeWidth={isInvolved ? 2 : (isTree ? 1.2 : 1)}
                  markerEnd={e.flag ? 'url(#orb-arr-flag)' : 'url(#orb-arr)'}
                />
                {!isInvolved && (() => {
                  const w = shortEdgeLabel(e);
                  if (!w) return null;
                  // Bias toward the outer endpoint so labels on edges leaving
                  // the root don't crowd the root's own name/subtitle.
                  const lx = isTree ? sp.x * 0.38 + tp.x * 0.62 : (sp.x + tp.x) * 0.42;
                  const ly = isTree ? sp.y * 0.38 + tp.y * 0.62 : (sp.y + tp.y) * 0.42;
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={lx - w.length * 3.5 - 3} y={ly - 7} width={w.length * 7 + 6} height={13} rx={3} fill="var(--bg)" opacity={isDim ? 0.4 : 0.95} />
                      <text x={lx} y={ly + 3} textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, fill: e.flag ? 'var(--c-alert)' : 'var(--ink-2)', opacity: isDim ? 0.35 : 0.85 }}>
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
            const fillSoft = n.type === 'person' ? 'var(--c-person-soft)' : n.type === 'company' ? 'var(--c-company-soft)' : 'var(--c-contract-soft)';

            const name = truncate(n.name, 32);
            const sub = n.subtitle ? truncate(n.subtitle, 32) : null;

            // Root needs extra clearance because of the animated pulse halo
            // (radius grows up to +18). Other nodes label outward radially.
            const labelOffset = isRoot ? radius + 22 : radius + 10;
            const angle = isRoot ? -Math.PI / 2 : Math.atan2(p.y, p.x);
            const lx = Math.cos(angle) * labelOffset;
            const ly = Math.sin(angle) * labelOffset;
            const cx_ = Math.cos(angle);
            const anchor = isRoot ? 'middle' : (cx_ > 0.25 ? 'start' : cx_ < -0.25 ? 'end' : 'middle');
            const dy = isRoot ? -10 : (Math.sin(angle) > 0.2 ? 10 : Math.sin(angle) < -0.2 ? -4 : 4);

            return (
              <g key={n.id} className={`graph-node-group node-hit ${isDim ? 'dim' : ''}`}
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
                <g transform={`translate(${lx}, ${ly})`} style={{ pointerEvents: 'none' }}>
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

      <ZoomSlider zoom={zoom} setZoom={setZoom} onReset={reset} />
      <Legend lang={lang} showChord />
    </div>
  );
}
