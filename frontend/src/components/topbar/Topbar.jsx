import React from 'react';
import SearchBar from './SearchBar';

export default function Topbar({ lang, setLang, theme, setTheme, t, onPickCase, onOpenTweaks }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><span className="dot" /></div>
        <div className="brand-text">
          {t.appName}<em>LATAM</em>
        </div>
      </div>

      <SearchBar t={t} lang={lang} onPick={onPickCase} />

      <div className="topbar-tools">
        <div className="lang-toggle">
          <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
        <button
          className="tool-btn"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label="toggle theme"
        >
          {theme === 'light' ? '☾' : '☀'}
        </button>
        <button
          className="tool-btn"
          onClick={onOpenTweaks}
          aria-label="Open tweaks"
        >
          {lang === 'es' ? 'Tweaks' : 'Tweaks'}
        </button>
      </div>
    </header>
  );
}
