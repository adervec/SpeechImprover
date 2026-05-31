// Articulation model: turns English text into a timed sequence of "visemes"
// (idealized mouth/tongue/jaw postures) that the ArticulationModel component
// animates as a reference for the speaker to mimic.
//
// This is a *visual coaching* model, not a phonetic transcriber: a lightweight
// grapheme→viseme mapper is accurate enough to show how the lips round, where
// the tongue goes, and how far the jaw drops for each sound. Each viseme carries
// geometry for both the front (lips) and sagittal (tongue/jaw) views plus a short
// articulation tip.
//
// Geometry params are all 0..1 unless noted:
//   jaw       jaw opening (0 closed → 1 dropped)
//   lipOpen   vertical lip aperture
//   lipRound  lip rounding / forward protrusion
//   lipSpread horizontal spread ("ee" smile)
//   tongueX   tongue hump front↔back (0 back → 1 front)
//   tongueY   tongue height (0 low → 1 high/raised)
//   tongueTip tip raised toward the alveolar ridge (0 rest → 1 contact)
//   teethLip  upper teeth meet lower lip (f / v)
//   tipTeeth  tongue tip between the teeth (th)
//   voiced    cosmetic only (whether the sound is voiced)

export const VISEMES = {
  rest: { label: '·', tip: 'Relaxed, lips lightly closed.', jaw: 0.12, lipOpen: 0.06, lipRound: 0.15, lipSpread: 0.2, tongueX: 0.4, tongueY: 0.35, tongueTip: 0.1 },

  // open / low vowels
  AA: { label: 'ah', tip: 'Drop the jaw wide open; tongue low and back, as in “father”.', jaw: 0.95, lipOpen: 0.9, lipRound: 0.1, lipSpread: 0.3, tongueX: 0.3, tongueY: 0.12, tongueTip: 0.05 },
  AE: { label: 'a', tip: 'Open jaw; tongue low and forward, as in “cat”.', jaw: 0.8, lipOpen: 0.72, lipRound: 0.05, lipSpread: 0.55, tongueX: 0.62, tongueY: 0.22, tongueTip: 0.08 },
  AH: { label: 'uh', tip: 'Relaxed mid-open; tongue central, as in “cup”.', jaw: 0.55, lipOpen: 0.5, lipRound: 0.1, lipSpread: 0.35, tongueX: 0.45, tongueY: 0.4, tongueTip: 0.1 },

  // front vowels
  EE: { label: 'ee', tip: 'Spread the lips into a smile; tongue high and forward, as in “see”.', jaw: 0.2, lipOpen: 0.22, lipRound: 0, lipSpread: 1, tongueX: 0.82, tongueY: 0.9, tongueTip: 0.25 },
  IH: { label: 'i', tip: 'Slightly open, lips relaxed; tongue high-front, as in “sit”.', jaw: 0.32, lipOpen: 0.32, lipRound: 0.05, lipSpread: 0.7, tongueX: 0.75, tongueY: 0.7, tongueTip: 0.2 },

  // back / rounded vowels
  OH: { label: 'oh', tip: 'Round the lips; tongue mid-back, as in “go”.', jaw: 0.55, lipOpen: 0.5, lipRound: 0.7, lipSpread: 0.1, tongueX: 0.3, tongueY: 0.45, tongueTip: 0.08 },
  OO: { label: 'oo', tip: 'Push the lips forward into a tight circle, as in “boot”.', jaw: 0.3, lipOpen: 0.28, lipRound: 1, lipSpread: 0, tongueX: 0.22, tongueY: 0.78, tongueTip: 0.08 },
  UH: { label: 'oo', tip: 'Lightly rounded, relaxed, as in “book”.', jaw: 0.4, lipOpen: 0.36, lipRound: 0.55, lipSpread: 0.1, tongueX: 0.3, tongueY: 0.6, tongueTip: 0.08 },
  ER: { label: 'er', tip: 'Bunch the tongue in the middle and curl it slightly back, as in “bird”.', jaw: 0.42, lipOpen: 0.36, lipRound: 0.45, lipSpread: 0.2, tongueX: 0.5, tongueY: 0.6, tongueTip: 0.55, voiced: true },

  // bilabials
  MBP: { label: 'm/b/p', tip: 'Press both lips together, then release.', jaw: 0.1, lipOpen: 0, lipRound: 0.2, lipSpread: 0.25, tongueX: 0.4, tongueY: 0.35, tongueTip: 0.1 },
  // labiodental
  FV: { label: 'f/v', tip: 'Touch the upper teeth to the lower lip and let air pass.', jaw: 0.22, lipOpen: 0.16, lipRound: 0.1, lipSpread: 0.4, tongueX: 0.45, tongueY: 0.4, tongueTip: 0.12, teethLip: true },
  // dental
  TH: { label: 'th', tip: 'Tongue tip lightly between the teeth.', jaw: 0.3, lipOpen: 0.26, lipRound: 0.05, lipSpread: 0.45, tongueX: 0.9, tongueY: 0.7, tongueTip: 0.85, tipTeeth: true },
  // alveolars
  TDNL: { label: 't/d/n/l', tip: 'Tap the tongue tip to the ridge behind the upper teeth.', jaw: 0.32, lipOpen: 0.3, lipRound: 0.08, lipSpread: 0.4, tongueX: 0.92, tongueY: 0.78, tongueTip: 1 },
  SZ: { label: 's/z', tip: 'Tongue tip near the ridge, teeth almost closed; thin, steady airflow.', jaw: 0.18, lipOpen: 0.16, lipRound: 0.05, lipSpread: 0.6, tongueX: 0.88, tongueY: 0.82, tongueTip: 0.8 },
  // post-alveolar
  SH: { label: 'sh/ch/j', tip: 'Round the lips a little; raise the tongue blade behind the ridge.', jaw: 0.3, lipOpen: 0.26, lipRound: 0.65, lipSpread: 0.05, tongueX: 0.75, tongueY: 0.78, tongueTip: 0.55 },
  // velars
  KG: { label: 'k/g', tip: 'Raise the back of the tongue to the soft palate.', jaw: 0.4, lipOpen: 0.36, lipRound: 0.12, lipSpread: 0.35, tongueX: 0.18, tongueY: 0.82, tongueTip: 0.1 },
  // approximants
  R: { label: 'r', tip: 'Curl or bunch the tongue back without touching; round the lips slightly.', jaw: 0.4, lipOpen: 0.34, lipRound: 0.5, lipSpread: 0.15, tongueX: 0.45, tongueY: 0.62, tongueTip: 0.5, voiced: true },
  W: { label: 'w', tip: 'Start with tightly rounded lips, then open.', jaw: 0.3, lipOpen: 0.24, lipRound: 1, lipSpread: 0, tongueX: 0.2, tongueY: 0.7, tongueTip: 0.08 },
  Y: { label: 'y', tip: 'Tongue high and forward, gliding into the vowel.', jaw: 0.28, lipOpen: 0.26, lipRound: 0.05, lipSpread: 0.8, tongueX: 0.8, tongueY: 0.85, tongueTip: 0.25 },
  HH: { label: 'h', tip: 'Open and relaxed; just breathe out.', jaw: 0.5, lipOpen: 0.48, lipRound: 0.1, lipSpread: 0.3, tongueX: 0.45, tongueY: 0.4, tongueTip: 0.1 },
};

