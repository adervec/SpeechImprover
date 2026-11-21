// A "sitting": Just speak for as long as you like (an hour, with breaks). The take
// is far too long to decode and analyse at the end, so it is scored AS YOU GO: the
// live analyser's windows are grouped into chunks of speaking time, each chunk gets
// the same metrics + attribute scores a short take gets, and the sitting's result
// is the time-weighted sum of its chunks.
//
// Pure and node-testable (see demo()). The recorder feeds pushWindow()/addWords();
// views/Sitting.jsx draws it.
//
// Time: only SPEAKING time counts. Silence up to MAX_PAUSE_SEC is an ordinary pause
// and is counted (and scored as pausing); anything longer is not counted at all, so
// stopping to turn a page or drink never hurts "breath & pausing". A silence of
// breakSec or more is shown as a break. A manual pause simply stops the feed.
// ponytail: windows are sampled (~9/s) by a timer, which browsers slow down in a
// background tab — scores get coarser there. An AudioWorklet would fix it if needed.

import { createLiveAnalyzer } from './analysis/liveMetrics.js';
import { analyzeTranscript } from './analysis/speechMetrics.js';
import { scoreFromMetrics } from './analysis/index.js';
import { ATTRIBUTES, overallScore, computeDistances } from './analysis/attributes.js';

export const CHUNK_SEC = 120;
export const BREAK_SEC = 20;
const MAX_PAUSE_SEC = 3; // silence beyond this is not speaking time
const MIN_CHUNK_SEC = 20; // a shorter tail is folded into the chunk before it
const MAX_DT = 1.5; // a gap between windows longer than this is not counted (throttled tab)

// Reading a book aloud: the words are the author's, so word choice says nothing
// about the speaker. Dropping these two inputs makes their attributes unscored.
function forBook(metrics) {
  const m = { ...metrics };
  delete m.fillersPerMin;
  delete m.typeTokenRatio;
  return m;
}

const SUM_KEYS = ['wordCount', 'fillerTotal', 'pauseCount', 'stutterRepeats', 'samples', 'voicedSamples'];
const SKIP_KEYS = new Set(['history', 'fillerCounts', 'topRepeats', 'uniqueCount', 'maxContentRepeat', 'parts']);

// Combine chunk metrics: counts add up, everything else is a speaking-time-weighted mean.
export function mergeMetrics(list) {
  const total = list.reduce((a, c) => a + c.speakSec, 0) || 1;
  const out = {};
  const keys = new Set(list.flatMap((c) => Object.keys(c.metrics)));
  for (const k of keys) {
    if (SKIP_KEYS.has(k)) continue;
    const vals = list.filter((c) => typeof c.metrics[k] === 'number' && Number.isFinite(c.metrics[k]));
    if (!vals.length) continue;
    out[k] = SUM_KEYS.includes(k)
      ? vals.reduce((a, c) => a + c.metrics[k], 0)
      : vals.reduce((a, c) => a + c.metrics[k] * c.speakSec, 0) / vals.reduce((a, c) => a + c.speakSec, 0);
  }
  out.durationSec = total;
  if (out.wordCount != null) out.wpm = out.wordCount / (total / 60);
  if ('fillersPerMin' in out) out.fillersPerMin = (out.fillerTotal || 0) / (total / 60);
  return out;
}

