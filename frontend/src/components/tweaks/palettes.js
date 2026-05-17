// 4 graph color palettes. Each entry overrides --c-person / --c-company /
// --c-contract / --c-alert / --c-warn on :root.

export const PALETTES = {
  editorial: {
    label: 'Editorial',
    light: { person: '#534AB7', company: '#0F6E56', contract: '#993C1D', alert: '#A32D2D', warn: '#B8861B' },
    dark:  { person: '#8C84E2', company: '#4FB18F', contract: '#D27151', alert: '#E26F6F', warn: '#E5B86B' }
  },
  oceanica: {
    label: 'Oceánica',
    light: { person: '#1F5FA8', company: '#0E7C7B', contract: '#8C4A2F', alert: '#A82E4A', warn: '#9C7A1A' },
    dark:  { person: '#7CA8E0', company: '#52B6B0', contract: '#D08868', alert: '#E26B82', warn: '#DDB75A' }
  },
  ember: {
    label: 'Ember',
    light: { person: '#5B2E83', company: '#7A3517', contract: '#A03A12', alert: '#8C1F1F', warn: '#A65E0F' },
    dark:  { person: '#B086D8', company: '#D38A6A', contract: '#E58A56', alert: '#E26F6F', warn: '#E89A4A' }
  },
  graphite: {
    label: 'Graphite',
    light: { person: '#3A3A3A', company: '#525252', contract: '#993C1D', alert: '#A32D2D', warn: '#7A6A4A' },
    dark:  { person: '#B8B8B8', company: '#9A9A9A', contract: '#D27151', alert: '#E26F6F', warn: '#C9B080' }
  }
};

export const DENSITIES = [
  { value: 'compact', label: 'Compacto', enLabel: 'Compact' },
  { value: 'regular', label: 'Regular', enLabel: 'Regular' },
  { value: 'spacious', label: 'Amplio', enLabel: 'Spacious' }
];

export function applyPalette(paletteId, theme) {
  const p = PALETTES[paletteId];
  if (!p) return;
  const colors = theme === 'dark' ? p.dark : p.light;
  const root = document.documentElement;
  root.style.setProperty('--c-person', colors.person);
  root.style.setProperty('--c-company', colors.company);
  root.style.setProperty('--c-contract', colors.contract);
  root.style.setProperty('--c-alert', colors.alert);
  root.style.setProperty('--c-warn', colors.warn);
}
