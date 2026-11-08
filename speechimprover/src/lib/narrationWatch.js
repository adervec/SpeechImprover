// Tachyread watcher: speech done in Tachyread counts as training here.
//
// Tachyread writes small JSON logs into its folder's speech/ subfolder (no audio, no text):
//   • `tachyread-narration-*.json` (protocol `tachyread-narration` v1) — one per audiobook narration
//     session from its read-through recorder → a completion-only session (pace, quality, steadiness).
//   • `tachyread-speaking-*.json` (protocol `tachyread-speaking` v1) — one per "advance by reading
//     aloud" session → a SCORED session: Tachyread's live voice scores share this app's attribute
//     keys; pace and filler economy are rescored here from the words read and fillers heard, so
//     every session sits on one scale. Face-camera "presenting" scores (eye contact, head
//     steadiness, expressiveness, articulation) ride along under metrics.presenting.
// Point SpeechImprover at that folder and every log becomes a session — streaks, the activity grid,
// trends and practice-time totals all count it automatically.
//
// The mapping is import-clean (no FS access) so it's testable; folder scanning is the only
// browser-bound part. Dedupe is by importKey (the log's file name) checked against the DB at
// scan time, so re-scans and reloads never double-import. See demo() for the self-check.

import { getFsHandle, setFsHandle, getAllSessions } from './db.js';
import { ATTRIBUTE_MAP, overallScore, computeDistances } from './analysis/attributes.js';

const KEY = 'tachyreadNarrationDir';
export const NARRATION_PROTOCOL = 'tachyread-narration';
export const SPEAKING_PROTOCOL = 'tachyread-speaking';
export const LOG_FILE = /^tachyread-(narration|speaking)-.*\.json$/;
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

export function isSpeakingLog(o) {
  return !!o && o.protocol === SPEAKING_PROTOCOL && o.version === 1 && !!o.session && typeof o.session === 'object';
}

