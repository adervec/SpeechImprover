// Exercise catalog distilled from the Baseline Ref guide, plus a program
// generator that targets the user's weakest attributes.
//
// modes: 'read' (provided text), 'free' (improv / unseen topic),
//        'twister' (articulation), 'breath' (warm-up), 'baseline'.

import { GENERATED_PASSAGES, PASSAGE_GENRES } from './readingPassages.generated.js';

export const READING_PASSAGES = [
  {
    id: 'read-tide',
    title: 'The Turning Tide (neutral prose)',
    text: `The harbor was quiet in the early light. A single boat drifted past the breakwater, its sail catching the first warmth of the day. On the shore, the fishermen mended their nets with the patience of people who have done a thing ten thousand times. Nothing about the morning was remarkable, and yet it was the kind of ordinary that, looking back, you find yourself missing most.`,
  },
  {
    id: 'read-engine',
    title: 'How an Engine Works (explanatory)',
    text: `An internal combustion engine converts fuel into motion through a series of controlled explosions. Air and fuel are drawn into a cylinder, compressed by a rising piston, and ignited by a spark. The force of that ignition drives the piston down, turning the crankshaft, which ultimately turns the wheels. The same cycle repeats thousands of times each minute, quietly and reliably, beneath the hood.`,
  },
  {
    id: 'read-news',
    title: 'Civic Notice (news register)',
    text: `City officials announced on Tuesday that the renovation of the central library will begin next month and is expected to last through the autumn. During construction, the main reading room will close, but a temporary branch in the community center will keep most services available. Residents are encouraged to return borrowed materials before the transition to avoid delays.`,
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
  const s = text.replace(/^["'“”‘’]+/, '').trim();
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
];

export const INTERVIEW_PROMPTS = [
  'Tell me about a time you solved a difficult problem at work.',
  'Why should we choose you over other candidates?',
  'Walk me through your greatest professional achievement.',
  'Describe a situation where you disagreed with a decision and what you did.',
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
  // --- warm-up (guide §3) ---
  {
    id: 'warm-breath',
    title: 'Breath support warm-up',
    category: 'Warm-up',
    mode: 'breath',
    durationSec: 45,
    targetAttributes: ['breath', 'projection'],
    guideSection: '03 · Warm-up',
    instructions:
      'Take 5 slow breaths into your belly (not your shoulders). On each exhale, make a steady "sss" for as long as is comfortable. Record the final two exhales.',
    prompt: 'Sssssss… (steady exhale) — repeat for two breaths.',
  },
  {
    id: 'warm-hum',
    title: 'Humming & resonance',
    category: 'Warm-up',
    mode: 'breath',
    durationSec: 45,
    targetAttributes: ['resonantDepth', 'nonNasal'],
    guideSection: '03 · Warm-up',
    instructions:
      'Hum gently up and down your comfortable pitch range to wake up resonance. Keep it relaxed — never strained.',
    prompt: 'Hmmmm — glide gently up, then down, a few times.',
  },
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
  },
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
  },
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
  'Reading',
  'Free / improv',
  'High-pressure',
  'Baseline',
];

// Pick one exercise that best targets a given attribute key.
function pickForAttribute(attrKey, used) {
  const candidates = EXERCISES.filter(
    (e) => e.targetAttributes.includes(attrKey) && !used.has(e.id)
  );
  if (!candidates.length) return null;
  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  used.add(choice.id);
  return choice;
}

// Build a 12-minute-routine-shaped program targeting the two weakest attributes
// (guide §3 daily system: warm-up → articulation → core drill → capture).
export function generateProgram(weakAttributes = []) {
  const used = new Set();
  const program = [];

  // Warm-up
  program.push(EXERCISE_MAP['warm-breath']);
  program.push(EXERCISE_MAP['warm-hum']);
  used.add('warm-breath');
  used.add('warm-hum');

  // Articulation
  const artTwister =
    pickForAttribute('clarity', used) || EXERCISE_MAP['art-tw-s'];
  if (artTwister) program.push(artTwister);

  // Core drills targeting the weakest attributes
  const targets = weakAttributes.length ? weakAttributes.slice(0, 2) : ['fillers', 'pace'];
  for (const t of targets) {
    const ex = pickForAttribute(t, used);
    if (ex) program.push(ex);
  }
  // Ensure at least one free-speak drill for transfer.
  if (!program.some((e) => e.mode === 'free')) {
    const free = pickForAttribute('fillers', used);
    if (free) program.push(free);
  }

  // Capture
  program.push({
    ...EXERCISE_MAP['baseline-free'],
    id: 'capture-free',
    title: 'Cool-down capture',
    category: 'Capture',
    durationSec: 45,
    instructions: 'Record 30–60s of free speech applying today’s targets. This is your daily capture.',
    type: 'practice',
  });

  return program.filter(Boolean);
}
