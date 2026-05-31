// "Improved version of your voice" — resynthesizes the user's OWN recording with
// DSP corrections targeted at the weaknesses the analysis measured, so they can
// A/B the original against a cleaned-up, better-paced, better-projected version.
//
// This is honest enhancement of the real audio (EQ, dynamics, silence editing,
// pitch-preserving time-stretch) — not a different/synthetic voice. Everything
// runs locally in the browser via the Web Audio API + plain DSP.
//
// The pure DSP helpers (resampleLinear, tightenSilences, wsola, encodeWav,
// buildPlan) take/return Float32Array and are unit-testable outside the browser;
// renderChain / enhanceBuffer need Web Audio (OfflineAudioContext).

import { decodeBlob } from './analysis/audioAnalysis.js';

const PROC_SR = 22050; // speech-quality working/output rate (small, fast, clear enough)

// ---------- pure helpers ----------
function toMono(audioBuffer) {
  const ch = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < ch; c += 1) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < len; i += 1) out[i] += data[i] / ch;
  }
  return out;
}

export function resampleLinear(x, fromSr, toSr) {
  if (fromSr === toSr) return x.slice();
  const ratio = toSr / fromSr;
  const outLen = Math.max(1, Math.round(x.length * ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const src = i / ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(x.length - 1, i0 + 1);
    const frac = src - i0;
    out[i] = x[i0] * (1 - frac) + x[i1] * frac;
  }
  return out;
}

function hann(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i += 1) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

export function normalizePeak(arr, target = 0.85) {
  let peak = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const a = Math.abs(arr[i]);
    if (a > peak) peak = a;
  }
  if (peak > 1e-5) {
    const g = target / peak;
    for (let i = 0; i < arr.length; i += 1) arr[i] *= g;
  }
  return arr;
}

// Trim leading/trailing near-silence, leaving a short natural pad.
export function trimEnds(x, sr) {
  const gate = peakGate(x);
  const pad = Math.round(sr * 0.08);
  let start = 0;
  while (start < x.length && Math.abs(x[start]) < gate) start += 1;
  let end = x.length - 1;
  while (end > start && Math.abs(x[end]) < gate) end -= 1;
  start = Math.max(0, start - pad);
  end = Math.min(x.length - 1, end + pad);
  if (end <= start) return { samples: x.slice(), removedSec: 0 };
  const removedSec = (x.length - (end - start + 1)) / sr;
  return { samples: x.slice(start, end + 1), removedSec };
}

function peakGate(x) {
  let peak = 1e-6;
  for (let i = 0; i < x.length; i += 1) {
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
  }
  return Math.max(peak * 0.04, 0.004);
}

// Trim lead/tail silence and cap over-long internal pauses to maxPauseSec, so the
// delivery feels purposeful rather than hesitant. Returns rebuilt samples.
export function tightenSilences(x, sr, { maxPauseSec = 0.5, frameMs = 20 } = {}) {
  const N = x.length;
  if (N < sr * 0.2) return { samples: x.slice(), removedSec: 0, longPauses: 0 };
  const frame = Math.max(1, Math.round((sr * frameMs) / 1000));
  const gate = peakGate(x);

  // frame energy → speech/silence flags
  const flags = [];
  for (let s = 0; s < N; s += frame) {
    let sum = 0;
    const end = Math.min(N, s + frame);
    for (let i = s; i < end; i += 1) sum += x[i] * x[i];
    const rms = Math.sqrt(sum / (end - s));
    flags.push(rms > gate);
  }

  // runs of silence
  const maxPauseFrames = Math.max(1, Math.round((maxPauseSec * 1000) / frameMs));
  const padFrames = Math.max(1, Math.round(80 / frameMs));
  const keep = new Array(flags.length).fill(true);
  let i = 0;
  let longPauses = 0;
  while (i < flags.length) {
    if (flags[i]) { i += 1; continue; }
    let j = i;
    while (j < flags.length && !flags[j]) j += 1; // silence run [i, j)
    const runLen = j - i;
    const leadingOrTrailing = i === 0 || j === flags.length;
    const allowed = leadingOrTrailing ? padFrames : Math.min(runLen, maxPauseFrames);
    if (runLen > allowed) {
      // keep `allowed` frames centered-ish (front pad), drop the rest
      const dropFrom = i + allowed;
      for (let k = dropFrom; k < j; k += 1) keep[k] = false;
      if (!leadingOrTrailing && runLen - allowed > 1) longPauses += 1;
    }
    i = j;
  }

  // rebuild samples from kept frames, with tiny ramps at joins to avoid clicks
  const out = new Float32Array(N);
  let w = 0;
  const ramp = Math.min(frame, Math.round(sr * 0.004));
  let prevKept = true;
  for (let f = 0; f < flags.length; f += 1) {
    if (!keep[f]) { prevKept = false; continue; }
    const s = f * frame;
    const end = Math.min(N, s + frame);
    for (let k = s; k < end; k += 1) {
      let v = x[k];
      if (!prevKept && k - s < ramp) v *= (k - s) / ramp; // fade in after a cut
      out[w++] = v;
    }
    prevKept = true;
  }
  const samples = out.subarray(0, w);
  return { samples, removedSec: (N - w) / sr, longPauses };
}

