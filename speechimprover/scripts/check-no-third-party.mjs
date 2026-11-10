// House standard: no third-party requests. Fails if app source or shipped HTML
// points at a public CDN / font host. (Google sign-in + Drive/userinfo APIs are the
// opt-in sync feature itself; adervec.github.io is the house host.) node scripts/check-no-third-party.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  path.join(root, 'index.html'),
  // the repo-root copy of the speaking guide too
  ...readdirSync(path.join(root, '..', 'Baseline Ref')).filter((f) => f.endsWith('.html')).map((f) => path.join(root, '..', 'Baseline Ref', f)),
  ...readdirSync(path.join(root, 'public')).filter((f) => f.endsWith('.html')).map((f) => path.join(root, 'public', f)),
  ...readdirSync(path.join(root, 'src'), { recursive: true }).filter((f) => /\.(jsx?|css|html)$/.test(f)).map((f) => path.join(root, 'src', f)),
];
const BANNED = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net|cdn\.tailwindcss\.com|code\.jquery\.com/;
const hits = files.filter((f) => BANNED.test(readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
assert.deepEqual(hits, [], `third-party hosts referenced in: ${hits.join(', ')}`);
console.log(`no third-party hosts (${files.length} files)`);
