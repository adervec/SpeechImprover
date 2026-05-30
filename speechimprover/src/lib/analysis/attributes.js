// The scored speech attributes, their scoring from raw metrics, reference
// (desirable / undesirable) profiles, and "distance" computation.
//
// Every score is 0..100 (higher = better). Scores are honest heuristic estimates
// computed fully locally — see design.md.

import { clamp } from '../format.js';

// ---- scoring shape helpers ----
function up(v, lo, hi) {
  if (hi === lo) return 50;
  return clamp(((v - lo) / (hi - lo)) * 100, 0, 100);
}
function down(v, lo, hi) {
  if (hi === lo) return 50;
  return clamp(100 - ((v - lo) / (hi - lo)) * 100, 0, 100);
}
function band(v, lo, hi, fadeLo, fadeHi) {
  if (v >= lo && v <= hi) return 100;
  if (v < lo) return clamp(((v - fadeLo) / (lo - fadeLo)) * 100, 0, 100);
  return clamp(((fadeHi - v) / (fadeHi - hi)) * 100, 0, 100);
}

// Reference median-F0 center (Hz) used to make "depth" reference-relative.
function depthCenter(profile) {
  const g = (profile?.gender || '').toLowerCase();
  if (g.startsWith('m')) return 115;
  if (g.startsWith('f') || g.startsWith('w')) return 200;
  return 155;
}

// ---- attribute catalog ----
// requiresTranscript: scored from the speech-recognition transcript (skipped if absent).
export const ATTRIBUTES = [
  {
    key: 'pace',
    label: 'Pace',
    blurb: 'Words per minute in a comfortable, listenable band (~110–150 wpm).',
    weight: 1.1,
    requiresTranscript: true,
    guideSection: '02 · Pace',
    score: (m) => band(m.wpm, 110, 150, 60, 210),
    detail: (m) => `${Math.round(m.wpm)} wpm`,
  },
  {
    key: 'clarity',
    label: 'Clarity (no mumbling)',
    blurb: 'Crisp consonants and finished word-endings rather than mumbled, closed-jaw speech.',
    weight: 1.2,
    guideSection: '04 · Clarity & articulation',
    score: (m) => {
      const audio = up(m.meanHfRatio, 0.04, 0.18);
      if (m.recognitionConfidence > 0) {
        return clamp(0.6 * audio + 0.4 * m.recognitionConfidence * 100, 0, 100);
      }
      return audio;
    },
    detail: (m) =>
      m.recognitionConfidence > 0
        ? `HF ${(m.meanHfRatio * 100).toFixed(0)}% · conf ${(m.recognitionConfidence * 100).toFixed(0)}%`
        : `HF energy ${(m.meanHfRatio * 100).toFixed(0)}%`,
  },
  {
    key: 'fillers',
    label: 'Filler economy',
    blurb: 'Few “um / uh / like / you know” — pauses instead of fillers.',
    weight: 1.1,
    requiresTranscript: true,
    guideSection: '04 · Reducing filler words',
    score: (m) => down(m.fillersPerMin, 1, 14),
    detail: (m) => `${m.fillersPerMin.toFixed(1)} /min`,
  },
  {
    key: 'nonRepetition',
    label: 'Non-repetition / richness',
    blurb: 'Varied vocabulary; avoids leaning on the same words and false starts.',
    weight: 1.0,
    requiresTranscript: true,
    guideSection: '02 · Vocabulary',
    score: (m) => {
      let s = up(m.typeTokenRatio, 0.3, 0.62);
      s -= Math.max(0, m.maxContentRepeat - 3) * 6;
      s -= m.stutterRepeats * 5;
      return clamp(s, 0, 100);
    },
    detail: (m) => `TTR ${(m.typeTokenRatio * 100).toFixed(0)}%`,
  },
  {
    key: 'resonantDepth',
    label: 'Resonant depth',
    blurb: 'Lower, grounded resonance vs a thin/high pitch (reference-relative to profile).',
    weight: 0.8,
    guideSection: '04 · Tone & pitch',
    score: (m, profile) => {
      if (!m.medianF0Hz) return 50;
      const ratio = m.medianF0Hz / depthCenter(profile);
      return clamp(100 - (ratio - 0.72) * 125, 0, 100);
    },
    detail: (m) => (m.medianF0Hz ? `${Math.round(m.medianF0Hz)} Hz median` : 'n/a'),
  },
  {
    key: 'expressiveness',
    label: 'Expressiveness',
    blurb: 'Lively pitch variation rather than a flat monotone.',
    weight: 1.0,
    guideSection: '04 · Tone & expressiveness',
    score: (m) => clamp(((m.f0StdSemitones - 1) / 4.5) * 100, 0, 100),
    detail: (m) => `${m.f0StdSemitones.toFixed(1)} st variation`,
  },
  {
    key: 'nonNasal',
    label: 'Non-nasal tone',
    blurb: 'Open, resonant tone rather than a pinched / nasal one (rough spectral estimate).',
    weight: 0.8,
    guideSection: '04 · Tone',
    score: (m) => clamp(100 - (m.nasalIndex - 1.5) * 13, 25, 100),
    detail: (m) => `nasal idx ${m.nasalIndex.toFixed(1)}`,
  },
  {
    key: 'noUptalk',
    label: 'No uptalk',
    blurb: 'Statements fall or stay level at the end instead of rising like questions.',
    weight: 1.0,
    guideSection: '04 · Avoid upspeak',
    score: (m) => clamp(100 - Math.max(0, m.terminalSlope) * (100 / 6), 0, 100),
    detail: (m) => `${m.terminalSlope >= 0 ? '+' : ''}${m.terminalSlope.toFixed(1)} st/s end`,
  },
  {
    key: 'projection',
    label: 'Projection',
    blurb: 'Steady, supported volume that does not trail off at sentence ends.',
    weight: 1.0,
    guideSection: '04 · Breath support & projection',
    score: (m) => {
      const level = up(m.meanRms, 0.02, 0.12);
      const trail = up(m.trailingRatio, 0.4, 0.85);
      return clamp(0.4 * level + 0.6 * trail, 0, 100);
    },
    detail: (m) => `tail ${(m.trailingRatio * 100).toFixed(0)}% of body`,
  },
  {
    key: 'breath',
    label: 'Breath & pausing',
    blurb: 'Regular breaths and pauses — neither breathless run-ons nor choppy gasping.',
    weight: 0.9,
    guideSection: '03 · Breathing',
    score: (m) => band(m.silenceRatio, 0.15, 0.45, 0.02, 0.72),
    detail: (m) => `${(m.silenceRatio * 100).toFixed(0)}% pause · ${m.pauseCount} breaks`,
  },
];

