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
import { DEMO_CASES } from '../lib/demoData';

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
  const [caseId, setCaseId] = useState(null);
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

  const t = I18N[lang];
  const caseData = caseId ? DEMO_CASES[caseId] : null;

  return (
    <div className="app">
      <Topbar
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        t={t}
        onPickCase={setCaseId}
        onOpenTweaks={() => setTweaksOpen(v => !v)}
      />
      <main className={`main ${caseData ? '' : 'empty-mode'}`}>
        <div className="canvas-col">
          {caseData ? (
            <>
              <CanvasTabs view={view} setView={setView} lang={lang} caseData={caseData} />
              {view === 'neural' && <NeuralView caseData={caseData} lang={lang} />}
              {view === 'orbit' && <OrbitView caseData={caseData} lang={lang} />}
              {view === 'timeline' && <TimelineView caseData={caseData} />}
              {view === 'table' && <TableView caseData={caseData} lang={lang} />}
              <ChatbotDrawer caseData={caseData} lang={lang} />
            </>
          ) : (
            <EmptyState t={t} lang={lang} onPick={setCaseId} />
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