// Base duration (ms at normal speed) by rough sound class.
const VOWELS = new Set(['AA', 'AE', 'AH', 'EE', 'IH', 'OH', 'OO', 'UH', 'ER']);
function baseDuration(v) {
  if (v === 'rest') return 110;
  return VOWELS.has(v) ? 165 : 95;
}

// Ordered digraph/trigraph rules checked before single letters.
const CLUSTERS = [
  ['tch', ['SH']],
  ['igh', ['AA']],
  ['ough', ['AH']],
  ['augh', ['AA']],
  ['sch', ['SZ', 'KG']],
  ['th', ['TH']],
  ['sh', ['SH']],
  ['ch', ['SH']],
  ['ph', ['FV']],
  ['wh', ['W']],
  ['ng', ['KG']],
  ['nk', ['KG']],
  ['ck', ['KG']],
  ['qu', ['KG', 'W']],
  ['ce', ['SZ']],
  ['ci', ['SZ']],
  ['oo', ['OO']],
  ['ou', ['AH']],
  ['ow', ['OH']],
  ['oa', ['OH']],
  ['oi', ['OH', 'IH']],
  ['oy', ['OH', 'IH']],
  ['ee', ['EE']],
  ['ea', ['EE']],
  ['ey', ['EE']],
  ['ai', ['AE']],
  ['ay', ['AE']],
  ['au', ['AA']],
  ['aw', ['AA']],
  ['ar', ['AA', 'ER']],
  ['or', ['OH', 'ER']],
  ['ir', ['ER']],
  ['ur', ['ER']],
  ['er', ['ER']],
];

