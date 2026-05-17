// Main App — search, top bar, view switcher, tweaks

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA, useRef: useRefA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "regular",
  "palette": "editorial"
}/*EDITMODE-END*/;

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
  const [q, setQ] = useStateA("");
  const [open, setOpen] = useStateA(false);
  const wrapRef = useRefA(null);

  useEffectA(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const t = window.I18N[lang];
  const idx = window.SEARCH_INDEX;
  const filtered = useMemoA(() => {
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
          placeholder={t.searchPlaceholder}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <span className="search-kbd">⌘K</span>
      </div>
      {open && (
        <div className="search-dropdown">
          <div className="search-section-title">{q.trim() ? (lang === "es" ? "Resultados" : "Results") : t.suggested}</div>
          {filtered.length === 0 && (
            <div style={{ padding: "16px 18px", color: "var(--ink-3)", fontSize: 13 }}>{t.noResults}</div>
          )}
          {filtered.map((r, i) => (
            <button key={i} className="search-result" onClick={() => { onSelect(r.id); setOpen(false); setQ(""); }}>
              <span className={`type-dot ${r.type}`} />
              <div>
                <div className="name">{r.name}</div>
                <div className="sub">{r.subtitle}</div>
              </div>
              <span className={`risk-pill ${r.risk >= 65 ? "" : "low"}`} style={{
                background: r.risk >= 65 ? "var(--c-alert-soft)" : "var(--bg-3)",
                color: r.risk >= 65 ? "var(--c-alert)" : "var(--ink-2)"
              }}>
                {r.risk}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ lang, onSelect }) {
  const t = window.I18N[lang];
  const cases = [
    { id: "fuentes", labelEs: "Puerta giratoria", labelEn: "Revolving door",
      nameEs: "Carlos Fuentes Saavedra", nameEn: "Carlos Fuentes Saavedra",
      descEs: "Ex-Subsecretario MOP que pasa a empresa que adjudicó CLP 184.500M durante su gestión.",
      descEn: "Former Deputy Minister now Director of a firm awarded CLP 184.5B during his tenure.",
      risk: 78 },
    { id: "errazuriz", labelEs: "Conflicto familiar", labelEn: "Family conflict",
      nameEs: "María José Errázuriz Pinto", nameEn: "María José Errázuriz Pinto",
      descEs: "Diputada en Comisión Minería con hermano CEO de empresa minera donante de campaña.",
      descEn: "Mining Committee deputy whose brother runs a mining firm donating to her campaign.",
      risk: 64 },
    { id: "losandes", labelEs: "Empresa fantasma", labelEn: "Shell company",
      nameEs: "Servicios Patagonia Express SpA", nameEn: "Servicios Patagonia Express SpA",
      descEs: "Empresa creada 11 días antes de adjudicarse contrato CONAF por CLP 7.800M.",
      descEn: "Company incorporated 11 days before being awarded a CLP 7.8B CONAF contract.",
      risk: 82 }
  ];
  return (
    <div className="empty">
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        ● {lang === "es" ? "Plataforma de transparencia · LATAM" : "Transparency platform · LATAM"}
      </div>
      <h1 className="empty-title">
        {lang === "es"
          ? <>DeQuiénes te muestra los datos.<br/><em style={{ fontStyle: "italic", color: "var(--ink-3)" }}>Nosotros te decimos qué significan.</em></>
          : <>Other platforms show you the data.<br/><em style={{ fontStyle: "italic", color: "var(--ink-3)" }}>We tell you what it means.</em></>}
      </h1>
      <div className="empty-sub">
        {lang === "es"
          ? "Busca cualquier persona, empresa o contrato. La IA detecta conflictos, redes de poder y banderas rojas en segundos."
          : "Search any person, company or contract. The AI detects conflicts, power networks and red flags in seconds."}
      </div>
      <div className="suggested-grid">
        {cases.map(c => (
          <button key={c.id} className="suggested-case" onClick={() => onSelect(c.id)}>
            <div className="label">{lang === "es" ? c.labelEs : c.labelEn}</div>
            <div className="name">{lang === "es" ? c.nameEs : c.nameEn}</div>
            <div className="desc">{lang === "es" ? c.descEs : c.descEn}</div>
            <div className="risk-row">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
                {lang === "es" ? "Riesgo" : "Risk"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: c.risk >= 65 ? "var(--c-alert)" : "var(--c-warn)" }}>
                {c.risk}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [lang, setLang] = useStateA("es");
  const [caseId, setCaseId] = useStateA(null);
  const [view, setView] = useStateA("neural");
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks
  useEffectA(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
    const p = PALETTES[tweaks.palette] || PALETTES.editorial;
    applyPalette(p);
  }, [tweaks.theme, tweaks.density, tweaks.palette]);

  // Keyboard shortcut for search
  useEffectA(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".search-input-row input")?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const caseData = caseId ? window.DEMO_CASES[caseId] : null;
  const t = window.I18N[lang];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span className="dot" /></div>
          <div className="brand-text">{t.appName} <em>LATAM</em></div>
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
        <div className="canvas-col">
          {caseData ? (
            <>
              <div className="canvas-tabs">
                <div className="tabs-group">
                  <button className={`tab-btn ${view === "neural" ? "active" : ""}`} onClick={() => setView("neural")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="4" cy="8" r="1.6" fill="currentColor"/>
                      <circle cx="4" cy="16" r="1.6" fill="currentColor"/>
                      <circle cx="12" cy="5" r="1.6" fill="currentColor"/>
                      <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
                      <circle cx="12" cy="19" r="1.6" fill="currentColor"/>
                      <circle cx="20" cy="9" r="1.6" fill="currentColor"/>
                      <circle cx="20" cy="15" r="1.6" fill="currentColor"/>
                      <path d="M5.5 8 L10.5 5 M5.5 8 L10.5 12 M5.5 8 L10.5 19 M5.5 16 L10.5 5 M5.5 16 L10.5 12 M5.5 16 L10.5 19 M13.5 5 L18.5 9 M13.5 12 L18.5 9 M13.5 12 L18.5 15 M13.5 19 L18.5 15"/>
                    </svg>
                    {lang === "es" ? "Red Neuronal" : "Neural Net"}
                  </button>
                  <button className={`tab-btn ${view === "orbit" ? "active" : ""}`} onClick={() => setView("orbit")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="2.4" fill="currentColor"/>
                      <circle cx="12" cy="12" r="6" strokeDasharray="2 2"/>
                      <circle cx="12" cy="12" r="10" strokeDasharray="2 2"/>
                      <circle cx="18" cy="12" r="1.4" fill="currentColor"/>
                      <circle cx="6" cy="14" r="1" fill="currentColor"/>
                      <circle cx="14" cy="3.5" r="1" fill="currentColor"/>
                    </svg>
                    {lang === "es" ? "Órbitas" : "Orbits"}
                  </button>
                  <button className={`tab-btn ${view === "timeline" ? "active" : ""}`} onClick={() => setView("timeline")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="12" x2="20" y2="12"/><circle cx="8" cy="12" r="2" fill="currentColor"/><circle cx="14" cy="12" r="2" fill="currentColor"/></svg>
                    {t.viewTimeline}
                  </button>
                  <button className={`tab-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="1"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>
                    {t.viewTable}
                  </button>
                </div>
                <div className="canvas-meta">
                  <span><strong>{caseData.nodes.length}</strong> {lang === "es" ? "nodos" : "nodes"}</span>
                  <span className="divider-dot">·</span>
                  <span><strong>{caseData.edges.length}</strong> {lang === "es" ? "relaciones" : "edges"}</span>
                  <span className="divider-dot">·</span>
                  <span>
                    <strong style={{ color: "var(--c-alert)" }}>{caseData.flags.length}</strong> {lang === "es" ? "🚩" : "🚩"}
                  </span>
                </div>
              </div>

              {view === "neural" && <window.NeuralView caseData={caseData} lang={lang} onNodeClick={() => {}} />}
              {view === "orbit" && <window.OrbitView caseData={caseData} lang={lang} onNodeClick={() => {}} />}
              {view === "timeline" && <window.TimelineView caseData={caseData} lang={lang} />}
              {view === "table" && <window.TableView caseData={caseData} lang={lang} />}

              <window.Chatbot caseData={caseData} lang={lang} />
            </>
          ) : (
            <EmptyState lang={lang} onSelect={setCaseId} />
          )}
        </div>

        {caseData && <window.RightPanel caseData={caseData} lang={lang} />}
      </main>

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection label={lang === "es" ? "Tema" : "Theme"}>
          <window.TweakRadio label={lang === "es" ? "Modo" : "Mode"} options={[
            { value: "light", label: lang === "es" ? "Claro" : "Light" },
            { value: "dark", label: lang === "es" ? "Oscuro" : "Dark" }
          ]} value={tweaks.theme} onChange={v => setTweak("theme", v)} />
        </window.TweakSection>

        <window.TweakSection label={lang === "es" ? "Paleta de colores" : "Palette"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "4px 0" }}>
            {Object.entries(PALETTES).map(([k, p]) => (
              <PaletteSwatch key={k} palette={p} active={tweaks.palette === k} onClick={() => setTweak("palette", k)} />
            ))}
          </div>
        </window.TweakSection>

        <window.TweakSection label={lang === "es" ? "Densidad" : "Density"}>
          <window.TweakRadio label={lang === "es" ? "Spacing" : "Spacing"} options={[
            { value: "compact", label: lang === "es" ? "Compacto" : "Compact" },
            { value: "regular", label: lang === "es" ? "Regular" : "Regular" },
            { value: "spacious", label: lang === "es" ? "Amplio" : "Spacious" }
          ]} value={tweaks.density} onChange={v => setTweak("density", v)} />
        </window.TweakSection>
      </window.TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
