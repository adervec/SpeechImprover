// ElevenLabs-v3-style emotive tagging for provided text: inline [tags] tell the
// reader HOW to deliver a line ([whispers], [excited], [pause], [slowly] …),
// CAPITALS mark stressed words, "…" marks a hesitation/breath.
//
// Hand-tagged drill text is authored with tags inline. Anything else (library
// passages, custom text) gets a heuristic pass from autoTag(). Plain text for
// scoring/coverage/articulation is always stripTags(text).

const TAG_RE = /\[[a-z][a-z /-]{1,24}\]/gi;

export function stripTags(text = '') {
  return text.replace(TAG_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/ ([,.;:!?…])/g, '$1').replace(/^\s+/gm, '').trim();
}

export function hasTags(text = '') {
  return TAG_RE.test(text) && ((TAG_RE.lastIndex = 0), true);
}

// Segments for rendering: [{ tag: 'whispers' } | { text: '...' }].
export function parseTagged(text = '') {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TAG_RE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ tag: m[0].slice(1, -1) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

// ---- heuristic auto-tagger for untagged text ----
// ponytail: punctuation + keyword rules, no NLP. Good enough to cue delivery on
// library passages; hand-tag anything that matters.
const LEX = [
  [/\b(whisper|hush|quiet(ly)?|silence|secret)\b/i, 'whispers'],
  [/\b(sigh(ed|s)?|weary|tired|alas)\b/i, 'sighs'],
  [/\b(laugh(ed|ing|s)?|chuckl|grin(ned)?|joke)\b/i, 'laughs'],
  [/\b(shout(ed|s)?|cried out|roar(ed)?|yell)\b/i, 'shouting'],
  [/\b(sad(ly|ness)?|wept|tears|grief|mourn)\b/i, 'sad'],
  [/\b(angry|anger|furious|rage|fury)\b/i, 'angry'],
  [/\b(afraid|fear|terror|trembl|dread)\b/i, 'nervous'],
  [/\b(gently|softly|tender|calm(ly)?|peace)\b/i, 'softly'],
  [/\b(suddenly|at once|burst|leapt|sprang)\b/i, 'excited'],
  [/\b(slowly|patien|carefully|deliberate)\b/i, 'slowly'],
  [/\b(warm(th|ly)?|smil(e|ed|ing)|kind(ly)?)\b/i, 'warmly'],
  [/\b(wonder(ed|ing)?|curious|perhaps|strange)\b/i, 'curious'],
];

export function autoTag(text = '') {
  if (!text || hasTags(text)) return text;
  const sentences = text.match(/[^.!?…]+[.!?…]+["'”’)]?\s*|[^.!?…]+$/g) || [text];
  let out = '';
  let lastTag = null;
  sentences.forEach((s, i) => {
    let tag = null;
    for (const [re, t] of LEX) if (re.test(s)) { tag = t; break; }
    if (!tag && /!/.test(s)) tag = 'excited';
    else if (!tag && /\?/.test(s)) tag = 'curious';
    else if (!tag && /…|\.\.\./.test(s)) tag = 'pause';
    else if (!tag && s.split(/\s+/).length > 28) tag = 'steady';
    else if (!tag && i === 0) tag = 'warmly';
    if (tag && tag !== lastTag) { out += `[${tag}] `; lastTag = tag; }
    out += s;
  });
  return out.trim();
}

// ElevenLabs v3 audio-tag legend shown next to the toggle.
export const TAG_LEGEND = [
  ['whispers', 'breathy, quiet, consonants forward'],
  ['softly', 'low volume, warm — not breathy'],
  ['warmly', 'smile in the voice, open vowels'],
  ['excited', 'faster, higher, brighter'],
  ['emphatic', 'stress the CAPITAL words, land the ending'],
  ['slowly', 'stretch vowels, wide pauses'],
  ['steady', 'even pace, one thought per breath'],
  ['pause', 'a beat of silence — breathe here'],
  ['sighs', 'sigh out first, then speak on the fall'],
  ['laughs', 'a real laugh before or into the words'],
  ['curious', 'lift the middle, then settle'],
  ['sad', 'lower, slower, softer edges'],
  ['angry', 'clipped consonants, hard onsets'],
  ['shouting', 'projected from the belly, not the throat'],
  ['sarcastic', 'flat pitch, drawn-out key word'],
  ['nervous', 'quicker, breath higher — then fix it'],
];

export function demo() {
  const t = '[whispers] The harbor was QUIET… [pause] nobody moved.';
  console.assert(stripTags(t) === 'The harbor was QUIET… nobody moved.', 'strip keeps caps/ellipsis: ' + stripTags(t));
  const segs = parseTagged(t);
  console.assert(segs[0].tag === 'whispers' && segs.length === 4, 'parse segments');
  const at = autoTag('It was late. Why had he come? The door burst open!');
  console.assert(/\[warmly\] It was late\. \[curious\] Why.*\[excited\] The door/.test(at), 'autoTag: ' + at);
  console.assert(autoTag(t) === t, 'already-tagged text untouched');
  console.assert(stripTags(autoTag('Hello there.')) === 'Hello there.', 'round trip');
  return at;
}