export function createSitting({ sampleRate, profile = {}, chunkSec = CHUNK_SEC, breakSec = BREAK_SEC, book = false, resume = null } = {}) {
  const chunks = resume?.chunks ? resume.chunks.slice() : []; // closed chunks
  let breaks = resume?.breaks || 0;
  let spokenBefore = chunks.reduce((a, c) => a + c.speakSec, 0);
  let transcript = resume?.transcript || '';

  let la = createLiveAnalyzer(sampleRate);
  let cur = { speakSec: 0, words: [], recStart: resume?.recSec || 0 };
  let lastT = null;
  // Speech is judged against the speaker's RECENT level, not the loudest moment so far:
  // one cough or dropped book must not make an hour of normal speech read as silence.
  // `level` follows speech loudness (fast up, slow down) and sinks during silence, but
  // never below a quarter of the usual level, so room noise in a long break stays silence.
  let level = 0;
  let usual = 0;
  let silentFor = 0;
  let onBreak = false;
  let recSec = resume?.recSec || 0; // seconds into the audio recording (manual pauses excluded)

  function closeChunk() {
    const snap = la.snapshot();
    delete snap.history;
    const text = cur.words.join(' ');
    let metrics = { ...snap, ...analyzeTranscript(text, Math.max(1, cur.speakSec)), durationSec: cur.speakSec, recognitionConfidence: 0 };
    if (book) metrics = forBook(metrics);
    const { scores, overall } = scoreFromMetrics(metrics, profile);
    chunks.push({ i: chunks.length, recStart: Math.round(cur.recStart), speakSec: Math.round(cur.speakSec * 10) / 10, metrics, scores, overall });
    spokenBefore += cur.speakSec;
    la = createLiveAnalyzer(sampleRate);
    cur = { speakSec: 0, words: [], recStart: recSec };
  }

  return {
    win: la.win,
    book,

    // One analysis window from the mic. t = seconds on any steady clock.
    pushWindow(buffer, t) {
      const dt = lastT == null ? 0 : Math.min(MAX_DT, Math.max(0, t - lastT));
      lastT = t;
      recSec += dt;
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i];
      const rms = Math.sqrt(sum / buffer.length);
      const speech = rms > Math.max(level * 0.15, 1e-4);
      if (speech) {
        level += (rms > level ? 0.3 : 0.02) * (rms - level);
        usual += 0.002 * (level - usual);
        if (usual < level * 0.1) usual = level * 0.5; // first words: start from something sensible
      } else if (dt > 0) {
        level = Math.max(usual * 0.25, level * 0.5 ** (dt / 20));
      }
      silentFor = speech ? 0 : silentFor + dt;
      if (silentFor > MAX_PAUSE_SEC) { // not speaking time: don't count it, don't score it
        if (silentFor >= breakSec && !onBreak) { onBreak = true; breaks += 1; }
        return;
      }
      onBreak = false;
      la.pushWindow(buffer, spokenBefore + cur.speakSec);
      cur.speakSec += dt;
      if (cur.speakSec >= chunkSec) closeChunk();
    },

    // After a manual pause: don't count the gap.
    resumeClock() { lastT = null; silentFor = 0; onBreak = false; },

    // A finalised phrase from the recogniser, credited to the chunk being spoken.
    addWords(text) {
      const seg = (text || '').trim();
      if (!seg) return;
      cur.words.push(seg);
      transcript = transcript ? `${transcript} ${seg}` : seg;
    },

    // What the live screen shows.
    live() {
      const snap = la.snapshot();
      const tx = analyzeTranscript(cur.words.join(' '), Math.max(1, cur.speakSec));
      // Complete metrics even in book mode: the live panel prints every attribute's detail.
      // (Book mode only changes what is SCORED; the screen parks those two chips.)
      const metrics = { ...snap, ...tx, recognitionConfidence: 0 };
      return { metrics, wordCount: tx.wordCount, speakSec: spokenBefore + cur.speakSec, chunkSec: cur.speakSec, chunks, breaks, onBreak, recSec };
    },

    // Everything needed to pick the sitting up again after a crash (small JSON).
    checkpoint() { return { chunks, breaks, transcript, recSec, book, at: Date.now() }; },

    // Close the sitting. A short tail is folded into the last chunk's weighting.
    finish() {
      if (cur.speakSec >= MIN_CHUNK_SEC || (!chunks.length && cur.speakSec > 0)) closeChunk();
      return summarizeSitting({ chunks, breaks, transcript, book });
    },
  };
}