// One log = one session. Returns null for invalid logs, empty sessions, or dupes.
export function sessionFromLog(log, fileName, existingKeys) {
  if (isSpeakingLog(log)) return sessionFromSpeakingLog(log, fileName, existingKeys);
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

// A reading-aloud session → a scored session. `log.session` is Tachyread's compact record
// (its `fields` object in the log explains every key): words advanced, exact/near/skipped, mean
// match quality `q`, fillers `f`, per-minute trend `m`, `voice` {overall, scores} from its live
// voice feedback (same attribute keys as ours, absent when that was off) and `face` presenting
// scores from the camera (absent when off).
export function sessionFromSpeakingLog(log, fileName, existingKeys) {
  if (!isSpeakingLog(log)) return null;
  if (existingKeys?.has?.(fileName)) return null;
  const s = log.session;
  const durationSec = Math.round(Math.max(0, (Number(s.end) || 0) - (Number(s.at) || 0)) / 1000);
  const words = Number(s.words) || 0;
  if (!durationSec || !words) return null; // nothing read aloud trains nothing
  const minutes = durationSec / 60;
  const wpm = words / minutes;
  const fillersPerMin = (Number(s.f) || 0) / minutes;
  const metrics = {
    durationSec, wpm, paceWpm: Math.round(wpm), fillersPerMin, fillerTotal: Number(s.f) || 0,
    wordsRead: words, matchQuality: s.q ?? null, exact: s.exact || 0, near: s.near || 0, skipped: s.skip || 0, misses: s.misses || 0,
    strictness: s.strict ?? null, perMinute: Array.isArray(s.m) ? s.m : [],
    presenting: s.face && typeof s.face === 'object' ? s.face : null,
  };
  const scores = { ...(s.voice?.scores || {}) };
  for (const k of Object.keys(scores)) if (!ATTRIBUTE_MAP[k] || typeof scores[k] !== 'number') delete scores[k];
  scores.pace = Math.round(ATTRIBUTE_MAP.pace.score(metrics));
  scores.fillers = Math.round(ATTRIBUTE_MAP.fillers.score(metrics));
  const doc = log.docName || s.name || 'document';
  const p = metrics.presenting;
  return {
    importKey: fileName,
    source: 'tachyread',
    createdAt: new Date(Number(s.at) || Date.parse(log.createdAt) || Date.now()).toISOString(),
    type: 'reading',
    mode: 'read',
    exerciseId: 'tachyread-reading-aloud',
    exerciseTitle: `Reading aloud · ${doc}`,
    prompt: '',
    targetAttributes: [],
    durationSec,
    transcript: '',
    recognitionConfidence: null,
    recognitionSupported: true,
    metrics,
    assessment: 'full',
    completion: null,
    scores,
    overall: overallScore(scores),
    distances: computeDistances(scores),
    projectId: null,
    notes: `Imported from Tachyread — ${words} words read aloud in ${minutes < 1 ? `${durationSec} s` : `${Math.round(minutes)} min`} at ${Math.round(wpm)} wpm`
      + (s.q != null ? `, ${s.q}/100 match to the text` : '')
      + (metrics.fillerTotal ? `, ${metrics.fillerTotal} filler${metrics.fillerTotal === 1 ? '' : 's'}` : '')
      + (p ? `; presenting ${p.overall ?? '—'}/100 (eye contact ${p.eyeContact ?? '—'}, steadiness ${p.headSteadiness ?? '—'}${p.expressiveness != null ? `, expressiveness ${p.expressiveness}` : ''}${p.articulation != null ? `, articulation ${p.articulation}` : ''})` : '')
      + (s.voice ? '' : '; no live voice scores (Tachyread’s live voice feedback was off)') + '.',
  };
}

// ---------- folder scan (browser only) ----------
// Reads every tachyread-narration-*.json and tachyread-speaking-*.json in the folder, maps the new
// ones, and hands them to `addSession`. Returns { imported, seen }. Never throws on a bad file —
// one corrupt log must not block the rest.
export async function scanNarrationDir(dir, addSession) {
  const all = await getAllSessions();
  const existingKeys = new Set(all.map((s) => s.importKey).filter(Boolean));
  let imported = 0, seen = 0;
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !LOG_FILE.test(entry.name)) continue;
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

  // Reading aloud: a scored session on this app's scale.
  const sp = {
    app: 'tachyread', protocol: SPEAKING_PROTOCOL, version: 1, createdAt: '2026-11-08T10:05:00.000Z', docName: 'Dune.epub',
    session: { v: 1, at: Date.UTC(2026, 10, 8, 10, 0, 0), end: Date.UTC(2026, 10, 8, 10, 5, 0), name: 'Dune.epub', words: 650, exact: 600, near: 40, skip: 10, q: 91, f: 3, misses: 1, strict: 3,
      voice: { overall: 70, scores: { clarity: 66, resonantDepth: 72, expressiveness: 55, nonNasal: 80, noUptalk: 85, projection: 64, breath: 70, pace: 10, bogus: 5 } },
      face: { presence: 98, eyeContact: 88, headSteadiness: 72, expressiveness: 41, articulation: 63, overall: 66, frames: 1200 },
      m: [[0, 130, 92, 70, 1], [1, 128, 90, 71, 0]] },
  };
  const r = sessionFromLog(sp, 'tachyread-speaking-x.json', new Set());
  assert(r && r.assessment === 'full' && r.type === 'reading' && r.mode === 'read', 'a scored reading session');
  assert(r.durationSec === 300 && r.metrics.paceWpm === 130 && r.metrics.wordsRead === 650, 'duration / pace from words and time');
  assert(r.scores.pace === 100 && r.scores.clarity === 66 && !('bogus' in r.scores), 'pace rescored here (130 wpm = in band); unknown keys dropped');
  assert(r.scores.fillers > 90, `3 fillers in 5 min ≈ excellent filler economy (${r.scores.fillers})`);
  assert(r.overall > 0 && r.distances && typeof r.distances.alignment === 'number', 'overall + alignment computed');
  assert(r.metrics.presenting.eyeContact === 88 && /eye contact 88/.test(r.notes), 'presenting scores kept and summarised');
  assert(r.createdAt === '2026-11-08T10:00:00.000Z', 'dated at the session start');
  assert(r.exerciseTitle === 'Reading aloud · Dune.epub', 'titled after the document');
  assert(LOG_FILE.test('tachyread-speaking-x.json') && LOG_FILE.test('tachyread-narration-x.json') && !LOG_FILE.test('other.json'), 'both log kinds are scanned');
  const noVoice = sessionFromLog({ ...sp, session: { ...sp.session, voice: null, face: null } }, 'f2.json', new Set());
  assert(Object.keys(noVoice.scores).sort().join() === 'fillers,pace' && /live voice feedback was off/.test(noVoice.notes), 'no voice scores → pace and fillers only, said so');
  assert(sessionFromLog(sp, 'tachyread-speaking-x.json', new Set(['tachyread-speaking-x.json'])) === null, 'dedupe by importKey');
  assert(sessionFromLog({ ...sp, session: { ...sp.session, words: 0 } }, 'f3.json', new Set()) === null, 'nothing read → nothing imported');
  assert(sessionFromLog({ ...sp, version: 2 }, 'f4.json', new Set()) === null, 'future versions rejected');
  console.log('narrationWatch demo: all cases pass');
  return true;
}
