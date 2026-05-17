import React, { useEffect, useRef } from 'react';
import { PALETTES, DENSITIES } from './palettes';

export default function TweaksPanel({
  open, onClose, lang,
  theme, setTheme,
  palette, setPalette,
  density, setDensity
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  if (!open) return null;

  const labels = lang === 'es'
    ? { theme: 'Tema', light: 'Claro', dark: 'Oscuro', palette: 'Paleta', density: 'Densidad', title: 'Tweaks' }
    : { theme: 'Theme', light: 'Light', dark: 'Dark', palette: 'Palette', density: 'Density', title: 'Tweaks' };

  return (
    <div ref={ref} className="tweaks-panel slide-up">
      <div className="tweaks-head">
        <span>{labels.title}</span>
        <button className="tweaks-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="tweaks-section">
        <div className="tweaks-label">{labels.theme}</div>
        <div className="tweaks-segmented">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>{labels.light}</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>{labels.dark}</button>
        </div>
      </div>

      <div className="tweaks-section">
        <div className="tweaks-label">{labels.palette}</div>
        <div className="tweaks-palettes">
          {Object.entries(PALETTES).map(([id, p]) => {
            const colors = theme === 'dark' ? p.dark : p.light;
            const isOn = palette === id;
            return (
              <button
                key={id}
                className={`tweaks-palette-chip ${isOn ? 'active' : ''}`}
                onClick={() => setPalette(id)}
                title={p.label}
              >
                <div className="tweaks-palette-swatches">
                  <span style={{ background: colors.person }} />
                  <span style={{ background: colors.company }} />
                  <span style={{ background: colors.contract }} />
                  <span style={{ background: colors.alert }} />
                </div>
                <span className="tweaks-palette-name">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="tweaks-section">
        <div className="tweaks-label">{labels.density}</div>
        <div className="tweaks-segmented">
          {DENSITIES.map(d => (
            <button
              key={d.value}
              className={density === d.value ? 'active' : ''}
              onClick={() => setDensity(d.value)}
            >
              {lang === 'es' ? d.label : d.enLabel}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
