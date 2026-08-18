// Exercise catalog distilled from the Baseline Ref guide, plus a program
// generator that targets the user's weakest attributes.
//
// modes: 'read' (provided text), 'free' (improv / unseen topic),
//        'twister' (articulation), 'breath' (warm-up), 'baseline'.

import { GENERATED_PASSAGES, PASSAGE_GENRES } from './readingPassages.generated.js';
import { TROUBLE_SOUNDS, troubleInstructions } from './troubleSounds.js';
import { DRILLS, WARMUPS } from './drillCatalog.js';
import { stripTags } from './emotive.js';

export const READING_PASSAGES = [
  {
    id: 'read-tide',
    title: 'The Turning Tide (neutral prose)',
    text: `The harbor was quiet in the early light. A single boat drifted past the breakwater, its sail catching the first warmth of the day. On the shore, the fishermen mended their nets with the patience of people who have done a thing ten thousand times. Nothing about the morning was remarkable, and yet it was the kind of ordinary that, looking back, you find yourself missing most.`,
    tagged: `[softly] The harbor was quiet in the early light. [pause] A single boat drifted past the breakwater, [pause] its sail catching the first WARMTH of the day. [warmly] On the shore, the fishermen mended their nets with the patience of people who have done a thing ten THOUSAND times. [pause] [slowly] Nothing about the morning was remarkable, [pause] and yet it was the kind of ordinary that, [pause] looking back, [pause] you find yourself missing MOST.`,
  },
  {
    id: 'read-engine',
    title: 'How an Engine Works (explanatory)',
    text: `An internal combustion engine converts fuel into motion through a series of controlled explosions. Air and fuel are drawn into a cylinder, compressed by a rising piston, and ignited by a spark. The force of that ignition drives the piston down, turning the crankshaft, which ultimately turns the wheels. The same cycle repeats thousands of times each minute, quietly and reliably, beneath the hood.`,
    tagged: `[steady] An internal combustion engine converts fuel into motion [pause] through a series of controlled EXPLOSIONS. [pause] Air and fuel are drawn into a cylinder, [pause] compressed by a rising piston, [pause] and ignited by a SPARK. [emphatic] The force of that ignition drives the piston DOWN, [pause] turning the crankshaft, [pause] which ultimately turns the wheels. [warmly] The same cycle repeats thousands of times each minute, [pause] quietly and reliably, [pause] beneath the hood.`,
  },
  {
    id: 'read-news',
    title: 'Civic Notice (news register)',
    text: `City officials announced on Tuesday that the renovation of the central library will begin next month and is expected to last through the autumn. During construction, the main reading room will close, but a temporary branch in the community center will keep most services available. Residents are encouraged to return borrowed materials before the transition to avoid delays.`,
    tagged: `[steady] City officials announced on Tuesday [pause] that the renovation of the central library will begin next MONTH [pause] and is expected to last through the autumn. [pause] During construction, the main reading room will CLOSE, [pause] but a temporary branch in the community center will keep most services available. [emphatic] Residents are encouraged to return borrowed materials BEFORE the transition [pause] to avoid delays.`,
  },
];

// The 3 hand-written passages above seed the exercise-library cards and the
// baseline set. For the Practice passage picker we offer a much larger browsable
// corpus: those 3 (filed as "Featured") plus a public-domain library scraped
// from Project Gutenberg (see scripts/scrape-passages.mjs).
const FEATURED_PASSAGES = READING_PASSAGES.map((p) => ({
  ...p,
  genre: 'featured',
  author: null,
  source: null,
}));

export const READING_LIBRARY = [...FEATURED_PASSAGES, ...GENERATED_PASSAGES];

export const PASSAGE_LIBRARY_MAP = Object.fromEntries(
  READING_LIBRARY.map((p) => [p.id, p])
);

// Short, word-boundary-trimmed preview of a passage for menu labels.
function passageSnippet(text, max = 64) {
  const s = text.replace(/\s+/g, ' ').replace(/^["'“”‘’]+/, '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 30 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, '')}…`;
}

// A unique, browsable label for each passage in the picker. The scraped
// passages share "Book — Author" titles, so we lead with an opening snippet.
export function passageLabel(p) {
  if (p.genre === 'featured') return p.title;
  return `“${passageSnippet(p.text)}” — ${p.author}`;
}

// Grouped for <optgroup> rendering: Featured first, then each scraped genre.
const GROUP_LABELS = { featured: 'Featured', ...PASSAGE_GENRES };
export const PASSAGE_GROUPS = Object.keys(GROUP_LABELS)
  .map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: READING_LIBRARY.filter((p) => p.genre === key),
  }))
  .filter((g) => g.items.length);

