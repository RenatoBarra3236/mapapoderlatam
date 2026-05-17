import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DEMO_CASES, SEARCH_INDEX, I18N, RELATION_LABELS } from './data';

const TWEAK_DEFAULTS = { theme: "light", density: "regular", palette: "editorial" };

const PALETTES = {
  editorial: {
    label: "Editorial",
    person: "#534AB7", company: "#0F6E56", contract: "#993C1D", alert: "#A32D2D"
  },
  ocean: {
    label: "Oceánica",
    person: "#2A6FDB", company: "#0E8C75", contract: "#C25E1A", alert: "#C03B3B"
  },
  ember: {
    label: "Ember",
    person: "#7A4FB3", company: "#1F7A4F", contract: "#B85A1F", alert: "#B33030"
  },
  graphite: {
    label: "Graphite",
    person: "#3D3D7A", company: "#3F6E5B", contract: "#8C4A2E", alert: "#923333"
  }
};

function applyPalette(p) {
  const root = document.documentElement;
  root.style.setProperty("--c-person", p.person);
  root.style.setProperty("--c-company", p.company);
  root.style.setProperty("--c-contract", p.contract);
  root.style.setProperty("--c-alert", p.alert);
}

function useTweaks(defaults) {
  const [tweaks, setTweaks] = useState(defaults);
  const setTweak = (key, value) => setTweaks(t => ({ ...t, [key]: value }));
  return [tweaks, setTweak];
}