// Chunks -> the fields a session record needs (same shape as a short take, plus `chunks`).
export function summarizeSitting({ chunks, breaks = 0, transcript = '', book = false }) {
  if (!chunks.length) return null;
  const metrics = mergeMetrics(chunks);
  const total = metrics.durationSec;
  const scores = {};
  for (const a of ATTRIBUTES) {
    const have = chunks.filter((c) => c.scores[a.key] != null);
    const w = have.reduce((s, c) => s + c.speakSec, 0);
    scores[a.key] = w ? Math.round(have.reduce((s, c) => s + c.scores[a.key] * c.speakSec, 0) / w) : null;
  }
  // halves / thirds / quarters straight from the chunks (the "Over the take" card reads these)
  const parts = {};
  for (const n of [2, 3, 4]) {
    if (chunks.length < n) continue;
    parts[n] = Array.from({ length: n }, (_, k) => {
      const group = chunks.slice(Math.floor((chunks.length * k) / n), Math.floor((chunks.length * (k + 1)) / n));
      const m = mergeMetrics(group);
      return book ? forBook(m) : m;
    });
  }
  if (Object.keys(parts).length) metrics.parts = parts;
  // one pace mark per chunk, so the pace-over-time chart works
  let t = 0;
  const paceMarks = chunks.map((c) => { t += c.speakSec; return { t: Math.round(t), words: c.metrics.wordCount || 0, fillers: c.metrics.fillerTotal || 0 }; });
  return {
    durationSec: total,
    transcript,
    metrics,
    scores,
    overall: overallScore(scores),
    distances: computeDistances(scores),
    paceMarks,
    breaks,
    book,
    // slim per-chunk record kept on the session (the full metrics live in metrics.parts)
    chunks: chunks.map((c) => ({ i: c.i, recStart: c.recStart, speakSec: c.speakSec, overall: c.overall, scores: c.scores, wpm: Math.round(c.metrics.wpm || 0), fillers: c.metrics.fillerTotal || 0 })),
  };
}

// Something drifting over the sitting: the last two chunks against the first two.
// Returns ids the screen turns into one-line nudges (worst first, at most two).
export function driftNudges(chunks) {
  if (chunks.length < 4) return [];
  const avg = (list, f) => list.reduce((a, c) => a + f(c), 0) / list.length;
  const first = chunks.slice(0, 2);
  const last = chunks.slice(-2);
  const out = [];
  const wpm0 = avg(first, (c) => c.wpm ?? c.metrics?.wpm ?? 0);
  const wpm1 = avg(last, (c) => c.wpm ?? c.metrics?.wpm ?? 0);
  if (wpm0 > 0) {
    const d = (wpm1 - wpm0) / wpm0;
    if (d > 0.12) out.push({ id: 'paceUp', size: d * 100 });
    else if (d < -0.12) out.push({ id: 'paceDown', size: -d * 100 });
  }
  for (const [key, id] of [['projection', 'energyFading'], ['expressiveness', 'pitchFlattening'], ['clarity', 'clarityFading'], ['fillers', 'fillersRising']]) {
    const have = [...first, ...last].every((c) => c.scores[key] != null);
    if (!have) continue;
    const drop = avg(first, (c) => c.scores[key]) - avg(last, (c) => c.scores[key]);
    if (drop >= 12) out.push({ id, size: drop });
  }
  return out.sort((a, b) => b.size - a.size).slice(0, 2).map((n) => n.id);
}