const SINGLE = {
  a: 'AE', e: 'EE', i: 'IH', o: 'OH', u: 'UH',
  b: 'MBP', c: 'KG', d: 'TDNL', f: 'FV', g: 'KG', h: 'HH',
  j: 'SH', k: 'KG', l: 'TDNL', m: 'MBP', n: 'TDNL', p: 'MBP',
  q: 'KG', r: 'R', s: 'SZ', t: 'TDNL', v: 'FV', w: 'W',
  x: 'KG', y: 'Y', z: 'SZ',
};

// Map one word (lowercased letters only) to a list of viseme ids.
function wordToVisemes(word) {
  const out = [];
  let i = 0;
  // Drop a single silent trailing 'e' ("make", "site") — keep "the", "be", "me".
  let w = word;
  if (w.length > 3 && w.endsWith('e') && !/[aeiou]/.test(w[w.length - 2])) {
    w = w.slice(0, -1);
  }
  while (i < w.length) {
    let matched = null;
    for (const [seq, vis] of CLUSTERS) {
      if (w.startsWith(seq, i)) {
        matched = [seq.length, vis];
        break;
      }
    }
    if (matched) {
      out.push(...matched[1]);
      i += matched[0];
      continue;
    }
    const ch = w[i];
    const v = SINGLE[ch];
    if (v) {
      // collapse doubled consonants ("ll", "tt") into one gesture
      if (out.length && out[out.length - 1] === v && !VOWELS.has(v)) {
        // skip duplicate
      } else {
        out.push(v);
      }
    }
    i += 1;
  }
  return out;
}

// Public: turn arbitrary text into a timed viseme track.
//   { speed }  multiplier on tempo (1 = normal). Higher = faster (shorter holds).
// Returns [{ v, label, word, durationMs, isWordStart }].
export function textToVisemes(text, { speed = 1, maxVisemes = 1400 } = {}) {
  const safeSpeed = Math.max(0.4, Math.min(2.5, speed));
  const track = [];
  const tokens = (text || '').toLowerCase().match(/[a-z']+|[.,;:!?—–-]+/g) || [];
  for (const tok of tokens) {
    if (/^[.,;:!?—–-]+$/.test(tok)) {
      // punctuation → a pause (longer for sentence-final marks)
      const long = /[.!?]/.test(tok);
      track.push({ v: 'rest', label: '·', word: '', durationMs: (long ? 360 : 200) / safeSpeed, isWordStart: false, isPause: true });
      continue;
    }
    const clean = tok.replace(/'/g, '');
    if (!clean) continue;
    const vis = wordToVisemes(clean);
    if (!vis.length) continue;
    vis.forEach((v, idx) => {
      track.push({
        v,
        label: VISEMES[v]?.label || '·',
        word: tok,
        durationMs: baseDuration(v) / safeSpeed,
        isWordStart: idx === 0,
      });
    });
    // brief gap between words
    track.push({ v: 'rest', label: '·', word: '', durationMs: 70 / safeSpeed, isWordStart: false, isInterword: true });
    if (track.length >= maxVisemes) break;
  }
  if (!track.length) track.push({ v: 'rest', label: '·', word: '', durationMs: 400, isWordStart: false });
  return track;
}

// Convert a target words-per-minute into a tempo multiplier for textToVisemes.
export function wpmToSpeed(wpm) {
  if (!wpm) return 1;
  return Math.max(0.5, Math.min(2, wpm / 130));
}

// Linear interpolation between two viseme geometry objects (for smooth morphing).
const GEO_KEYS = ['jaw', 'lipOpen', 'lipRound', 'lipSpread', 'tongueX', 'tongueY', 'tongueTip'];
export function lerpViseme(aId, bId, t) {
  const a = VISEMES[aId] || VISEMES.rest;
  const b = VISEMES[bId] || VISEMES.rest;
  const out = {};
  for (const k of GEO_KEYS) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    out[k] = av + (bv - av) * t;
  }
  // booleans snap at the midpoint toward the incoming viseme
  out.teethLip = (t < 0.5 ? a.teethLip : b.teethLip) || false;
  out.tipTeeth = (t < 0.5 ? a.tipTeeth : b.tipTeeth) || false;
  return out;
}