export const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);
export const ATTRIBUTE_MAP = Object.fromEntries(ATTRIBUTES.map((a) => [a.key, a]));

// ---- reference profiles (target desirable / undesirable speaking patterns) ----
export const REFERENCE_PROFILES = {
  desirable: {
    label: 'Target — desirable',
    description:
      'Clear, well-paced, varied and confident — the pattern to move toward.',
    scores: {
      pace: 90,
      clarity: 90,
      fillers: 92,
      nonRepetition: 85,
      resonantDepth: 72,
      expressiveness: 85,
      nonNasal: 88,
      noUptalk: 90,
      projection: 86,
      breath: 85,
    },
  },
  undesirable: {
    label: 'Anti-pattern — undesirable',
    description:
      'Mumbled, monotone, filler-heavy, with uptalk and fading energy — the pattern to move away from.',
    scores: {
      pace: 42,
      clarity: 35,
      fillers: 28,
      nonRepetition: 45,
      resonantDepth: 48,
      expressiveness: 28,
      nonNasal: 45,
      noUptalk: 30,
      projection: 38,
      breath: 44,
    },
  },
};

// Weighted, normalized Euclidean distance (0..100) between a score vector and a
// reference vector. Only attributes present in `scores` participate.
export function distanceTo(scores, refScores) {
  let num = 0;
  let wsum = 0;
  for (const attr of ATTRIBUTES) {
    const a = scores[attr.key];
    const r = refScores[attr.key];
    if (a == null || r == null) continue;
    const d = (a - r) / 100;
    num += attr.weight * d * d;
    wsum += attr.weight;
  }
  if (wsum === 0) return 0;
  return Math.sqrt(num / wsum) * 100;
}

// Overall weighted mean of available scores.
export function overallScore(scores) {
  let num = 0;
  let wsum = 0;
  for (const attr of ATTRIBUTES) {
    const a = scores[attr.key];
    if (a == null) continue;
    num += attr.weight * a;
    wsum += attr.weight;
  }
  return wsum ? Math.round(num / wsum) : 0;
}

export function computeDistances(scores) {
  const d = distanceTo(scores, REFERENCE_PROFILES.desirable.scores);
  const u = distanceTo(scores, REFERENCE_PROFILES.undesirable.scores);
  const alignment = d + u === 0 ? 50 : clamp((u / (d + u)) * 100, 0, 100);
  return {
    desirable: Math.round(d),
    undesirable: Math.round(u),
    alignment: Math.round(alignment),
  };
}