export const FREE_PROMPTS = [
  'Describe your morning, from waking up to leaving the house, in as much detail as you can.',
  'Explain something you understand well to someone who has never heard of it.',
  'Tell the story of the best meal you have ever had.',
  'Argue for or against the idea that mornings are better than evenings.',
  'Improv: you are a tour guide for a city that does not exist. Describe its main square.',
  'Describe a place you would like to visit and why it appeals to you.',
  'Tell a story about a time something went wrong and turned out fine.',
  'Describe your ideal weekend, hour by hour, without using the word “relax”.',
  'Pitch an invention that solves a tiny everyday annoyance.',
  'Explain a rule of etiquette you think should be abolished — and one that should be enforced.',
  'Describe the view from a window you know well, in the present tense.',
  'Give a two-minute review of the last thing you watched or listened to.',
  'Improv: you are a weather forecaster on a planet with three suns. Give tomorrow’s forecast.',
  'Talk about a skill you learned as an adult and what surprised you about learning it.',
  'Describe a person who influenced you, without saying their name or job.',
  'Argue that a specific mundane object (a spoon, a doorstop, a paperclip) is the greatest invention ever.',
  'Tell the story of your name — where it came from, what you think of it.',
  'Explain how you would spend a day in your town if you were a tourist.',
  'Improv: narrate a nature documentary about the contents of your kitchen drawer.',
  'Describe a smell that takes you straight back to childhood, and where it takes you.',
];

export const INTERVIEW_PROMPTS = [
  'Tell me about a time you solved a difficult problem at work.',
  'Why should we choose you over other candidates?',
  'Walk me through your greatest professional achievement.',
  'Describe a situation where you disagreed with a decision and what you did.',
  'Tell me about a time you failed. What did you learn?',
  'How do you handle a colleague who is not pulling their weight?',
  'Where do you see yourself in five years?',
  'Describe a time you had to learn something quickly under pressure.',
  'What is a piece of feedback you received that changed how you work?',
  'Tell me about a project you are proud of and your specific role in it.',
  'How do you prioritise when everything is urgent?',
  'Explain a complex idea from your field to a non-expert in ninety seconds.',
  'You have thirty seconds in a lift with the CEO. Go.',
  'Convince me to fund your idea — you have one minute.',
];

export const TONGUE_TWISTERS = [
  { id: 'tw-s', sound: 'S / sh', text: 'She sells seashells by the seashore.', attr: 'clarity' },
  { id: 'tw-r', sound: 'R', text: 'Round the rugged rocks the ragged rascal ran.', attr: 'clarity' },
  { id: 'tw-td', sound: 'T / D crispness', text: 'Red leather, yellow leather. Red leather, yellow leather.', attr: 'clarity' },
  { id: 'tw-pb', sound: 'P / B / breath', text: 'Peter Piper picked a peck of pickled peppers.', attr: 'projection' },
  { id: 'tw-l', sound: 'L / vowels', text: 'Truly rural; willingly we walk.', attr: 'clarity' },
  { id: 'tw-pace', sound: 'Pace control', text: 'A proper copper coffee pot — slow and even.', attr: 'pace' },
];

