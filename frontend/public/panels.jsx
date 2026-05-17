// Right panel: profile + AI summary + red flags + Chatbot

const { useState: useState_p, useEffect: useEffect_p, useRef: useRef_p } = React;

function RiskBadge({ value }) {
  const sev = value >= 65 ? "high" : value >= 40 ? "med" : "low";
  const label = value >= 65 ? "Alto" : value >= 40 ? "Medio" : "Bajo";
  return (
    <span className={`risk-tag ${sev === "med" ? "med" : sev === "low" ? "low" : ""}`}>
      {label}
    </span>
  );
}

function RightPanel({ caseData, lang, onAskQuestion }) {
  const t = window.I18N[lang];
  const root = caseData.nodes.find(n => n.id === caseData.rootId);
  const connections = caseData.edges.filter(e => e.s === caseData.rootId || e.t === caseData.rootId).length;
  const flaggedRel = caseData.edges.filter(e => e.flag).length;

  return (
    <aside className="right-panel">
      <div className="profile-head">
        <div className="profile-eyebrow">
          <span className={`type-dot ${root.type}`} />
          {t.nodeTypes[root.type]} Â· {root.country}
        </div>
        <h2 className="profile-name">{root.name}</h2>
        {root.subtitle && <div className="profile-sub">{root.subtitle}</div>}

        <div className="profile-stats">
          <div className="stat-card risk">
            <div className="label">{t.riskScore}</div>
            <div className="value">{root.risk}<RiskBadge value={root.risk} /></div>
          </div>
          <div className="stat-card">
            <div className="label">{lang === "es" ? "Conexiones" : "Connections"}</div>
            <div className="value">{connections}</div>
          </div>
          <div className="stat-card" style={{ gridColumn: "1 / -1" }}>
            <div className="label">{lang === "es" ? "Relaciones marcadas" : "Flagged relations"}</div>
            <div className="value" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              {flaggedRel}
              <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                / {caseData.edges.length} {lang === "es" ? "totales" : "total"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">{t.aiSummary}</div>
        <div className="ai-summary-card">
          <div className="ai-eyebrow">
            <span className="pulse-dot" />
            {lang === "es" ? "AnÃ¡lisis generado" : "Generated analysis"}
          </div>
          <div className="ai-summary-body">{caseData.summary[lang]}</div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <span>{t.redFlags}</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--c-alert)" }}>
            {caseData.flags.length} {lang === "es" ? "detectadas" : "detected"}
          </span>
        </div>
        {caseData.flags.map((f, i) => (
          <div className="flag-card slide-up" key={f.id} style={{ animationDelay: `${i * 80}ms` }}>
            <div className="head">
              <span className={`flag-badge ${f.severity}`}>
                {f.severity === "high" ? t.severityHigh : f.severity === "medium" ? t.severityMedium : t.severityLow}
              </span>
              <div className="flag-title">{f.title[lang]}</div>
            </div>
            <div className="flag-evidence">{f.evidence[lang]}</div>
            <a className="flag-source" href={f.source.url} onClick={e => e.preventDefault()}>
              â {f.source.label}
            </a>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ============ CHATBOT ============ */

function Chatbot({ caseData, lang }) {
  const [expanded, setExpanded] = useState_p(false);
  const [messages, setMessages] = useState_p([]);
  const [input, setInput] = useState_p("");
  const [typing, setTyping] = useState_p(false);
  const msgsRef = useRef_p(null);

  // Reset on case change
  useEffect_p(() => { setMessages([]); setInput(""); setTyping(false); }, [caseData.id]);

  useEffect_p(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, typing]);

  const t = window.I18N[lang];
  const sugg = window.SUGGESTED_QUESTIONS[lang];

  // Simulate AI response â pulls from real case data
  const fakeAnswer = (q) => {
    const lc = q.toLowerCase();
    const root = caseData.nodes.find(n => n.id === caseData.rootId);
    if (lc.includes("conflict") || lc.includes("interÃ©s") || lc.includes("interes")) {
      const high = caseData.flags.filter(f => f.severity === "high");
      if (high.length) return (lang === "es"
        ? `El mÃ¡s grave: ${high[0].title.es.toLowerCase()}. ${high[0].evidence.es}`
        : `Most serious: ${high[0].title.en.toLowerCase()}. ${high[0].evidence.en}`);
    }
    if (lc.includes("famil")) {
      const fam = caseData.edges.find(e => e.type === "family_of");
      if (fam) {
        const a = caseData.nodes.find(n => n.id === fam.s);
        const b = caseData.nodes.find(n => n.id === fam.t);
        return lang === "es"
          ? `Se detecta un vÃ­nculo familiar entre ${a.name} y ${b.name} (${fam.label}). Esto activa la regla de abstenciÃ³n cuando hay decisiones que los afectan econÃ³micamente.`
          : `A family tie between ${a.name} and ${b.name} (${fam.label}). This triggers a recusal rule for decisions affecting them economically.`;
      }
    }
    if (lc.includes("inusual") || lc.includes("unusual") || lc.includes("patrÃ³n") || lc.includes("pattern")) {
      return lang === "es"
        ? `El patrÃ³n estÃ¡ dentro del 7% mÃ¡s anÃ³malo de la base. La combinaciÃ³n de ${caseData.flags.length} seÃ±ales graves en un mismo nodo es lo que dispara el score de ${root.risk}.`
        : `The pattern is in the top 7% most anomalous of our dataset. The combination of ${caseData.flags.length} serious signals on a single node drives the risk score of ${root.risk}.`;
    }
    if (lc.includes("extranj") || lc.includes("foreign") || lc.includes("offshore")) {
      return lang === "es"
        ? `No se detectaron vÃ­nculos offshore directos en esta bÃºsqueda. Para verificar, cruzarÃ­amos con ICIJ Offshore Leaks (pendiente).`
        : `No direct offshore ties detected in this search. To verify, we'd cross-check against ICIJ Offshore Leaks (pending integration).`;
    }
    // default
    return lang === "es"
      ? `Buscando en el subgrafo de ${root.name}: ${caseData.summary.es.split(". ")[0]}.`
      : `Searching the subgraph of ${root.name}: ${caseData.summary.en.split(". ")[0]}.`;
  };

  const send = (text) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    if (!expanded) setExpanded(true);
    setTimeout(() => {
      setMessages(m => [...m, { role: "ai", text: fakeAnswer(text) }]);
      setTyping(false);
    }, 900 + Math.random() * 600);
  };

  return (
    <div className={`chatbot ${expanded ? "expanded" : "collapsed"}`}>
      <div className="chatbot-head" onClick={() => setExpanded(e => !e)}>
        <div className="chatbot-head-l">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <div className="chatbot-title">{t.askProfile} <em>Â· {caseData.nodes.find(n=>n.id===caseData.rootId).name.split(" ").slice(0,2).join(" ")}</em></div>
        </div>
        <span className="chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </span>
      </div>

      {expanded && (
        <div className="chatbot-body">
          <div className="chat-messages" ref={msgsRef}>
            {messages.length === 0 && (
              <div style={{ color: "var(--ink-3)", fontSize: 13, fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
                {lang === "es"
                  ? "Hazle una pregunta a la IA sobre este perfil â analiza la red, los contratos y los vÃ­nculos."
                  : "Ask the AI a question about this profile â it analyzes the network, contracts and ties."}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role} slide-up`}>{m.text}</div>
            ))}
            {typing && <div className="msg ai typing slide-up">{lang === "es" ? "Analizando" : "Analyzing"}</div>}
          </div>

          <div className="suggested-row">
            {sugg.map((q, i) => (
              <button key={i} className="suggested-chip" onClick={() => send(q)}>{q}</button>
            ))}
          </div>

          <form className="chat-input-row" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t.askPlaceholder}
            />
            <button className="chat-send" type="submit" disabled={!input.trim()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

window.RightPanel = RightPanel;
window.Chatbot = Chatbot;
