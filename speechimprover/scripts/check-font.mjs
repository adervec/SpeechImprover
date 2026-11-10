// House-font wiring self-check (offline: font.js itself is stubbed — it lives at
// adervec.github.io and sets --app-font on <html>). node scripts/check-font.mjs
// ponytail: static + stub check; the real computed-font check is adervec.github.io/font-selftest.html.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const fontAt = html.indexOf('<script src="https://adervec.github.io/font.js"></script>');
assert.ok(fontAt > 0 && fontAt < html.indexOf('</head>'), 'font.js loads in <head>, not deferred');
assert.ok(fontAt < html.indexOf('/src/main.jsx'), 'font.js runs before the app styles');
const body = css.match(/body\s*\{[^}]*font-family:\s*([^;]+);/)[1];
assert.equal(body.trim(), 'var(--app-font, var(--sans))');
assert.match(readFileSync(new URL('../src/views/Settings.jsx', import.meta.url), 'utf8'), /<app-font-picker/);

// Resolve the body font the way the browser would, with font.js stubbed in or absent.
const sans = css.match(/--sans:\s*([^;]+);/)[1].trim();
const resolve = (vars) => (vars['--app-font'] ?? sans);
assert.ok(resolve({ '--app-font': '"Atkinson Hyperlegible", system-ui, sans-serif' }).startsWith('"Atkinson Hyperlegible"'), 'default = Atkinson');
assert.ok(resolve({ '--app-font': 'Georgia, serif' }).startsWith('Georgia'), 'picker change carries through');
assert.equal(resolve({}), sans, 'no font.js (offline) → old stack');
console.log('font checks ok');