// The full catalog. Each exercise declares the attributes it most helps.
export const EXERCISES = [
  // --- warm-up pool (guide §3) — rotated into programs ---
  ...WARMUPS.map((w) => ({
    id: w.id,
    title: w.title,
    category: 'Warm-up',
    mode: 'breath',
    durationSec: 45,
    targetAttributes: w.attrs,
    guideSection: '03 · Warm-up',
    instructions: w.instructions,
    prompt: w.prompt,
  })),
  // --- articulation (guide §3) ---
  ...TONGUE_TWISTERS.map((t) => ({
    id: `art-${t.id}`,
    title: `Tongue twister — ${t.sound}`,
    category: 'Articulation',
    mode: 'twister',
    durationSec: 40,
    targetAttributes: [t.attr],
    guideSection: '03 · Articulation',
    instructions:
      'Say it slowly first, prioritizing precision over speed, then a little faster. Over-articulate every consonant.',
    prompt: t.text,
  })),
  {
    id: 'art-overarticulate',
    title: 'Over-articulation drill',
    category: 'Articulation',
    mode: 'read',
    durationSec: 40,
    targetAttributes: ['clarity'],
    guideSection: '04 · Clarity & articulation',
    instructions:
      'Read the line exaggerating every consonant and finishing each word ending (-t, -d, -ing). Then say it again normally.',
    prompt:
      'The bright kite lifted lightly, drifting past the distant rooftops at sunset.',
    taggedPrompt: '[emphatic] The BRIGHT KITE lifted LIGHTLY, [pause] drifting past the distant rooftops [pause] at SUNSET.',
  },
  // --- trouble sounds (targeted phoneme drills) ---
  ...TROUBLE_SOUNDS.map((t) => ({
    id: `trouble-${t.id}`,
    title: `Trouble sound — ${t.label}`,
    category: 'Trouble sounds',
    mode: 'twister',
    durationSec: 40,
    targetAttributes: ['clarity'],
    guideSection: '04 · Clarity & articulation',
    instructions: troubleInstructions(t),
    prompt: t.prompt,
    troubleSound: t.id,
    ipa: t.ipa,
  })),
  // --- core drills (guide §3/§4) ---
  ...READING_PASSAGES.map((p) => ({
    id: `core-${p.id}`,
    title: `Read aloud — ${p.title}`,
    category: 'Reading',
    mode: 'read',
    durationSec: 60,
    targetAttributes: ['pace', 'clarity', 'projection', 'noUptalk'],
    guideSection: '02 · Reading aloud',
    instructions:
      'Read at a deliberate, even pace. Pause at commas and periods — silence reads as confidence. Let statements fall at the end.',
    prompt: p.text,
    taggedPrompt: p.tagged,
  })),
  ...FREE_PROMPTS.map((p, i) => ({
    id: `free-${i}`,
    title: 'Free speaking',
    category: 'Free / improv',
    mode: 'free',
    durationSec: 90,
    targetAttributes: ['fillers', 'nonRepetition', 'pace', 'expressiveness'],
    guideSection: '02 · Free speech',
    instructions:
      'Speak unscripted for up to 90 seconds. Replace fillers with brief silent pauses. Vary your pitch to keep it lively.',
    prompt: p,
  })),
  ...INTERVIEW_PROMPTS.map((p, i) => ({
    id: `interview-${i}`,
    title: 'High-pressure simulation',
    category: 'High-pressure',
    mode: 'free',
    durationSec: 90,
    targetAttributes: ['fillers', 'pace', 'projection', 'noUptalk'],
    guideSection: '02 · High-pressure simulation',
    instructions:
      'Answer as if in a real interview. Slow down deliberately — nerves speed everyone up. Anchor on one slow breath before you start.',
    prompt: p,
  })),
  {
    id: 'expr-story',
    title: 'Expressive read-aloud',
    category: 'Reading',
    mode: 'read',
    durationSec: 60,
    targetAttributes: ['expressiveness', 'projection'],
    guideSection: '04 · Tone & expressiveness',
    instructions:
      "Read with full expression, as if to a child. Let your pitch rise and fall to expand your range. Don't be afraid to over-do it.",
    prompt:
      'Once upon a time, in a kingdom high above the clouds, there lived a very SMALL dragon with a very BIG voice — and oh, how that voice could ROAR!',
    taggedPrompt: '[warmly] Once upon a time, [pause] in a kingdom HIGH above the clouds, [pause] there lived a very SMALL dragon [pause] with a very BIG voice — [excited] and OH, [pause] how that voice could ROAR!',
  },
  // --- targeted drill sets: one rich set per attribute (drillCatalog.js) ---
  ...DRILLS.map((d) => ({
    id: d.id,
    title: d.title,
    category: 'Targeted',
    focus: d.attr,
    mode: d.mode,
    durationSec: d.durationSec,
    targetAttributes: [d.attr],
    guideSection: '04 · Targeted drills',
    instructions: d.instructions,
    prompt: stripTags(d.variants[0]),
    taggedPrompt: d.variants[0],
    variants: d.variants,
  })),
];