// Self-check with synthetic audio: a loud varied half, a break, then a quiet flat half.
export function demo() {
  const ok = (c, m) => { if (!c) throw new Error(`sitting: ${m}`); };
  const sr = 16000;
  const run = (book) => {
    const s = createSitting({ sampleRate: sr, chunkSec: 30, book });
    const win = s.win;
    const tone = (hz, amp) => { const b = new Float32Array(win); for (let i = 0; i < win; i += 1) b[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr); return b; };
    const quiet = new Float32Array(win);
    let t = 0;
    const dt = 0.1;
    const speak = (secs, hzFn, amp, words) => {
      for (let k = 0; k < secs / dt; k += 1) {
        const syll = (k % 5) < 4; // short gaps, like syllables
        s.pushWindow(syll ? tone(hzFn(k), amp) : quiet, t); t += dt;
        if (words && k % 10 === 0) s.addWords(words);
      }
    };
    speak(60, (k) => 120 + 30 * Math.sin(k / 7), 0.3, 'the quick brown fox um jumps');
    for (let k = 0; k < 40 / dt; k += 1) { s.pushWindow(quiet, t); t += dt; } // a 40 s break
    speak(60, () => 120, 0.03, 'over the lazy dog');
    return { s, live: s.live(), result: s.finish() };
  };
  const { live, result } = run(false);
  ok(Math.abs(live.speakSec - 123) < 4, `a 40 s break counts as ~3 s of pause, not 40 (got ${live.speakSec.toFixed(1)})`);
  ok(live.breaks === 1, `one break detected (got ${live.breaks})`);
  ok(result.chunks.length === 4, `30 s chunks over ~2 min of speaking (got ${result.chunks.length})`);
  ok(result.chunks[0].scores.projection > result.chunks[3].scores.projection, 'the quiet half projects less');
  ok(result.chunks[0].scores.expressiveness > result.chunks[3].scores.expressiveness, 'the flat half is less expressive');
  ok(result.chunks[0].fillers > 0 && result.chunks[3].fillers === 0, 'fillers land in the chunk they were said in');
  ok(result.overall > 0 && result.scores.pace != null && result.distances, 'sitting scored like a take');
  ok(result.metrics.parts[2].length === 2 && result.metrics.parts[4].length === 4, 'halves and quarters built from chunks');
  ok(Math.abs(result.durationSec - 123) < 4 && result.paceMarks.length === 4, 'duration is speaking time; a pace mark per chunk');
  ok(driftNudges(result.chunks).includes('energyFading'), `fading energy is flagged (got ${driftNudges(result.chunks)})`);
  ok(result.transcript.includes('quick brown') && result.transcript.includes('lazy dog'), 'transcript kept whole');
  // a loud bang mid-way must not turn the speech after it into silence
  const s3 = createSitting({ sampleRate: sr, chunkSec: 30 });
  const mk = (amp) => { const b3 = new Float32Array(s3.win); for (let i = 0; i < s3.win; i += 1) b3[i] = amp * Math.sin((2 * Math.PI * 130 * i) / sr); return b3; };
  let t3 = 0;
  for (let k = 0; k < 200; k += 1) { s3.pushWindow(mk(0.05), t3); t3 += 0.1; }
  s3.pushWindow(mk(0.9), t3); t3 += 0.1; // the bang
  for (let k = 0; k < 400; k += 1) { s3.pushWindow(mk(0.05), t3); t3 += 0.1; }
  ok(s3.live().speakSec > 50, `speech after a loud bang still counts (got ${s3.live().speakSec.toFixed(1)} of 60 s)`);
  const b = run(true).result;
  ok(b.scores.fillers === null && b.scores.nonRepetition === null && b.scores.pace != null, 'book mode drops word-choice scores, keeps pace');
  ok(b.chunks.every((c) => c.scores.fillers === null), 'book mode applies per chunk');
  // the live panel prints every attribute's detail text: none may throw, book mode or not
  for (const bookMode of [true, false]) {
    const sl = createSitting({ sampleRate: sr, book: bookMode });
    sl.pushWindow(new Float32Array(sl.win).fill(0.1), 0);
    sl.addWords('hello there everyone');
    const m = sl.live().metrics;
    for (const a of ATTRIBUTES) ok(typeof a.detail(m) === 'string', `live detail for ${a.key}`);
  }
  // resume from a checkpoint continues the count
  const s2 = createSitting({ sampleRate: sr, chunkSec: 30, resume: { chunks: result.chunks.map((c, i) => ({ ...c, metrics: { wordCount: 10, wpm: 100 }, i })), breaks: 1, transcript: 'earlier', recSec: 200 } });
  ok(Math.abs(s2.live().speakSec - 123) < 4 && s2.live().chunks.length === 4, 'a recovered sitting keeps its chunks and time');
  return 'sitting.demo: ok';
}
