import React, { useEffect, useMemo, useState } from 'react';
import { layeredLayout } from '../../lib/layouts/layered';
import { useStage } from '../../lib/graph/useStage';
import { typeColor, truncate, shortEdgeLabel } from '../../lib/graph/utils';
import ZoomSlider from './ZoomSlider';
import Legend from './Legend';

export default function NeuralView({ caseData, lang, onNodeClick }) {
  const { stageRef, dims, zoom, setZoom, pan, isDragging, handlers, reset } = useStage();
  const [hoveredId, setHoveredId] = useState(null);

  const layout = useMemo(() => {
    const probe = layeredLayout(caseData, 240, 78);
    const padding = 130;
    const available = Math.max(360, dims.w - padding * 2);
    const colStep = Math.max(160, Math.min(280, available / Math.max(1, probe.layerCount - 1)));
    const maxNodesInColumn = Math.max(...Array.from(probe.ordered.values()).map(a => a.length));
    const availableH = Math.max(280, dims.h - 140);
    const rowStep = Math.max(56, Math.min(90, availableH / Math.max(1, maxNodesInColumn)));
    return layeredLayout(caseData, colStep, rowStep);
  }, [caseData.id, dims.w, dims.h]);

  useEffect(() => { reset(); setHoveredId(null); }, [caseData.id]);

  const particles = useMemo(() => {
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

  function neuralPath(sp, tp) {
    const dx = tp.x - sp.x;
    const c1x = sp.x + dx * 0.5;
    const c1y = sp.y;
    const c2x = tp.x - dx * 0.5;
    const c2y = tp.y;
    return `M ${sp.x} ${sp.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tp.x} ${tp.y}`;
  }

  const labelLang = lang === 'es'
    ? ['Raíz', '1° grado', '2° grado', '3° grado', '4° grado']
    : ['Root', '1st', '2nd', '3rd', '4th'];

  return (
    <div
      ref={stageRef}
      className="canvas-stage neural-stage"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
        </defs>

        <g transform={`translate(${cx}, ${cy}) scale(${zoom})`}>
          {particles.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="var(--ink-3)" opacity={p.op} />
          ))}

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
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  fill="var(--ink-3)"
                >
                  {labelLang[d] || `${d}°`}
                </text>
              </g>
            ));
          })()}

          {caseData.edges.map((e, i) => {
            const sp = layout.positions.get(e.s);
            const tp = layout.positions.get(e.t);
            if (!sp || !tp) return null;
            const isInvolved = hoveredId !== null && (e.s === hoveredId || e.t === hoveredId);
            const isDim = hoveredId !== null && !isInvolved;
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
            const stroke = e.flag ? 'var(--c-alert)' : 'currentColor';
            return (
              <g key={i} style={{ color: 'var(--ink-2)' }}>
                <path d={path} fill="none" stroke={stroke} strokeWidth={isInvolved ? 6 : 4} opacity={isInvolved ? 0.18 : 0.04} filter="url(#neural-blur)" />
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isInvolved ? 1.8 : 1.1}
                  opacity={opacity}
                  strokeDasharray={e.flag ? '5 3' : 'none'}
                  style={{ animation: e.flag ? 'dashMove 30s linear infinite' : 'none' }}
                />
                {!isInvolved && (() => {
                  const w = shortEdgeLabel(e);
                  if (!w) return null;
                  const lx = (sp.x + tp.x) / 2;
                  const ly = sameLayer ? (sp.y + tp.y) / 2 - 18 : (sp.y + tp.y) / 2 - 4;
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={lx - w.length * 3.5 - 3} y={ly - 7} width={w.length * 7 + 6} height={13} rx={3} fill="var(--bg)" opacity={isDim ? 0.4 : 0.92} />
                      <text x={lx} y={ly + 3} textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, fill: e.flag ? 'var(--c-alert)' : 'var(--ink-2)', opacity: isDim ? 0.35 : 0.85 }}>
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
                        <rect x={lx - w / 2 - 4} y={ly - 8} width={w + 8} height={15} rx={3} fill="var(--bg)" stroke="var(--line)" />
                        <text x={lx} y={ly + 3} textAnchor="middle" className="graph-edge-label">{e.label}</text>
                      </>;
                    })()}
                  </g>
                )}
              </g>
            );
          })}

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
            const labelOff = baseR + 14;

            return (
              <g
                key={n.id}
                className={`node-hit ${isDim ? 'constellation-dim' : ''}`}
                transform={`translate(${p.x}, ${p.y})`}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onNodeClick && onNodeClick(n)}
                style={{ cursor: 'pointer' }}
              >
                <g style={{ color }}>
                  <circle r={glowR} fill={`url(#${isRoot ? 'neural-root-glow' : 'neural-glow'})`} opacity={isHovered ? 1 : 0.85} />
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
                <g style={{ pointerEvents: 'none' }}>
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

      <ZoomSlider zoom={zoom} setZoom={setZoom} onReset={reset} />
      <Legend lang={lang} />
    </div>
  );
}