// --- baseline capture set (guide §2) ---
export const BASELINE_SET = [
  {
    id: 'baseline-read',
    title: 'Baseline 1 — Reading aloud',
    category: 'Baseline',
    mode: 'read',
    durationSec: 60,
    targetAttributes: ['pace', 'clarity', 'projection'],
    guideSection: '02 · Baseline',
    instructions: 'Read this unfamiliar passage at a natural pace.',
    prompt: READING_PASSAGES[0].text,
    taggedPrompt: READING_PASSAGES[0].tagged,
    type: 'baseline',
  },
  {
    id: 'baseline-free',
    title: 'Baseline 2 — Free speech',
    category: 'Baseline',
    mode: 'free',
    durationSec: 120,
    targetAttributes: ['fillers', 'nonRepetition', 'expressiveness'],
    guideSection: '02 · Baseline',
    instructions: 'Talk for two minutes about your day or a topic you like, unscripted.',
    prompt: FREE_PROMPTS[0],
    type: 'baseline',
  },
  {
    id: 'baseline-pressure',
    title: 'Baseline 3 — High-pressure',
    category: 'Baseline',
    mode: 'free',
    durationSec: 90,
    targetAttributes: ['fillers', 'pace', 'projection'],
    guideSection: '02 · Baseline',
    instructions: 'Answer this mock interview question as if it were real.',
    prompt: INTERVIEW_PROMPTS[0],
    type: 'baseline',
  },
];

export const EXERCISE_MAP = Object.fromEntries(
  [...EXERCISES, ...BASELINE_SET].map((e) => [e.id, e])
);

export function getExercise(id) {
  return EXERCISE_MAP[id];
}

export const CATEGORIES = [
  'Warm-up',
  'Articulation',
  'Trouble sounds',
  'Reading',
  'Free / improv',
  'High-pressure',
  'Targeted',
  'Baseline',
];

// ---- anti-repetition ----
// Recency of each exercise id / prompt text from the session log (newest wins).
export function recencyIndex(sessions = []) {
  const byId = new Map();
  const byPrompt = new Map();
  for (const s of sessions) {
    const t = new Date(s.createdAt).getTime();
    if (s.exerciseId && (byId.get(s.exerciseId) || 0) < t) byId.set(s.exerciseId, t);
    const key = (s.prompt || '').trim();
    if (key && (byPrompt.get(key) || 0) < t) byPrompt.set(key, t);
  }
  return { byId, byPrompt };
}

// Least-recently-used pick from a list (never-used first; ties broken randomly).
export function leastRecent(items, lastSeen /* item -> ts|undefined */) {
  if (!items.length) return null;
  const scored = items.map((it) => ({ it, t: lastSeen(it) || 0, r: Math.random() }));
  scored.sort((a, b) => a.t - b.t || a.r - b.r);
  return scored[0].it;
}

// Resolve which variant of an exercise to show: the one recorded longest ago
// (or never). Returns a shallow copy with prompt/taggedPrompt set.
export function withFreshVariant(ex, sessions = [], idx = null) {
  if (!ex?.variants?.length) return ex;
  const { byPrompt } = idx || recencyIndex(sessions);
  const v = leastRecent(ex.variants, (t) => byPrompt.get(stripTags(t)));
  return { ...ex, prompt: stripTags(v), taggedPrompt: v, variantIndex: ex.variants.indexOf(v) };
}

// Free-speaking prompt the user has done least recently.
export function freshPrompt(list, sessions = []) {
  const { byPrompt } = recencyIndex(sessions);
  return leastRecent(list, (p) => byPrompt.get(p)) || list[0];
}

// Pick the exercise for an attribute that the user has done least recently
// (never-done first), skipping anything already in this program.
function pickForAttribute(attrKey, used, idx, filter = () => true) {
  const candidates = EXERCISES.filter(
    (e) => e.targetAttributes.includes(attrKey) && !used.has(e.id) && filter(e)
  );
  const choice = leastRecent(candidates, (e) => idx.byId.get(e.id));
  if (choice) used.add(choice.id);
  return choice;
}

