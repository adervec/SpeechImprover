// Tachyread narration watcher: count audiobook narration done in Tachyread as speech training.
//
// Tachyread's read-through recorder writes one small JSON quality log per narration session
// (`tachyread-narration-*.json`, protocol `tachyread-narration` v1) into a user-chosen folder.
// Point SpeechImprover at the same folder and every log becomes a training session here —
// streaks, the activity grid and practice-time totals all count it automatically.
//
// The mapping is import-clean (no FS access) so it's testable; folder scanning is the only
// browser-bound part. Dedupe is by importKey (the log's file name) checked against the DB at
// scan time, so re-scans and reloads never double-import. See demo() for the self-check.

import { getFsHandle, setFsHandle, getAllSessions } from './db.js';

const KEY = 'tachyreadNarrationDir';
export const NARRATION_PROTOCOL = 'tachyread-narration';
export const FS_SUPPORTED = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export async function pickNarrationDir() {
  const handle = await window.showDirectoryPicker({ id: 'speechimprover-tachyread', mode: 'read' });
  await setFsHandle(KEY, handle);
  return handle;
}
export function getNarrationDir() {
  return getFsHandle(KEY);
}
export async function forgetNarrationDir() {
  await setFsHandle(KEY, null);
}
export async function ensureReadPermission(dir, ask = false) {
  if (!dir) return false;
  const q = await (dir.queryPermission?.({ mode: 'read' }) ?? 'granted');
  if (q === 'granted') return true;
  if (!ask) return false; // silent path (app load) must not throw permission prompts around
  const r = await (dir.requestPermission?.({ mode: 'read' }) ?? 'granted');
  return r === 'granted';
}

// ---------- pure mapping (log file → session record) ----------
export function isNarrationLog(o) {
  return !!o && o.protocol === NARRATION_PROTOCOL && o.version === 1 && Array.isArray(o.takes);
}

// One log = one training session. Returns null for invalid logs, empty sessions, or dupes.
export function sessionFromLog(log, fileName, existingKeys) {
  if (!isNarrationLog(log)) return null;
  if (existingKeys?.has?.(fileName)) return null;
  const s = log.summary || {};
  const durationSec = Math.round((s.totalSpeechMs || 0) / 1000);
  if (!durationSec) return null; // a session with no speech trains nothing
  const consistency = s.consistency || null;
  return {
    importKey: fileName,
    source: 'tachyread',
    createdAt: log.createdAt || new Date().toISOString(),
    type: 'narration',
    mode: 'narration',
    exerciseId: 'tachyread-narration',
    exerciseTitle: `Audiobook narration · ${log.docName || 'book'}`,
    prompt: '',
    targetAttributes: [],
    durationSec,
    transcript: '',
    recognitionConfidence: null,
    recognitionSupported: false,
    metrics: {
      durationSec,
      paceWpm: s.avgWpm ?? null,
      narration: {
        takes: s.takes || log.takes.length,
        avgScore: s.avgScore ?? null,
        avgWpm: s.avgWpm ?? null,
        consistency,
      },
    },
    assessment: 'completion',
    completion: { completed: true, label: 'Narration' },
    scores: null,
    overall: null,
    distances: null,
    projectId: null,
    notes: `Imported from Tachyread — ${s.takes || log.takes.length} chunk${(s.takes || log.takes.length) === 1 ? '' : 's'} narrated`
      + (s.avgScore != null ? `, avg quality ${s.avgScore}/100` : '')
      + (consistency ? `, delivery ${String(consistency.label || '').toLowerCase()}` : '') + '.',
  };
}

// ---------- folder scan (browser only) ----------
// Reads every tachyread-narration-*.json in the folder, maps the new ones, and hands them to
// `addSession`. Returns { imported, seen }. Never throws on a bad file — one corrupt log must not
// block the rest.
export async function scanNarrationDir(dir, addSession) {
  const all = await getAllSessions();
  const existingKeys = new Set(all.map((s) => s.importKey).filter(Boolean));
  let imported = 0, seen = 0;
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !/^tachyread-narration-.*\.json$/.test(entry.name)) continue;
    seen++;
    try {
      const log = JSON.parse(await (await entry.getFile()).text());
      const session = sessionFromLog(log, entry.name, existingKeys);
      if (session) {
        await addSession(session);
        existingKeys.add(entry.name);
        imported++;
      }
    } catch {
      /* unreadable or half-written log — skip it, next scan may catch it */
    }
  }
  return { imported, seen };
}

// Silent auto-scan for app load: only runs when a folder is linked AND permission persists.
export async function autoScanNarrations(addSession) {
  try {
    const dir = await getNarrationDir();
    if (!dir || !(await ensureReadPermission(dir, false))) return null;
    return await scanNarrationDir(dir, addSession);
  } catch {
    return null;
  }
}

// ---------- runnable self-check: node -e "import('./src/lib/narrationWatch.js').then(m=>m.demo())" ----------
export function demo() {
  const assert = (c, msg) => { if (!c) throw new Error(`demo failed: ${msg}`); };
  const log = {
    app: 'tachyread', protocol: NARRATION_PROTOCOL, version: 1,
    createdAt: '2026-08-08T10:00:00.000Z', docName: 'Moby.epub',
    takes: [{ score: 88, wpm: 150, speechMs: 60000 }, { score: 76, wpm: 160, speechMs: 30000 }],
    summary: { takes: 2, totalSpeechMs: 90000, avgWpm: 155, avgScore: 82, consistency: { label: 'Steady', score: 80 } },
  };
  const s = sessionFromLog(log, 'tachyread-narration-x.json', new Set());
  assert(s && s.durationSec === 90, 'duration from speech time');
  assert(s.mode === 'narration' && s.source === 'tachyread', 'identity fields');
  assert(s.metrics.durationSec === 90 && s.metrics.paceWpm === 155, 'metrics for aggregates');
  assert(s.assessment === 'completion' && s.completion.completed, 'counts as completed training');
  assert(/avg quality 82/.test(s.notes) && /steady/.test(s.notes), 'human note');
  assert(sessionFromLog(log, 'tachyread-narration-x.json', new Set(['tachyread-narration-x.json'])) === null, 'dedupe by importKey');
  assert(sessionFromLog({ ...log, protocol: 'other' }, 'f.json', new Set()) === null, 'foreign files rejected');
  assert(sessionFromLog({ ...log, version: 2 }, 'f.json', new Set()) === null, 'future versions rejected');
  assert(sessionFromLog({ ...log, summary: { totalSpeechMs: 0 } }, 'f.json', new Set()) === null, 'empty sessions rejected');
  console.log('narrationWatch demo: all cases pass');
  return true;
}