// WSOLA time-stretch (pitch-preserving). alpha = output/input length:
//   alpha > 1 slows down (more time), alpha < 1 speeds up.
export function wsola(x, alpha, sr) {
  const N = x.length;
  if (N < sr * 0.1 || Math.abs(alpha - 1) < 0.02) return x.slice();
  const Wf = Math.round(sr * 0.046);
  const Ss = Math.round(Wf / 2);
  const Sa = Math.max(1, Math.round(Ss / alpha));
  const Delta = Math.round(sr * 0.010);
  const w = hann(Wf);
  const outLen = Math.ceil(N * alpha) + Wf;
  const out = new Float32Array(outLen);
  const wsum = new Float32Array(outLen);

  let synPos = 0;
  let template = null;
  for (let m = 0; ; m += 1) {
    const target = m * Sa;
    if (target + Wf >= N) break;
    let inStart = target;
    if (template) {
      let best = -Infinity;
      let bestK = 0;
      for (let k = -Delta; k <= Delta; k += 1) {
        const s = target + k;
        if (s < 0 || s + Wf >= N) continue;
        let dot = 0;
        for (let t = 0; t < Wf; t += 2) dot += x[s + t] * template[t]; // step 2 for speed
        if (dot > best) { best = dot; bestK = k; }
      }
      inStart = target + bestK;
    }
    for (let t = 0; t < Wf; t += 1) {
      const o = synPos + t;
      if (o >= outLen) break;
      out[o] += x[inStart + t] * w[t];
      wsum[o] += w[t];
    }
    const tStart = inStart + Ss;
    template = new Float32Array(Wf);
    for (let t = 0; t < Wf; t += 1) {
      const idx = tStart + t;
      template[t] = idx < N ? x[idx] : 0;
    }
    synPos += Ss;
    if (synPos + Wf >= outLen) break;
  }
  for (let o = 0; o < outLen; o += 1) if (wsum[o] > 1e-6) out[o] /= wsum[o];
  let end = outLen;
  while (end > 0 && wsum[end - 1] <= 1e-6) end -= 1;
  return out.slice(0, end);
}

// 16-bit PCM mono WAV blob from a Float32Array.
export function encodeWav(float32, sr) {
  const len = float32.length;
  const buffer = new ArrayBuffer(44 + len * 2);
  const view = new DataView(buffer);
  const writeStr = (o, s) => { for (let i = 0; i < s.length; i += 1) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + len * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, len * 2, true);
  let off = 44;
  for (let i = 0; i < len; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

// Decide which corrections to apply from the session's metrics + scores.
export function buildPlan(metrics = {}, scores = {}) {
  const wpm = metrics.wpm || 0;
  const plan = {
    tightenPauses: true,
    compress: true, // steady projection is almost always an improvement
    presence: false,
    deNasal: false,
    warmth: false,
    stretch: false,
    stretchAlpha: 1,
    paceNote: '',
  };
  if (wpm > 0) {
    let target = 0;
    if (wpm > 158) target = 145;
    else if (wpm < 100) target = 118;
    if (target) {
      let alpha = wpm / target; // >1 → lengthen (slow down)
      alpha = Math.max(0.82, Math.min(1.22, alpha));
      if (Math.abs(alpha - 1) > 0.03) {
        plan.stretch = true;
        plan.stretchAlpha = alpha;
        plan.paceNote = `Re-timed from ~${Math.round(wpm)} to ~${Math.round(wpm / alpha)} wpm — into the comfortable 120–150 band.`;
      }
    }
  }
  if ((scores.clarity ?? 100) < 72) plan.presence = true;
  if ((scores.nonNasal ?? 100) < 60) plan.deNasal = true;
  if ((scores.resonantDepth ?? 100) < 55) plan.warmth = true;
  return plan;
}

// ---------- Web Audio render chain (browser only) ----------
async function renderChain(samples, sr, plan) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) throw new Error('Audio processing is not supported in this browser.');
  const ctx = new Offline(1, samples.length, sr);
  const buf = ctx.createBuffer(1, samples.length, sr);
  buf.copyToChannel(samples instanceof Float32Array ? samples : Float32Array.from(samples), 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;

  let node = src;
  const add = (n) => { node.connect(n); node = n; };

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 85;
  add(hp);

  if (plan.warmth) {
    const ls = ctx.createBiquadFilter();
    ls.type = 'lowshelf';
    ls.frequency.value = 190;
    ls.gain.value = 2.5;
    add(ls);
  }
  if (plan.deNasal) {
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = 1100;
    pk.Q.value = 1.4;
    pk.gain.value = -3.5;
    add(pk);
  }
  if (plan.presence) {
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = 3200;
    pk.Q.value = 1.0;
    pk.gain.value = 4.5;
    add(pk);
    const hs = ctx.createBiquadFilter();
    hs.type = 'highshelf';
    hs.frequency.value = 7500;
    hs.gain.value = 2;
    add(hs);
  }
  if (plan.compress) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26;
    comp.knee.value = 28;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    add(comp);
    const mk = ctx.createGain();
    mk.gain.value = 1.8;
    add(mk);
  }
  node.connect(ctx.destination);
  src.start();
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}

