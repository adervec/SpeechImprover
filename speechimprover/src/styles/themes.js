// House standard 24: one theme list for every app. The list, the palettes and the
// reader's choice live in font.js (appFont.themes / theme() / setTheme(), and
// <app-theme-picker> in Settings); index.css maps the palette's --t-* variables
// onto this app's own (--bg, --surface, --accent, …). This file only carries the
// one-time move from SpeechImprover's old private themes to the house list.

// Old theme -> nearest house theme. Aurora and Paper were the automatic defaults
// (dark / light device), so they become 'system': the device decides again.
export const LEGACY_TO_HOUSE = {
  aurora: 'system',
  paper: 'system',
  midnight: 'midnight',
  ember: 'ember',
  forest: 'forest',
  mono: 'mono',
  nord: 'slate',
  dracula: 'midnight',
  synthwave: 'synthwave',
  rosepine: 'midnight',
  gruvbox: 'gold',
  oceanic: 'ocean',
  solarizedDark: 'slate',
  solarizedLight: 'paper',
  sepia: 'paper',
  contrast: 'contrast',
};

// Apply a reader's old saved theme to the house picker, once. Never overrides a
// choice already made in the house picker (a saved choice always wins).
// Returns the house id applied, or null when nothing changed.
export function migrateLegacyTheme(oldKey, appFont = globalThis.window?.appFont) {
  if (!oldKey || !appFont?.setTheme) return null;
  if (appFont.theme?.() && appFont.theme() !== 'system') return null;
  const id = LEGACY_TO_HOUSE[oldKey] || 'system';
  if (id !== 'system') appFont.setTheme(id);
  return id;
}

export function demo() {
  const ok = (c, m) => { if (!c) throw new Error(`themes: ${m}`); };
  const fake = (choice = 'system') => ({ chosen: choice, theme() { return this.chosen; }, setTheme(id) { this.chosen = id; } });
  let f = fake();
  ok(migrateLegacyTheme('gruvbox', f) === 'gold' && f.chosen === 'gold', 'old theme maps to the nearest house theme');
  f = fake();
  ok(migrateLegacyTheme('aurora', f) === 'system' && f.chosen === 'system', 'the old automatic default follows the device');
  f = fake('ocean');
  ok(migrateLegacyTheme('ember', f) === null && f.chosen === 'ocean', 'a house choice already made always wins');
  ok(migrateLegacyTheme('ember', undefined) === null, 'no font.js (offline): nothing happens');
  ok(migrateLegacyTheme('who-knows', fake()) === 'system', 'unknown old theme → System');
  const HOUSE = ['system', 'light', 'dark', 'midnight', 'slate', 'ocean', 'forest', 'ember', 'gold', 'synthwave', 'terminal', 'paper', 'pastel', 'mono', 'contrast'];
  ok(Object.values(LEGACY_TO_HOUSE).every((id) => HOUSE.includes(id)), 'every target is on the house list');
  return 'themes.demo: ok';
}