// Build a 12-minute-routine-shaped program targeting the two weakest attributes
// (guide §3 daily system: warm-up → articulation → core drill → capture).
// Everything is least-recently-done first, so consecutive programs rotate
// through the catalog instead of repeating.
export function generateProgram(weakAttributes = [], sessions = []) {
  const used = new Set();
  const program = [];
  const idx = recencyIndex(sessions);

  // Warm-up ×2 from the pool, least recent first
  const warmups = EXERCISES.filter((e) => e.category === 'Warm-up');
  for (let i = 0; i < 2; i++) {
    const w = leastRecent(warmups.filter((e) => !used.has(e.id)), (e) => idx.byId.get(e.id));
    if (w) { used.add(w.id); program.push(w); }
  }

  // Articulation
  const artTwister =
    pickForAttribute('clarity', used, idx, (e) => e.category === 'Articulation' || e.category === 'Trouble sounds') || EXERCISE_MAP['art-tw-s'];
  if (artTwister) program.push(artTwister);

  // Core drills targeting the weakest attributes — prefer the targeted sets.
  const targets = weakAttributes.length ? weakAttributes.slice(0, 2) : ['fillers', 'pace'];
  for (const t of targets) {
    const ex = pickForAttribute(t, used, idx, (e) => e.category === 'Targeted') || pickForAttribute(t, used, idx);
    if (ex) program.push(withFreshVariant(ex, sessions, idx));
  }
  // Ensure at least one free-speak drill for transfer.
  if (!program.some((e) => e.mode === 'free')) {
    const free = pickForAttribute('fillers', used, idx, (e) => e.mode === 'free');
    if (free) program.push(withFreshVariant(free, sessions, idx));
  }

  // Capture
  program.push({
    ...EXERCISE_MAP['baseline-free'],
    prompt: freshPrompt(FREE_PROMPTS, sessions),
    id: 'capture-free',
    title: 'Cool-down capture',
    category: 'Capture',
    durationSec: 45,
    instructions: 'Record 30–60s of free speech applying today’s targets. This is your daily capture.',
    type: 'practice',
  });

  return program.filter(Boolean);
}

// Suggest one "next" drill after a standalone exercise: the exercise targeting the
// user's weakest attribute that they have done least recently (never first),
// skipping the one just done. Deterministic (catalog order breaks ties) so the
// suggestion is stable across re-renders.
export function suggestNextExercise(weakKeys = [], excludeId = null, sessions = []) {
  const { byId } = recencyIndex(sessions);
  const targets = weakKeys.length ? weakKeys : ['fillers', 'pace'];
  const pool = EXERCISES.filter((e) => e.id !== excludeId && e.category !== 'Warm-up');
  for (const k of targets) {
    const cands = pool.filter((e) => e.targetAttributes.includes(k));
    if (!cands.length) continue;
    // prefer targeted sets, then anything; least-recent wins, ties by catalog order
    const ranked = cands
      .map((e, i) => ({ e, i, t: byId.get(e.id) || 0, targeted: e.category === 'Targeted' ? 0 : 1 }))
      .sort((x, y) => x.t - y.t || x.targeted - y.targeted || x.i - y.i);
    return ranked[0].e;
  }
  return pool[0] || null;
}

export function demo() {
  const now = new Date().toISOString();
  const drill = EXERCISES.find((e) => e.id === 'drill-pace-metronome');
  const fresh = withFreshVariant(drill, [{ createdAt: now, exerciseId: drill.id, prompt: drill.prompt }]);
  console.assert(fresh.variantIndex !== 0 && !/\[/.test(fresh.prompt) && /\[/.test(fresh.taggedPrompt), 'variant rotates away from the one just done; prompt is plain');
  const prog = generateProgram(['resonantDepth'], [{ createdAt: now, exerciseId: 'warm-breath' }, { createdAt: now, exerciseId: 'warm-hum' }]);
  console.assert(!prog.slice(0, 2).some((e) => e.id === 'warm-breath' || e.id === 'warm-hum'), 'warm-ups rotate: ' + prog.slice(0, 2).map((e) => e.id));
  console.assert(prog.some((e) => e.category === 'Targeted' && e.targetAttributes[0] === 'resonantDepth'), 'program uses the targeted depth set');
  console.assert(freshPrompt(['a', 'b'], [{ createdAt: now, prompt: 'a' }]) === 'b', 'fresh prompt skips recent');
  const a = suggestNextExercise(['fillers'], 'free-0', [{ createdAt: now, exerciseId: 'free-0' }]);
  console.assert(a && a.id !== 'free-0' && a.targetAttributes.includes('fillers'), 'targets weakest, skips excluded');
  const b = suggestNextExercise(['fillers'], null, [{ createdAt: now, exerciseId: a.id }]);
  console.assert(b.id !== a.id, 'rotates away from the just-suggested drill');
  console.assert(suggestNextExercise(['fillers'], null, []).id === suggestNextExercise(['fillers'], null, []).id, 'deterministic');
  console.assert(!!suggestNextExercise([], null, []), 'always returns a suggestion');
  console.assert(!!suggestNextExercise(['not-an-attr'], null, []), 'unknown attr falls back to pool');
  return a;
}