// Enhance an already-decoded AudioBuffer. Returns { blob, url, steps, before, after }.
export async function enhanceBuffer(audioBuffer, { metrics = {}, scores = {} } = {}) {
  const beforeSec = audioBuffer.duration;
  let work = resampleLinear(toMono(audioBuffer), audioBuffer.sampleRate, PROC_SR);
  const sr = PROC_SR;
  if (work.length < sr * 0.3) throw new Error('Recording is too short to enhance.');

  const plan = buildPlan(metrics, scores);
  const steps = [];

  const silence = tightenSilences(work, sr);
  work = silence.samples;
  if (silence.removedSec > 0.3) {
    steps.push({ icon: '✂️', label: 'Tightened the dead air', detail: `Trimmed ${silence.removedSec.toFixed(1)}s of over-long pauses and silence so the delivery feels purposeful.` });
  }

  if (plan.stretch) {
    work = wsola(work, plan.stretchAlpha, sr);
    steps.push({ icon: plan.stretchAlpha > 1 ? '🐢' : '🐇', label: plan.stretchAlpha > 1 ? 'Eased your pace' : 'Lifted your pace', detail: plan.paceNote });
  }

  let rendered = await renderChain(work, sr, plan);
  rendered = normalizePeak(rendered, 0.85);

  if (plan.compress) steps.push({ icon: '📢', label: 'Steadied your projection', detail: 'Compressed and re-levelled so the volume stays supported instead of trailing off at the ends.' });
  if (plan.presence) steps.push({ icon: '🔆', label: 'Sharpened your clarity', detail: 'Lifted presence frequencies so consonants and word-endings cut through more crisply.' });
  if (plan.deNasal) steps.push({ icon: '👃', label: 'Opened up the tone', detail: 'Eased a nasal/boxy resonance for a rounder, more open sound.' });
  if (plan.warmth) steps.push({ icon: '🎚️', label: 'Added warmth', detail: 'Lifted the low-mids a touch for a more grounded, resonant tone.' });
  steps.push({ icon: '🔊', label: 'Normalised the level', detail: 'Brought the whole clip to a consistent, confident loudness.' });

  const afterSec = rendered.length / sr;
  const blob = encodeWav(rendered, sr);
  // Report the speaking-rate change from the time-stretch — NOT words/total-time,
  // since trimming pauses shortens the clip and would inflate a words-per-minute
  // figure even though the articulation is slower.
  const beforeWpm = metrics.wpm ? Math.round(metrics.wpm) : null;
  const afterWpm = plan.stretch && metrics.wpm ? Math.round(metrics.wpm / plan.stretchAlpha) : beforeWpm;
  return {
    blob,
    url: URL.createObjectURL(blob),
    steps,
    plan,
    before: { wpm: beforeWpm, durationSec: beforeSec },
    after: { wpm: afterWpm, durationSec: afterSec },
  };
}

// Enhance from a recorded Blob (decodes, then enhanceBuffer).
export async function enhanceRecording(blob, opts = {}) {
  const audioBuffer = await decodeBlob(blob);
  return enhanceBuffer(audioBuffer, opts);
}
