// Runs every module's `export function demo()` self-check under src/ (discovered, so a new demo is
// picked up without touching this file). A demo fails by throwing. `npm test`.
// ponytail: .jsx modules are skipped — Node can't import JSX; move a demo into a .js module to run it.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = readdirSync(src, { recursive: true })
  .map((f) => path.join(src, f))
  .filter((f) => f.endsWith('.js') && /export (async )?function demo\(/.test(readFileSync(f, 'utf8')));

let failed = 0;
for (const f of files) {
  const name = path.relative(src, f);
  try {
    await (await import(pathToFileURL(f).href)).demo();
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${name}\n   ${e?.stack || e}`);
  }
}
console.log(`\n${files.length - failed}/${files.length} self-checks passed`);
if (failed || !files.length) process.exit(1);
