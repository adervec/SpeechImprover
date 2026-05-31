// Turns a transcript into per-word annotations marking what went well and what
// didn't, at three detail levels. For "read" exercises it aligns the transcript
// against the passage (Needleman–Wunsch) to surface misreads, skips and extra
// words; for every mode it flags fillers and repetitions.

const HARD_FILLERS = new Set(['um', 'uh', 'umm', 'uhh', 'uhm', 'er', 'erm', 'ah', 'eh', 'hmm', 'mm', 'mhm']);
const SOFT_FILLERS = new Set(['like', 'so', 'actually', 'basically', 'literally', 'right', 'okay', 'well', 'totally', 'seriously']);
const SOFT_PHRASES = ['you know', 'i mean', 'sort of', 'kind of', 'you see', 'or something'];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at',
  'for', 'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'me', 'my', 'your', 'his', 'her', 'our', 'their', 'them', 'do', 'does',
  'did', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should',
  'not', 'no', 'yes', 'there', 'here', 'then', 'than', 'about', 'just', 'up',
  'out', 'all', 'one', 'what', 'when', 'who', 'how', 'from', 'by', 'so',
]);

const norm = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
const isContent = (w) => w.length > 3 && !STOPWORDS.has(w);

// Split text into rendered tokens, keeping original spelling/punctuation.
function tokenize(text) {
  const out = [];
  const re = /[A-Za-z']+|[^A-Za-z'\s]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const n = norm(raw);
    out.push({ raw, norm: n, isWord: /[a-z]/.test(n) });
  }
  return out;
}

// Needleman–Wunsch alignment over two normalized word arrays.
function align(a, b) {
  const n = a.length;
  const m = b.length;
  const MATCH = 2;
  const MIS = -1;
  const GAP = -1;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i += 1) dp[i][0] = i * GAP;
  for (let j = 1; j <= m; j += 1) dp[0][j] = j * GAP;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const s = a[i - 1] === b[j - 1] ? MATCH : MIS;
      dp[i][j] = Math.max(dp[i - 1][j - 1] + s, dp[i - 1][j] + GAP, dp[i][j - 1] + GAP);
    }
  }
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? MATCH : MIS)) {
      ops.push({ op: a[i - 1] === b[j - 1] ? 'match' : 'sub', ai: i - 1, bj: j - 1 });
      i -= 1; j -= 1;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + GAP) {
      ops.push({ op: 'del', ai: i - 1 });
      i -= 1;
    } else {
      ops.push({ op: 'ins', bj: j - 1 });
      j -= 1;
    }
  }
  ops.reverse();
  return ops;
}

export const DETAIL_LEVELS = [
  { key: 'summary', label: 'Summary', hint: 'just the essentials' },
  { key: 'detailed', label: 'Detailed', hint: 'fillers, repeats & misreads' },
  { key: 'granular', label: 'Granular', hint: 'every word marked' },
];

// Which kinds are visible (vs rendered as plain text) at each level.
const VISIBLE = {
  summary: new Set(['fillerHard', 'misread', 'omission']),
  detailed: new Set(['fillerHard', 'fillerSoft', 'misread', 'omission', 'extra', 'repeat']),
  granular: new Set(['fillerHard', 'fillerSoft', 'misread', 'omission', 'extra', 'repeat', 'overused', 'good']),
};

export function kindVisibleAt(kind, level) {
  return VISIBLE[level]?.has(kind) ? kind : 'neutral';
}

// Group kinds for the legend / colors.
export const KIND_META = {
  good: { label: 'On target', cls: 'tok-good' },
  fillerHard: { label: 'Filler', cls: 'tok-filler' },
  fillerSoft: { label: 'Filler word', cls: 'tok-filler-soft' },
  repeat: { label: 'Repeat', cls: 'tok-repeat' },
  overused: { label: 'Over-used', cls: 'tok-overused' },
  misread: { label: 'Misread', cls: 'tok-misread' },
  extra: { label: 'Extra word', cls: 'tok-extra' },
  omission: { label: 'Skipped', cls: 'tok-omission' },
  neutral: { label: '', cls: '' },
};

