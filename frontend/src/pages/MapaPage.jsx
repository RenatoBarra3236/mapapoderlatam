import React, { useEffect, useState } from 'react';
import Topbar from '../components/topbar/Topbar';
import EmptyState from '../components/canvas/EmptyState';
import CanvasTabs from '../components/canvas/CanvasTabs';
import NeuralView from '../components/canvas/NeuralView';
import OrbitView from '../components/canvas/OrbitView';
import TimelineView from '../components/canvas/TimelineView';
import TableView from '../components/canvas/TableView';
import RightPanel from '../components/panel/RightPanel';
import ChatbotDrawer from '../components/chatbot/ChatbotDrawer';
import TweaksPanel from '../components/tweaks/TweaksPanel';
import { applyPalette } from '../components/tweaks/palettes';
import { I18N } from '../lib/i18n';
import { getDemoCase, getEntityGraph, healthCheck } from '../lib/api';

const STORAGE_KEY = 'mapapoder.tweaks';

function loadTweaks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export default function MapaPage() {
  const saved = loadTweaks();
  const [lang, setLang] = useState(saved.lang || 'es');
  const [theme, setTheme] = useState(saved.theme || 'light');
  const [palette, setPalette] = useState(saved.palette || 'editorial');
  const [density, setDensity] = useState(saved.density || 'regular');
  const [activeCase, setActiveCase] = useState(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [backendState, setBackendState] = useState('checking');
  const [notice, setNotice] = useState(null);
  const [view, setView] = useState('neural');
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    applyPalette(palette, theme);
  }, [theme, palette]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, theme, palette, density }));
  }, [lang, theme, palette, density]);

  useEffect(() => {
    let cancelled = false;
    async function checkBackend() {
      try {
        const result = await healthCheck();
        if (cancelled) return;
        const demoMode = result?.demo || result?.status === 'disabled';
        setBackendState(demoMode ? 'demo' : 'live');
        setNotice(demoMode ? I18N[lang].backendUnavailable : null);
      } catch {
        if (!cancelled) {
          setBackendState('demo');
          setNotice(I18N[lang].backendUnavailable);
        }
      }
    }
    checkBackend();
    return () => { cancelled = true; };
  }, [lang]);

  const t = I18N[lang];
  const caseData = activeCase;

  async function pickCase(selection) {
    const selected = typeof selection === 'object' ? selection : { id: selection };
    if (selected.fromDemo || selected.caseId) {
      const demo = getDemoCase(selected.caseId || selected.id);
      if (demo) {
        setActiveCase(demo);
        setGraphError(null);
        setNotice(t.usingDemo);
      }
      return;
    }

    const entityId = selected.entityId || selected.id;
    if (!entityId) return;

    setGraphError(null);
    setNotice(t.loadingGraph);
    setLoadingGraph(true);
    try {
      const graph = await getEntityGraph(entityId, { depth: 2 });
      if (!graph.nodes.length) {
        throw new Error('Graph has no nodes');
      }
      setActiveCase(graph);
      setNotice(graph.fromDemo ? t.usingDemo : t.usingBackend);
    } catch (error) {
      setGraphError(lang === 'es'
        ? `No se pudo cargar el grafo desde la API. ${error.message || ''}`.trim()
        : `Could not load the graph from the API. ${error.message || ''}`.trim());
      setNotice(lang === 'es'
        ? 'No se pudo cargar el grafo. Puedes seguir usando los casos demo.'
        : 'Could not load the graph. Demo cases remain available.');
    } finally {
      setLoadingGraph(false);
    }
  }

  const emptyStatus = graphError || (backendState === 'demo' ? t.backendUnavailable : null);

  return (
    <div className="app">
      {notice && (
        <div className={`data-notice ${backendState === 'demo' || caseData?.fromDemo ? 'demo' : 'api'}`}>
          {notice}
        </div>
      )}
      <Topbar
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        t={t}
        onPickCase={pickCase}
        onOpenTweaks={() => setTweaksOpen(v => !v)}
      />
      <main className={`main ${caseData ? '' : 'empty-mode'}`}>
        <div className="canvas-col">
          {loadingGraph && !caseData ? (
            <EmptyState
              t={t}
              lang={lang}
              onPick={pickCase}
              status={t.loadingGraph}
              hideSuggestions
            />
          ) : caseData ? (
            <>
              <CanvasTabs view={view} setView={setView} lang={lang} caseData={caseData} />
              {view === 'neural' && <NeuralView caseData={caseData} lang={lang} onNodeClick={caseData.fromDemo ? undefined : pickCase} />}
              {view === 'orbit' && <OrbitView caseData={caseData} lang={lang} onNodeClick={caseData.fromDemo ? undefined : pickCase} />}
              {view === 'timeline' && <TimelineView caseData={caseData} lang={lang} />}
              {view === 'table' && <TableView caseData={caseData} lang={lang} />}
              <ChatbotDrawer caseData={caseData} lang={lang} />
            </>
          ) : (
            <EmptyState t={t} lang={lang} onPick={pickCase} status={emptyStatus} />
          )}
        </div>
        {caseData && <RightPanel caseData={caseData} lang={lang} t={t} />}
      </main>

      <TweaksPanel
        open={tweaksOpen}
        onClose={() => setTweaksOpen(false)}
        lang={lang}
        theme={theme}
        setTheme={setTheme}
        palette={palette}
        setPalette={setPalette}
        density={density}
        setDensity={setDensity}
      />
    </div>
  );
}
