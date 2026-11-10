// What's new: public/whatsnew.json is well-formed, newest first, and declared in
// index.html via <meta name="app-whatsnew">. node scripts/check-whatsnew.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const notes = JSON.parse(readFileSync(new URL('../public/whatsnew.json', import.meta.url), 'utf8'));
assert.ok(Array.isArray(notes) && notes.length, 'non-empty array');
for (const n of notes) {
  assert.match(n.date, /^\d{4}-\d{2}-\d{2}$/, `bad date ${n.date}`);
  assert.ok(Array.isArray(n.items) && n.items.length && n.items.every((i) => typeof i === 'string' && i.trim()), `items for ${n.date}`);
}
const dates = notes.map((n) => n.date);
assert.deepEqual(dates, [...dates].sort().reverse(), 'newest first');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /<meta name="app-whatsnew" content="%BASE_URL%whatsnew\.json"/, 'meta declared');
console.log(`whatsnew ok (${notes.length} releases, latest ${dates[0]})`);
