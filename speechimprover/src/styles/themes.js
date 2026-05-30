// Multiple modern themes. Each theme is a set of CSS custom properties applied
// to :root by useTheme. Add a theme here and it appears in the Settings picker.

export const THEMES = {
  aurora: {
    label: 'Aurora',
    swatch: ['#6d5efc', '#22d3ee'],
    vars: {
      '--bg': '#0e1018',
      '--bg-2': '#151826',
      '--surface': '#1a1e30',
      '--surface-2': '#222740',
      '--border': '#2c3350',
      '--text': '#e8eaf2',
      '--text-dim': '#9aa3c0',
      '--accent': '#7c6cff',
      '--accent-2': '#22d3ee',
      '--accent-contrast': '#ffffff',
      '--good': '#34d399',
      '--warn': '#fbbf24',
      '--bad': '#fb7185',
      '--rec': '#ff3b5c',
      '--shadow': '0 10px 40px rgba(0,0,0,.45)',
    },
  },
  midnight: {
    label: 'Midnight Ink',
    swatch: ['#3b82f6', '#0ea5e9'],
    vars: {
      '--bg': '#0b0f1a',
      '--bg-2': '#101626',
      '--surface': '#141b2e',
      '--surface-2': '#1c2740',
      '--border': '#243150',
      '--text': '#e6edf7',
      '--text-dim': '#8ca0c0',
      '--accent': '#3b82f6',
      '--accent-2': '#0ea5e9',
      '--accent-contrast': '#ffffff',
      '--good': '#22c55e',
      '--warn': '#f59e0b',
      '--bad': '#ef4444',
      '--rec': '#f43f5e',
      '--shadow': '0 10px 40px rgba(0,0,0,.5)',
    },
  },
  ember: {
    label: 'Ember',
    swatch: ['#fb7185', '#f59e0b'],
    vars: {
      '--bg': '#160f12',
      '--bg-2': '#1f1418',
      '--surface': '#241519',
      '--surface-2': '#311b21',
      '--border': '#43262e',
      '--text': '#f6e9ea',
      '--text-dim': '#c79ba0',
      '--accent': '#fb7185',
      '--accent-2': '#f59e0b',
      '--accent-contrast': '#1a0d10',
      '--good': '#4ade80',
      '--warn': '#fbbf24',
      '--bad': '#f87171',
      '--rec': '#ff2d55',
      '--shadow': '0 10px 40px rgba(0,0,0,.5)',
    },
  },
  forest: {
    label: 'Deep Forest',
    swatch: ['#34d399', '#a3e635'],
    vars: {
      '--bg': '#0c130f',
      '--bg-2': '#101a14',
      '--surface': '#13201a',
      '--surface-2': '#1a2c22',
      '--border': '#244234',
      '--text': '#e8f3ec',
      '--text-dim': '#93b3a2',
      '--accent': '#34d399',
      '--accent-2': '#a3e635',
      '--accent-contrast': '#08120c',
      '--good': '#4ade80',
      '--warn': '#facc15',
      '--bad': '#fb7185',
      '--rec': '#ff4d6d',
      '--shadow': '0 10px 40px rgba(0,0,0,.5)',
    },
  },
  paper: {
    label: 'Paper (light)',
    swatch: ['#2e6db4', '#c0612f'],
    vars: {
      '--bg': '#f3efe7',
      '--bg-2': '#ece6da',
      '--surface': '#fffdf9',
      '--surface-2': '#f6f1e8',
      '--border': '#dcd4c4',
      '--text': '#1f2937',
      '--text-dim': '#6b7280',
      '--accent': '#2e6db4',
      '--accent-2': '#c0612f',
      '--accent-contrast': '#ffffff',
      '--good': '#15803d',
      '--warn': '#b45309',
      '--bad': '#b91c1c',
      '--rec': '#dc2626',
      '--shadow': '0 8px 28px rgba(31,58,95,.12)',
    },
  },
  mono: {
    label: 'Mono Slate (light)',
    swatch: ['#111827', '#6366f1'],
    vars: {
      '--bg': '#eef1f5',
      '--bg-2': '#e3e8ef',
      '--surface': '#ffffff',
      '--surface-2': '#f1f4f9',
      '--border': '#d3dae4',
      '--text': '#0f172a',
      '--text-dim': '#64748b',
      '--accent': '#4f46e5',
      '--accent-2': '#0ea5e9',
      '--accent-contrast': '#ffffff',
      '--good': '#059669',
      '--warn': '#d97706',
      '--bad': '#dc2626',
      '--rec': '#e11d48',
      '--shadow': '0 8px 28px rgba(15,23,42,.10)',
    },
  },
};

export const THEME_KEYS = Object.keys(THEMES);

export function applyTheme(key) {
  const theme = THEMES[key] || THEMES.aurora;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
  }
  root.setAttribute('data-theme', key);
}
