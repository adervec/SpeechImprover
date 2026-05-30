// Seed historical sessions so trends, comparison and "load historical patterns"
// work on first run. Marked seed:true so they can be cleared in Settings.

import { scoreFromMetrics } from './analysis/index.js';
import { uid } from './format.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function jitter(v, amt) {
  return v + (Math.random() - 0.5) * 2 * amt;
}

// Build a plausible metrics object for a given progress factor p (0=start,1=now).
function buildMetrics(p, mode) {
  const durationSec = mode === 'read' ? 58 : mode === 'twister' ? 22 : 95;
  const wpm = jitter(lerp(178, 134, p), 8);
  const minutes = durationSec / 60;
  const wordCount = Math.round(wpm * minutes);
  const fillersPerMin = Math.max(0.5, jitter(lerp(9.5, 2.2, p), 1.2));
  const typeTokenRatio = Math.min(0.7, jitter(lerp(0.4, 0.58, p), 0.03));

  return {
    durationSec,
    wordCount,
    wpm,
    fillerTotal: Math.round(fillersPerMin * minutes),
    fillersPerMin,
    fillerCounts: { um: Math.round(fillersPerMin * minutes * 0.5), like: Math.round(fillersPerMin * minutes * 0.3) },
    typeTokenRatio,
    uniqueCount: Math.round(wordCount * typeTokenRatio),
    maxContentRepeat: Math.round(jitter(lerp(6, 3, p), 1)),
    stutterRepeats: Math.max(0, Math.round(jitter(lerp(2, 0, p), 1))),
    topRepeats: [],
    medianF0Hz: jitter(150, 8),
    f0StdSemitones: Math.max(0.8, jitter(lerp(1.5, 4.1, p), 0.4)),
    meanRms: jitter(lerp(0.055, 0.1, p), 0.01),
    peakRms: 0.3,
    voicedRatio: jitter(0.55, 0.05),
    terminalSlope: jitter(lerp(3.1, -0.4, p), 0.7),
    trailingRatio: Math.min(1, jitter(lerp(0.55, 0.86, p), 0.05)),
    meanHfRatio: jitter(lerp(0.07, 0.15, p), 0.015),
    meanCentroidHz: jitter(lerp(1500, 2100, p), 150),
    nasalIndex: Math.max(1.5, jitter(lerp(5.2, 2.6, p), 0.5)),
    pauseCount: Math.round(jitter(lerp(4, 9, p), 2)),
    meanPauseSec: jitter(0.4, 0.1),
    longestPauseSec: jitter(1.1, 0.3),
    silenceRatio: Math.min(0.6, jitter(lerp(0.5, 0.3, p), 0.04)),
    utteranceCount: Math.round(jitter(lerp(5, 11, p), 2)),
    recognitionConfidence: jitter(lerp(0.72, 0.9, p), 0.04),
    recognitionSupported: true,
  };
}

const PLAN = [
  { daysAgo: 96, mode: 'free', type: 'baseline', exerciseId: 'baseline-free', title: 'Baseline 2 — Free speech', note: 'First baseline. Felt rushed and nervous.' },
  { daysAgo: 95, mode: 'read', type: 'baseline', exerciseId: 'baseline-read', title: 'Baseline 1 — Reading aloud' },
  { daysAgo: 95, mode: 'free', type: 'baseline', exerciseId: 'baseline-pressure', title: 'Baseline 3 — High-pressure' },
  { daysAgo: 88, mode: 'twister', type: 'practice', exerciseId: 'art-tw-s', title: 'Tongue twister — S / sh' },
  { daysAgo: 81, mode: 'free', type: 'free', exerciseId: 'free-0', title: 'Free speaking' },
  { daysAgo: 74, mode: 'read', type: 'read', exerciseId: 'core-read-engine', title: 'Read aloud — How an Engine Works' },
  { daysAgo: 66, mode: 'free', type: 'free', exerciseId: 'free-1', title: 'Free speaking', note: 'Plateau week — felt stuck.' },
  { daysAgo: 59, mode: 'twister', type: 'practice', exerciseId: 'art-tw-r', title: 'Tongue twister — R' },
  { daysAgo: 52, mode: 'read', type: 'read', exerciseId: 'core-read-tide', title: 'Read aloud — The Turning Tide' },
  { daysAgo: 44, mode: 'free', type: 'free', exerciseId: 'interview-0', title: 'High-pressure simulation' },
  { daysAgo: 37, mode: 'free', type: 'free', exerciseId: 'free-2', title: 'Free speaking', note: 'Pauses starting to feel natural.' },
  { daysAgo: 30, mode: 'read', type: 'baseline', exerciseId: 'baseline-read', title: 'Baseline 1 — Reading aloud', note: 'Monthly review re-record.' },
  { daysAgo: 22, mode: 'free', type: 'free', exerciseId: 'free-3', title: 'Free speaking' },
  { daysAgo: 15, mode: 'read', type: 'read', exerciseId: 'expr-story', title: 'Expressive read-aloud' },
  { daysAgo: 8, mode: 'free', type: 'free', exerciseId: 'interview-1', title: 'High-pressure simulation', note: 'Held steady under pressure.' },
  { daysAgo: 2, mode: 'free', type: 'free', exerciseId: 'free-0', title: 'Free speaking', note: 'Best one yet.' },
];

export function buildSeedSessions(profile = {}) {
  const n = PLAN.length;
  return PLAN.map((item, i) => {
    const p = n > 1 ? i / (n - 1) : 1;
    const metrics = buildMetrics(p, item.mode);
    const { scores, overall, distances } = scoreFromMetrics(metrics, profile);
    const createdAt = new Date(Date.now() - item.daysAgo * 86400000).toISOString();
    return {
      id: `SEED-${uid()}`,
      createdAt,
      type: item.type,
      mode: item.mode,
      exerciseId: item.exerciseId,
      exerciseTitle: item.title,
      prompt: '',
      targetAttributes: [],
      durationSec: metrics.durationSec,
      transcript: '',
      recognitionConfidence: metrics.recognitionConfidence,
      recognitionSupported: true,
      metrics,
      scores,
      overall,
      distances,
      audioId: null,
      audioMime: null,
      audioBytes: 0,
      notes: item.note || '',
      debrief: null,
      seed: true,
    };
  });
}