function PaletteSwatch({ palette, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1.5px solid ${active ? "var(--ink)" : "var(--line)"}`,
        background: "var(--surface)",
        borderRadius: 10,
        padding: 8,
        display: "flex", flexDirection: "column", gap: 6,
        cursor: "pointer", flex: 1,
        transition: "border-color 120ms"
      }}
    >
      <div style={{ display: "flex", gap: 3 }}>
        {[palette.person, palette.company, palette.contract, palette.alert].map((c, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-2)", textAlign: "left", fontFamily: "var(--font-mono)" }}>{palette.label}</div>
    </button>
  );
}

function SearchBar({ lang, onSelect }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const idx = SEARCH_INDEX;
  const filtered = useMemo(() => {
    if (!q.trim()) return idx;
    return idx.filter(r => r.name.toLowerCase().includes(q.toLowerCase()) || (r.subtitle || "").toLowerCase().includes(q.toLowerCase()));
  }, [q]);

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search-input-row">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          placeholder="Buscar..."
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <span className="search-kbd">⌘K</span>
      </div>
      {open && (
        <div className="search-dropdown">
          <div className="search-section-title">{q.trim() ? "Resultados" : "Casos sugeridos"}</div>
          {filtered.length === 0 && (
            <div style={{ padding: "16px 18px", color: "var(--ink-3)", fontSize: 13 }}>Sin resultados</div>
          )}
          {filtered.map((r, i) => (
            <button key={i} className="search-result" onClick={() => { onSelect(r.caseId); setOpen(false); setQ(""); }}>
              <span className={`type-dot ${r.type}`} />
              <div>
                <div className="name">{r.name}</div>
                <div className="sub">{r.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ lang, onSelect }) {
  const cases = [
    { id: "fuentes", label: "Puerta giratoria", name: "Carlos Fuentes Saavedra", desc: "Ex-Subsecretario MOP que pasa a empresa que adjudicó CLP 184.500M", risk: 78 },
    { id: "errazuriz", label: "Conflicto familiar", name: "Alejandra Errázuriz", desc: "Presidenta ejecutiva de grupo retail con potencial concentración de proveedores", risk: 64 },
    { id: "losandes", label: "Empresa fantasma", name: "Constructora Los Andes Fantasma", desc: "Creada 2 meses antes de adjudicarse contratos por CLP 1.198B", risk: 89 }
  ];
  return (
    <div className="empty">
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        • Plataforma de transparencia · LATAM
      </div>
      <h1 className="empty-title">
        <>Mapa de Poder <em style={{ fontStyle: "italic", color: "var(--ink-3)" }}>LATAM</em></>
      </h1>
      <div className="empty-sub">
        Busca cualquier persona, empresa o contrato. Visualiza sus conexiones y detecta conflictos de interés.
      </div>
      <div className="suggested-grid">
        {cases.map(c => (
          <button key={c.id} className="suggested-case" onClick={() => onSelect(c.id)}>
            <div className="label">{c.label}</div>
            <div className="name">{c.name}</div>
            <div className="desc">{c.desc}</div>
            <div className="risk-row">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>Riesgo</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: c.risk >= 65 ? "var(--c-alert)" : "var(--c-warn)" }}>{c.risk}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RiskBadge({ value }) {
  const sev = value >= 65 ? "high" : value >= 40 ? "med" : "low";
  const label = value >= 65 ? "Alto" : value >= 40 ? "Medio" : "Bajo";
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 500,
      background: sev === "high" ? "var(--c-alert)" : sev === "med" ? "var(--c-warn)" : "var(--bg-3)",
      color: sev === "high" ? "white" : sev === "med" ? "white" : "var(--ink)"
    }}>
      {label}
    </span>
  );
}

function RightPanel({ caseData, lang }) {
  const root = caseData.nodes.find(n => n.id === caseData.rootId);
  const connections = caseData.edges.filter(e => e.s === caseData.rootId || e.t === caseData.rootId).length;
  const flaggedRel = caseData.edges.filter(e => e.flag).length;

  return (
    <aside style={{
      width: 380,
      borderLeft: "1px solid var(--border)",
      overflowY: "auto",
      padding: 20,
      background: "var(--bg)"
    }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <span style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: root.type === 'person' ? 'var(--c-person)' : root.type === 'company' ? 'var(--c-company)' : 'var(--c-contract)',
            marginRight: 6
          }} />
          {root.type === 'person' ? 'Persona' : root.type === 'company' ? 'Empresa' : 'Contrato'} · {root.country}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>{root.name}</h2>
        {root.subtitle && <div style={{ fontSize: 14, color: "var(--ink-2)" }}>{root.subtitle}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{
          padding: 12,
          borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--line)"
        }}>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>Riesgo</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{root.risk}</div>
          <RiskBadge value={root.risk} />
        </div>
        <div style={{
          padding: 12,
          borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--line)"
        }}>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>Conexiones</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>{connections}</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 12,
          color: "var(--ink)",
          textTransform: "uppercase",
          fontSize: 12,
          letterSpacing: "0.05em"
        }}>
          📋 Resumen IA
        </div>
        <div style={{
          padding: 12,
          borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--ink-2)"
        }}>
          {caseData.summary.es}
        </div>
      </div>

      <div>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 12,
          color: "var(--ink)",
          textTransform: "uppercase",
          fontSize: 12,
          letterSpacing: "0.05em",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          🚩 Red Flags
          <span style={{ fontSize: 11, color: "var(--c-alert)", fontFamily: "var(--font-mono)" }}>
            {caseData.flags.length} detectadas
          </span>
        </div>
        {caseData.flags.map((f, i) => (
          <div
            key={f.id}
            style={{
              padding: 12,
              borderRadius: 8,
              background: "var(--bg-2)",
              border: `1px solid ${f.severity === 'high' ? 'var(--c-alert)' : 'var(--c-warn)'}`,
              marginBottom: 12,
              fontSize: 13
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8
            }}>
              <span style={{
                padding: "2px 6px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 600,
                background: f.severity === 'high' ? 'var(--c-alert)' : 'var(--c-warn)',
                color: 'white'
              }}>
                {f.severity === 'high' ? 'ALTO' : 'MEDIO'}
              </span>
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>{f.title.es}</div>
            </div>
            <div style={{ color: "var(--ink-2)", fontSize: 12 }}>{f.evidence.es}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function TimelineView({ caseData, lang }) {
  if (!caseData.timeline) return <div style={{ padding: 20 }}>Sin datos de timeline</div>;
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 600 }}>
        {caseData.timeline.map((event, i) => (
          <div key={i} style={{ marginBottom: 20, paddingLeft: 20, borderLeft: `2px solid var(--c-${event.severity === 'high' ? 'alert' : event.severity === 'warn' ? 'warn' : 'info'})` }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{event.date}</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{event.title}</div>
            {event.note && <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 8 }}>{event.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableView({ caseData, lang }) {
  return (
    <div style={{ padding: 20, overflowX: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)' }}>
            <th style={{ textAlign: 'left', padding: 8, fontWeight: 500 }}>De</th>
            <th style={{ textAlign: 'left', padding: 8, fontWeight: 500 }}>Relación</th>
            <th style={{ textAlign: 'left', padding: 8, fontWeight: 500 }}>A</th>
          </tr>
        </thead>
        <tbody>
          {caseData.edges.map((edge, i) => {
            const fromNode = caseData.nodes.find(n => n.id === edge.s);
            const toNode = caseData.nodes.find(n => n.id === edge.t);
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: 8 }}>{fromNode?.name}</td>
                <td style={{ padding: 8, color: "var(--ink-2)" }}>{edge.label}</td>
                <td style={{ padding: 8 }}>{toNode?.name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ImprovedGraph({ caseData, lang }) {
  const svgRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (!svgRef.current || !caseData) return;

    const w = svgRef.current.clientWidth;
    const h = svgRef.current.clientHeight;

    const nodes = caseData.nodes || [];
    const edges = caseData.edges || [];

    // Force-directed layout with spring physics simulation
    const positions = new Map();
    const velocities = new Map();

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const r = Math.min(w, h) / 3;
      positions.set(node.id, {
        x: w / 2 + Math.cos(angle) * r,
        y: h / 2 + Math.sin(angle) * r
      });
      velocities.set(node.id, { x: 0, y: 0 });
    });

    // Simple force simulation (3 iterations)
    for (let iter = 0; iter < 3; iter++) {
      nodes.forEach(node => {
        let fx = 0, fy = 0;
        const pos = positions.get(node.id);

        // Repulsion from other nodes
        nodes.forEach(other => {
          if (other.id === node.id) return;
          const otherPos = positions.get(other.id);
          const dx = pos.x - otherPos.x;
          const dy = pos.y - otherPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const force = 50 / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        // Attraction to connected nodes
        edges.forEach(edge => {
          if (edge.s === node.id) {
            const target = positions.get(edge.t);
            const dx = target.x - pos.x;
            const dy = target.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
            fx += (dx / dist) * 0.1;
            fy += (dy / dist) * 0.1;
          } else if (edge.t === node.id) {
            const target = positions.get(edge.s);
            const dx = target.x - pos.x;
            const dy = target.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
            fx += (dx / dist) * 0.1;
            fy += (dy / dist) * 0.1;
          }
        });

        // Update position
        pos.x += fx * 0.01;
        pos.y += fy * 0.01;

        // Keep in bounds
        pos.x = Math.max(30, Math.min(w - 30, pos.x));
        pos.y = Math.max(30, Math.min(h - 30, pos.y));
      });
    }

    // Draw SVG
    while (svgRef.current.firstChild) svgRef.current.removeChild(svgRef.current.firstChild);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';

    // Draw edges
    edges.forEach(edge => {
      const from = positions.get(edge.s);
      const to = positions.get(edge.t);
      if (from && to) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x);
        line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y);
        line.setAttribute('stroke', edge.flag ? 'var(--c-alert)' : 'var(--line)');
        line.setAttribute('stroke-width', edge.flag ? '2' : '1');
        line.setAttribute('opacity', hoveredId && (edge.s !== hoveredId && edge.t !== hoveredId) ? '0.2' : '1');
        line.style.transition = 'opacity 200ms';
        svg.appendChild(line);
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const pos = positions.get(node.id);
      if (pos) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', hoveredId === node.id ? '28' : '22');
        circle.setAttribute('fill', node.type === 'person' ? 'var(--c-person)' : node.type === 'company' ? 'var(--c-company)' : 'var(--c-contract)');
        circle.style.transition = 'r 200ms';
        circle.style.cursor = 'pointer';
        g.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', 'white');
        text.textContent = node.name.substring(0, 4);
        g.appendChild(text);

        g.onmouseenter = () => setHoveredId(node.id);
        g.onmouseleave = () => setHoveredId(null);

        svg.appendChild(g);
      }
    });

    svgRef.current.appendChild(svg);
  }, [caseData, hoveredId]);

  return (
    <div
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)'
      }}
    />
  );
}

export default function App() {
  const [lang, setLang] = useState("es");
  const [caseId, setCaseId] = useState(null);
  const [view, setView] = useState("graph");
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
    const p = PALETTES[tweaks.palette] || PALETTES.editorial;
    applyPalette(p);
  }, [tweaks.theme, tweaks.density, tweaks.palette]);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".search-input-row input")?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const caseData = caseId ? DEMO_CASES[caseId] : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span className="dot" /></div>
          <div className="brand-text">Mapa de Poder <em>LATAM</em></div>
        </div>
        <SearchBar lang={lang} onSelect={setCaseId} />
        <div className="topbar-tools">
          <div className="lang-toggle">
            <button className={lang === "es" ? "active" : ""} onClick={() => setLang("es")}>ES</button>
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <button className="tool-btn" onClick={() => setTweak("theme", tweaks.theme === "light" ? "dark" : "light")} title="Tema">
            {tweaks.theme === "light"
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="canvas-col" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {caseData ? (
            <>
              <div className="canvas-tabs">
                <div className="tabs-group">
                  <button
                    className={`tab-btn ${view === "graph" ? "active" : ""}`}
                    onClick={() => setView("graph")}
                    style={{ cursor: 'pointer' }}
                  >
                    📊 Grafo
                  </button>
                  <button
                    className={`tab-btn ${view === "timeline" ? "active" : ""}`}
                    onClick={() => setView("timeline")}
                    style={{ cursor: 'pointer' }}
                  >
                    📈 Timeline
                  </button>
                  <button
                    className={`tab-btn ${view === "table" ? "active" : ""}`}
                    onClick={() => setView("table")}
                    style={{ cursor: 'pointer' }}
                  >
                    📋 Tabla
                  </button>
                </div>
                <div className="canvas-meta">
                  <span><strong>{caseData.nodes.length}</strong> nodos</span>
                  <span className="divider-dot">·</span>
                  <span><strong>{caseData.edges.length}</strong> relaciones</span>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {view === "graph" && <ImprovedGraph caseData={caseData} lang={lang} />}
                {view === "timeline" && <TimelineView caseData={caseData} lang={lang} />}
                {view === "table" && <TableView caseData={caseData} lang={lang} />}
              </div>
            </>
          ) : (
            <EmptyState lang={lang} onSelect={setCaseId} />
          )}
        </div>

        {caseData && <RightPanel caseData={caseData} lang={lang} />}
      </main>
    </div>
  );
}
