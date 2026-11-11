// Orchestrates the full analysis of one recording into scores + distances.

import { analyzeAudioBuffer, decodeBlob } from './audioAnalysis.js';
import { analyzeTranscript } from './speechMetrics.js';
import { wordsAt } from './takeSplits.js';
import {
  ATTRIBUTES,
  computeDistances,
  overallScore,
} from './attributes.js';

// Combine raw audio + transcript metrics, then derive scores.
export function scoreFromMetrics(metrics, profile) {
  const hasTranscript = metrics.wordCount > 0;
  const scores = {};
  for (const attr of ATTRIBUTES) {
    if (attr.requiresTranscript && !hasTranscript) {
      scores[attr.key] = null;
      continue;
    }
    const s = attr.score(metrics, profile);
    scores[attr.key] = Number.isFinite(s) ? Math.round(s) : null;
  }
  const overall = overallScore(scores);
  const distances = computeDistances(scores);
  return { scores, overall, distances };
}

// Full pipeline: decode + analyze audio, fold in transcript, produce scores.
export async function analyzeRecording({
  blob,
  durationSec,
  transcript,
  recognitionConfidence = 0,
  recognitionSupported = false,
  profile = {},
  paceMarks = [],
}) {
  let audioMetrics;
  try {
    const buffer = await decodeBlob(blob);
    audioMetrics = analyzeAudioBuffer(buffer);
    if (!durationSec) durationSec = audioMetrics.durationSec;
  } catch {
    // Decoding failed (unsupported codec); fall back to silence-like metrics.
    audioMetrics = analyzeAudioBuffer({
      sampleRate: 48000,
      numberOfChannels: 1,
      length: 0,
      getChannelData: () => new Float32Array(0),
    });
  }

  const transcriptMetrics = analyzeTranscript(transcript || '', durationSec || 1);

  const { audioParts, ...audioWhole } = audioMetrics;
  const metrics = {
    ...audioWhole,
    ...transcriptMetrics,
    durationSec: durationSec || audioMetrics.durationSec,
    recognitionConfidence,
    recognitionSupported,
  };
  const parts = buildPartMetrics({ audioParts, transcript, paceMarks, durationSec: metrics.durationSec, recognitionConfidence, recognitionSupported });
  if (parts) metrics.parts = parts;

  const { scores, overall, distances } = scoreFromMetrics(metrics, profile);
  return { metrics, scores, overall, distances };
}

// Halves / thirds / quarters: each part's audio metrics plus the transcript words
// spoken in it (located via the recognizer's segment timings), so every attribute
// can be scored per part. Without timings the transcript attributes stay null.
// ponytail: words are placed by segment-level timing, interpolated within a segment.
export function buildPartMetrics({ audioParts, transcript = '', paceMarks = [], durationSec, recognitionConfidence = 0, recognitionSupported = false }) {
  if (!audioParts || !Object.keys(audioParts).length || !durationSec) return null;
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const timed = paceMarks.length > 0 && words.length > 0;
  const out = {};
  for (const [n, list] of Object.entries(audioParts)) {
    out[n] = list.map((audio, k) => {
      const from = (durationSec * k) / n;
      const to = (durationSec * (k + 1)) / n;
      const tx = timed
        ? analyzeTranscript(words.slice(Math.round(wordsAt(paceMarks, from)), Math.round(wordsAt(paceMarks, to))).join(' '), to - from)
        : {};
      return { ...audio, ...tx, durationSec: to - from, recognitionConfidence, recognitionSupported };
    });
  }
  return out;
}

// Scores per part: { 2: [{ scores, overall }, …], 3: …, 4: … }.
export function scoreParts(parts, profile) {
  const out = {};
  for (const [n, list] of Object.entries(parts || {})) {
    out[n] = list.map((m) => { const r = scoreFromMetrics(m, profile); return { scores: r.scores, overall: r.overall }; });
  }
  return out;
}

// Self-check (npm test): parts get audio + their own slice of the transcript.
export function demo() {
  const ok = (c, msg) => { if (!c) throw new Error(`analysis: ${msg}`); };
  const audio = { meanRms: 0.05, f0StdSemitones: 3, terminalSlope: 0, trailingRatio: 0.8, nasalIndex: 2, silenceRatio: 0.3, meanHfRatio: 0.2, medianF0Hz: 150 };
  const transcript = 'one two three four five six um um seven eight';
  const marks = [{ t: 30, words: 6 }, { t: 60, words: 4 }];
  const parts = buildPartMetrics({ audioParts: { 2: [audio, { ...audio, meanRms: 0.01 }] }, transcript, paceMarks: marks, durationSec: 60 });
  ok(parts[2][0].wordCount === 6 && parts[2][1].wordCount === 4, 'words split by segment timing');
  ok(parts[2][1].fillerTotal === 2 && parts[2][0].fillerTotal === 0, 'fillers land in the part they were said');
  const scored = scoreParts(parts, {});
  ok(scored[2][0].scores.pace != null && scored[2][1].scores.projection < scored[2][0].scores.projection, 'every attribute scored; quieter part projects less');
  const noTiming = scoreParts(buildPartMetrics({ audioParts: { 2: [audio, audio] }, transcript, durationSec: 60 }), {});
  ok(noTiming[2][0].scores.pace === null && noTiming[2][0].scores.expressiveness != null, 'no timings → transcript attributes skipped, audio ones kept');
  ok(buildPartMetrics({ audioParts: {}, durationSec: 10 }) === null, 'short take → no parts');
  return 'analysis.demo: ok';
}

// Re-score an existing session's stored metrics (used after profile changes /
// for seed data). Avoids needing the original audio.
export function rescore(metrics, profile) {
  return scoreFromMetrics(metrics, profile);
}

// Warm-up activities (breathing exhales, humming, lip trills) aren't graded on the
// full attribute scale — they're assessed simply for completion: did you record a
// reasonable length and actually make sound?
export function assessCompletion(metrics) {
  const durationSec = metrics.durationSec || 0;
  const soundRatio = Math.max(0, Math.min(1, 1 - (metrics.silenceRatio ?? 1)));
  const completed = durationSec >= 4 && soundRatio > 0.05;

  let quality;
  let note;
  if (!completed) {
    quality = 'incomplete';
    note =
      durationSec < 4
        ? 'Very short — hold the exercise a little longer next time.'
        : 'Almost no sound was detected — check your microphone and try again.';
  } else if (durationSec < 8) {
    quality = 'brief';
    note = 'Done — a touch brief. Aim for the suggested length to get the full benefit.';
  } else if (soundRatio < 0.2) {
    quality = 'gentle';
    note = 'Done — nice and gentle. Make sure the mic is catching your breath or hum.';
  } else {
    quality = 'good';
    note = 'Nicely done — steady sound throughout. Keep the streak going!';
  }

  return { completed, quality, note, durationSec, soundRatio };
}
