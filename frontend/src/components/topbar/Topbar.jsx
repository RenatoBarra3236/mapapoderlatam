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
        <div className="lang-toggle" role="group" aria-label={lang === 'es' ? 'Idioma' : 'Language'}>
          <button
            type="button"
            className={lang === 'es' ? 'active' : ''}
            aria-pressed={lang === 'es'}
            aria-label={lang === 'es' ? 'Español (activo)' : 'Cambiar a Español'}
            onClick={() => setLang('es')}
          >ES</button>
          <button
            type="button"
            className={lang === 'en' ? 'active' : ''}
            aria-pressed={lang === 'en'}
            aria-label={lang === 'en' ? 'English (active)' : 'Switch to English'}
            onClick={() => setLang('en')}
          >EN</button>
        </div>
        <button
          type="button"
          className="tool-btn"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={lang === 'es'
            ? (theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro')
            : (theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme')}
        >
          {theme === 'light' ? '☾' : '☀'}
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={onOpenTweaks}
          aria-label={lang === 'es' ? 'Abrir ajustes de visualización' : 'Open display settings'}
        >
          {lang === 'es' ? 'Ajustes' : 'Settings'}
        </button>
      </div>
    </header>
  );
}