export function annotateTranscript({ transcript = '', prompt = '', mode = 'free' } = {}) {
  const tTokens = tokenize(transcript);
  const tWords = tTokens.filter((t) => t.isWord);
  if (!tWords.length) {
    return { tokens: [], stats: { words: 0 }, hasReference: false };
  }

  const useRef = mode === 'read' && prompt.trim().length > 0;
  const freq = {};
  for (const t of tWords) freq[t.norm] = (freq[t.norm] || 0) + 1;

  // base kind per transcript word index (bj)
  const baseKind = new Array(tWords.length).fill(useRef ? 'extra' : 'neutral');
  const expectedFor = {};
  const omissions = []; // { afterBj, expected }
  let matches = 0;

  if (useRef) {
    const pTokens = tokenize(prompt).filter((t) => t.isWord);
    const a = pTokens.map((t) => t.norm);
    const b = tWords.map((t) => t.norm);
    const ops = align(a, b);
    let lastBj = -1;
    for (const o of ops) {
      if (o.op === 'match') { baseKind[o.bj] = 'good'; matches += 1; lastBj = o.bj; }
      else if (o.op === 'sub') { baseKind[o.bj] = 'misread'; expectedFor[o.bj] = pTokens[o.ai].raw; lastBj = o.bj; }
      else if (o.op === 'ins') { baseKind[o.bj] = 'extra'; lastBj = o.bj; }
      else if (o.op === 'del') { omissions.push({ afterBj: lastBj, expected: pTokens[o.ai].raw }); }
    }
  } else {
    for (let k = 0; k < tWords.length; k += 1) {
      baseKind[k] = isContent(tWords[k].norm) ? 'good' : 'neutral';
    }
  }

  // soft filler phrases (multi-word) → mark the involved word indices
  const phraseHit = new Set();
  for (let k = 0; k < tWords.length - 1; k += 1) {
    const two = `${tWords[k].norm} ${tWords[k + 1].norm}`;
    if (SOFT_PHRASES.includes(two)) { phraseHit.add(k); phraseHit.add(k + 1); }
  }

  // Resolve a final kind per transcript word, then weave in omission markers.
  const counts = {};
  const bump = (kind) => { counts[kind] = (counts[kind] || 0) + 1; };
  const wordKinds = tWords.map((t, k) => {
    let kind = baseKind[k];
    let note = '';
    let expected = expectedFor[k];
    const prev = k > 0 ? tWords[k - 1].norm : '';

    // In read mode the words come from the passage, so soft fillers / over-used
    // words that legitimately appear in the text aren't the reader's fault — only
    // flag those for free speech (or for words that aren't part of the passage).
    if (HARD_FILLERS.has(t.norm) && (!useRef || kind !== 'good')) {
      kind = 'fillerHard';
      note = 'Filler — replace with a brief silent pause.';
    } else if (kind !== 'misread' && prev && t.norm === prev && t.norm.length > 1) {
      kind = 'repeat';
      note = 'Repeated word — a false start or stumble.';
    } else if (kind !== 'misread' && (!useRef || kind === 'extra') && (SOFT_FILLERS.has(t.norm) || phraseHit.has(k))) {
      kind = 'fillerSoft';
      note = 'Filler word — usually trimmable.';
    } else if (!useRef && (kind === 'good' || kind === 'neutral') && freq[t.norm] >= 4 && isContent(t.norm)) {
      kind = 'overused';
      note = `Used ${freq[t.norm]} times — vary your wording.`;
    } else if (kind === 'misread') {
      note = `You said “${t.raw}” — the passage reads “${expected}”.`;
    } else if (kind === 'extra') {
      note = 'Extra word — not in the passage.';
    } else if (kind === 'good') {
      note = useRef ? 'Matches the passage.' : 'Clear, varied word.';
    }
    bump(kind);
    return { kind, note, expected };
  });

  // Build the final ordered token stream (interleave original punctuation/spacing
  // tokens and omission placeholders at the right positions).
  const tokens = [];
  const omissionAfter = {};
  for (const om of omissions) omissionAfter[om.afterBj] = (omissionAfter[om.afterBj] || []).concat(om.expected);

  // leading omissions (before any word)
  if (omissionAfter[-1]) {
    for (const exp of omissionAfter[-1]) { tokens.push({ text: exp, kind: 'omission', note: `Skipped “${exp}”.` }); bump('omission'); }
  }

  let wi = -1; // index into tWords
  for (const tk of tTokens) {
    if (tk.isWord) {
      wi += 1;
      const wk = wordKinds[wi];
      tokens.push({ text: tk.raw, kind: wk.kind, note: wk.note, expected: wk.expected });
      if (omissionAfter[wi]) {
        for (const exp of omissionAfter[wi]) { tokens.push({ text: exp, kind: 'omission', note: `Skipped “${exp}”.` }); bump('omission'); }
      }
    } else {
      tokens.push({ text: tk.raw, kind: 'punct' });
    }
  }

  const stats = {
    words: tWords.length,
    matches,
    accuracy: useRef ? Math.round((matches / Math.max(1, tWords.length + omissions.length - (counts.extra || 0))) * 100) : null,
    fillers: (counts.fillerHard || 0) + (counts.fillerSoft || 0),
    repeats: counts.repeat || 0,
    misreads: counts.misread || 0,
    omissions: omissions.length,
    extras: counts.extra || 0,
    overused: counts.overused || 0,
    counts,
  };

  return { tokens, stats, hasReference: useRef };
}
