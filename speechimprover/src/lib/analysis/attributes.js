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
    short: 'Pace',
    label: 'Pace',
    blurb: 'Words per minute in a comfortable, listenable band (~110–150 wpm).',
    weight: 1.1,
    requiresTranscript: true,
    guideSection: '02 · Pace',
    score: (m) => band(m.wpm, 110, 150, 60, 210),
    cues: (m) => (m.wpm > 150 ? [
      'Land the final consonant of every phrase, then take one deliberate nasal breath before the next — the breath is the brake.',
      'Drop the shoulders and unlock the knees before you speak; neck/shoulder tension is what drives the rush.',
      'Stretch the vowel of the key word in each sentence — long vowels physically cap words-per-minute.',
    ] : [
      'Link the words inside a phrase on one continuous exhale; only stop at punctuation.',
      'Take a bigger belly breath so you can carry a whole thought-group without stalling.',
    ]),
    detail: (m) => `${Math.round(m.wpm)} wpm`,
  },
  {
    key: 'clarity',
    short: 'Clarity',
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
    cues: () => [
      'Open the jaw a finger-width: bite a knuckle between the molars for one line, remove it and keep that space.',
      'Tap the tongue tip on the ridge behind the top teeth for t/d/l/n — feel the contact, don’t glide past it.',
      'Finish every word: lips fully closed on m/p/b, teeth together on s/z — the ending is where mumbling lives.',
    ],
    detail: (m) =>
      m.recognitionConfidence > 0
        ? `HF ${(m.meanHfRatio * 100).toFixed(0)}% · conf ${(m.recognitionConfidence * 100).toFixed(0)}%`
        : `HF energy ${(m.meanHfRatio * 100).toFixed(0)}%`,
  },
  {
    key: 'fillers',
    short: 'Fillers',
    label: 'Filler economy',
    blurb: 'Few “um / uh / like / you know” — pauses instead of fillers.',
    weight: 1.1,
    requiresTranscript: true,
    guideSection: '04 · Reducing filler words',
    score: (m) => down(m.fillersPerMin, 1, 14),
    cues: () => [
      'When you feel an “um” rising, close the lips and exhale silently through the nose instead — swap the sound for a breath.',
      'Park the tongue tip behind the top teeth during a pause; a parked tongue can’t make “uh”.',
      'Slow the last three words before a pause; fillers fill the gap between the thought and the mouth.',
    ],
    detail: (m) => `${m.fillersPerMin.toFixed(1)} /min`,
  },
  {
    key: 'nonRepetition',
    short: 'Variety',
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
    cues: () => [
      'Half-second inhale before each sentence — decide the sentence’s last word before you start it.',
      'When a word repeats, deliberately swap it next time; the pause to choose is itself good pacing.',
    ],
    detail: (m) => `TTR ${(m.typeTokenRatio * 100).toFixed(0)}%`,
  },
  {
    key: 'resonantDepth',
    short: 'Depth',
    label: 'Resonant depth',
    blurb: 'Lower, grounded resonance vs a thin/high pitch (reference-relative to profile).',
    weight: 0.8,
    guideSection: '04 · Tone & pitch',
    score: (m, profile) => {
      if (!m.medianF0Hz) return 50;
      const ratio = m.medianF0Hz / depthCenter(profile);
      return clamp(100 - (ratio - 0.72) * 125, 0, 100);
    },
    cues: () => [
      'Yawn-sigh: begin a yawn, then sigh “ahh” downward — feel the larynx drop and keep it there as you go into words.',
      'Hand on the sternum: hum “mmm” until you feel buzz under the palm, then slide into speech keeping the buzz.',
      'Release the jaw hinge and let the tongue lie flat and forward — a tongue bunched back squeezes the pitch up.',
      'Speak on the exhale of a low belly breath (hand on stomach moves out on the inhale), not from the throat.',
    ],
    detail: (m) => (m.medianF0Hz ? `${Math.round(m.medianF0Hz)} Hz median` : 'n/a'),
  },
  {
    key: 'expressiveness',
    short: 'Expressive',
    label: 'Expressiveness',
    blurb: 'Lively pitch variation rather than a flat monotone.',
    weight: 1.0,
    guideSection: '04 · Tone & expressiveness',
    score: (m) => clamp(((m.f0StdSemitones - 1) / 4.5) * 100, 0, 100),
    cues: () => [
      'Lift the key word of each sentence a musical third higher, then let the rest fall — exaggerate to a child, then dial back 20%.',
      'Move eyebrows and hands while you speak; face and hand motion drags pitch with it.',
      'Contrast: stretch the vowel of the important word, clip the unimportant ones.',
    ],
    detail: (m) => `${m.f0StdSemitones.toFixed(1)} st variation`,
  },
  {
    key: 'nonNasal',
    short: 'Non-nasal',
    label: 'Non-nasal tone',
    blurb: 'Open, resonant tone rather than a pinched / nasal one (rough spectral estimate).',
    weight: 0.8,
    guideSection: '04 · Tone',
    score: (m) => clamp(100 - (m.nasalIndex - 1.5) * 13, 25, 100),
    cues: () => [
      'Pinch the nose on “ah” — if the tone changes, the soft palate is down; lift it as at the start of a yawn and hold that arch.',
      'Aim the sound at the front teeth and lips with the mouth more open, not up behind the nose.',
      'Say “ng–ah” slowly: feel the palate lift on “ah” — that lift is what you keep on vowels.',
    ],
    detail: (m) => `nasal idx ${m.nasalIndex.toFixed(1)}`,
  },
  {
    key: 'noUptalk',
    short: 'No uptalk',
    label: 'No uptalk',
    blurb: 'Statements fall or stay level at the end instead of rising like questions.',
    weight: 1.0,
    guideSection: '04 · Avoid upspeak',
    score: (m) => clamp(100 - Math.max(0, m.terminalSlope) * (100 / 6), 0, 100),
    cues: () => [
      'On the last word of a statement, drop the chin a touch and let the pitch step down like walking down a stair.',
      'Give the final syllable a little extra weight and finish the exhale — a rising end is usually an unfinished breath.',
      'Say the sentence as if the full stop were audible: “…period.”',
    ],
    detail: (m) => `${m.terminalSlope >= 0 ? '+' : ''}${m.terminalSlope.toFixed(1)} st/s end`,
  },
  {
    key: 'projection',
    short: 'Projection',
    label: 'Projection',
    blurb: 'Steady, supported volume that does not trail off at sentence ends.',
    weight: 1.0,
    guideSection: '04 · Breath support & projection',
    score: (m) => {
      const level = up(m.meanRms, 0.02, 0.12);
      const trail = up(m.trailingRatio, 0.4, 0.85);
      return clamp(0.4 * level + 0.6 * trail, 0, 100);
    },
    cues: () => [
      'Breathe low: hand on the belly, inhale so the hand moves out; speak on that air, not from lifted shoulders.',
      'Keep the abdominal wall gently engaged through the last word — the last word goes to the back wall, not the floor.',
      'Aim the final word of each sentence at a spot 3 m away; the eyes lead, the breath follows.',
    ],
    detail: (m) => `tail ${(m.trailingRatio * 100).toFixed(0)}% of body`,
  },
  {
    key: 'breath',
    short: 'Breath',
    label: 'Breath & pausing',
    blurb: 'Regular breaths and pauses — neither breathless run-ons nor choppy gasping.',
    weight: 0.9,
    guideSection: '03 · Breathing',
    score: (m) => band(m.silenceRatio, 0.15, 0.45, 0.02, 0.72),
    cues: (m) => (m.silenceRatio < 0.15 ? [
      'Mark breath spots at every comma and full stop; take a quiet low breath there — refill before you are empty.',
      'Rest the hand on the belly: if it isn’t moving out on the inhale, you are shoulder-breathing — go lower.',
    ] : [
      'Speak in longer thought-groups on one breath; fewer, deeper belly breaths instead of gasps.',
      '4-count inhale, 8-count “sss” exhale, three times — lengthens the phrase you can carry.',
    ]),
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

// Neuromuscular coaching: the attributes that were lacking in this take, worst
// first, each with concrete body-level cues. Focus attributes surface even when
// merely "okay" (< 85). ponytail: fixed thresholds, tune when scores feel off.
export function coachingCues(scores = {}, metrics = {}, focusAttrs = [], limit = 4) {
  const out = [];
  for (const a of ATTRIBUTES) {
    const v = scores[a.key];
    if (v == null) continue;
    const isFocus = focusAttrs.includes(a.key);
    if (v >= (isFocus ? 85 : 72)) continue;
    let detail = '';
    try { detail = a.detail(metrics); } catch { /* old record without the metric */ }
    let cues;
    try { cues = a.cues(metrics); } catch { cues = a.cues({}); }
    out.push({ key: a.key, label: a.label, short: a.short, score: Math.round(v), detail, cues, focus: isFocus, guideSection: a.guideSection });
  }
  return out.sort((x, y) => (y.focus - x.focus) || (x.score - y.score)).slice(0, limit);
}

export function demoCues() {
  const scores = { pace: 40, clarity: 90, fillers: 60, resonantDepth: 80, projection: 75 };
  const m = { wpm: 190, fillersPerMin: 5, medianF0Hz: 150, silenceRatio: 0.1, meanRms: 0.05, trailingRatio: 0.7 };
  const r = coachingCues(scores, m, ['resonantDepth']);
  console.assert(r[0].key === 'resonantDepth', 'focus first even at 80');
  console.assert(r[1].key === 'pace' && r[2].key === 'fillers', 'then worst first');
  console.assert(r.length === 3, 'clarity 90 and projection 75 skipped');
  console.assert(/breath is the brake/.test(r[1].cues[0]), 'fast-pace cue variant');
  console.assert(coachingCues({ pace: 40 }, {}).length === 1, 'missing metrics tolerated');
  return r;
}
