// House i18n (standard 20): the app is written in English and the English text IS
// the key. font.js loads the reader's language (picked under the font picker,
// shared by every app) and does the lookup; main.jsx waits for it before the
// first render, and a language change reloads the page. Translations live in
// public/locales/<lang>.json, made with ../CoworkSyncHub/i18n.mjs (machine
// translated, and the app says so).
//
//   t(<English with {placeholders}>, { n })    plain text
//   t.n(<one form>, <other form>, count)       plurals in each language's own rules
// (examples kept out of call syntax: the extractor scans comments too)
//
// Only write literal strings inside t(...) so the extractor can find them;
// never build a sentence by concatenating translated pieces.

const interp = (s, p) => (p ? String(s).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(p, k) ? String(p[k]) : m)) : String(s));

export function t(key, params) {
  return globalThis.window?.appFont?.t ? window.appFont.t(key, params) : interp(key, params);
}
t.n = (one, other, n, params) => (globalThis.window?.appFont?.t?.n
  ? window.appFont.t.n(one, other, n, params)
  : interp(n === 1 ? one : other, { n, ...params }));

// The shared formatting locale (the reader's language + region), for Intl.
export const locale = () => globalThis.window?.appFont?.locale?.() || undefined;

export function demo() {
  const ok = (c, m) => { if (!c) throw new Error(`i18n: ${m}`); };
  const tt = t; // a different name so the string extractor doesn't collect test text
  ok(tt('Saved {n} takes', { n: 3 }) === 'Saved 3 takes', 'English passes through with params');
  ok(tt.n('{n} take', '{n} takes', 1) === '1 take' && tt.n('{n} take', '{n} takes', 2) === '2 takes', 'plural fallback');
  ok(tt('Keep {missing}') === 'Keep {missing}', 'unknown placeholder left visible');
  return 'i18n.demo: ok';
}
