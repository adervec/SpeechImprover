// Transcript-derived metrics: pace (WPM), filler economy, vocabulary richness.
// English-only. Operates on the Web Speech API transcript (or a pasted transcript).

// Single-word fillers and multi-word filler phrases.
const FILLER_WORDS = [
  'um',
  'uh',
  'umm',
  'uhh',
  'er',
  'erm',
  'ah',
  'hmm',
  'like',
  'so',
  'actually',
  'basically',
  'literally',
  'right',
  'okay',
  'mean', // from "i mean"
];
const FILLER_PHRASES = ['you know', 'i mean', 'sort of', 'kind of', 'you see'];

// Very common words excluded from "over-used content word" detection.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at',
  'for', 'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'me', 'my', 'your', 'his', 'her', 'our', 'their', 'them', 'do', 'does',
  'did', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should',
  'not', 'no', 'yes', 'there', 'here', 'then', 'than', 'about', 'just', 'up',
  'out', 'all', 'one', 'what', 'when', 'who', 'how', 'from', 'by', 'so',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Pace over time from recognizer segment marks ([{ t: end sec, words }]).
// Segments shorter than minSec are merged forward so one quick burst doesn't
// read as 400 wpm. Returns { points: [{ t, wpm }], variation: CV % } or null.
// ponytail: segment end times only (Web Speech has no word timings); the first
// window includes any lead-in silence.
export function paceTimeline(marks = [], minSec = 3) {
  const points = [];
  let prevT = 0;
  let words = 0;
  for (const m of marks) {
    words += m.words;
    if (m.t - prevT >= minSec) {
      points.push({ t: m.t, wpm: Math.round((words / (m.t - prevT)) * 60) });
      prevT = m.t;
      words = 0;
    }
  }
  if (points.length < 2) return null;
  const vals = points.map((p) => p.wpm);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, v) => a + (v - avg) ** 2, 0) / vals.length);
  return { points, variation: Math.round((sd / avg) * 100) };
}

export function analyzeTranscript(transcript, durationSec) {
  const words = tokenize(transcript);
  const wordCount = words.length;
  const minutes = Math.max(durationSec / 60, 1 / 60);
  const wpm = wordCount / minutes;

  // Filler counting.
  const fillerCounts = {};
  let fillerTotal = 0;
  for (const w of words) {
    if (FILLER_WORDS.includes(w)) {
      fillerCounts[w] = (fillerCounts[w] || 0) + 1;
      fillerTotal += 1;
    }
  }
  const lower = ` ${(transcript || '').toLowerCase()} `;
  for (const phrase of FILLER_PHRASES) {
    const matches = lower.split(phrase).length - 1;
    if (matches > 0) {
      fillerCounts[phrase] = (fillerCounts[phrase] || 0) + matches;
      fillerTotal += matches;
    }
  }
  const fillersPerMin = fillerTotal / minutes;

  // Vocabulary richness: type-token ratio + most over-used content word.
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const uniqueCount = Object.keys(freq).length;
  const typeTokenRatio = wordCount ? uniqueCount / wordCount : 0;

  const contentWords = Object.entries(freq)
    .filter(([w]) => !STOPWORDS.has(w) && w.length > 2 && !FILLER_WORDS.includes(w))
    .sort((a, b) => b[1] - a[1]);
  const topRepeats = contentWords.slice(0, 5).filter(([, c]) => c > 1);
  const maxContentRepeat = topRepeats.length ? topRepeats[0][1] : 0;

  // Adjacent repeated bigrams ("the the", "and and and").
  let stutterRepeats = 0;
  for (let i = 1; i < words.length; i += 1) {
    if (words[i] === words[i - 1]) stutterRepeats += 1;
  }

  return {
    wordCount,
    wpm,
    fillerTotal,
    fillersPerMin,
    fillerCounts,
    typeTokenRatio,
    uniqueCount,
    topRepeats: topRepeats.map(([w, c]) => ({ word: w, count: c })),
    maxContentRepeat,
    stutterRepeats,
  };
}

// How much of a provided text has been read aloud: fraction of the prompt's words
// found in order in the transcript (greedy, small look-ahead window so recognition
// substitutions/insertions don't derail the alignment). Powers auto-submit.
export function readingCoverage(promptText, transcript) {
  const p = tokenize(promptText);
  const t = tokenize(transcript);
  if (!p.length) return { coverage: 0, matched: 0, total: 0, lastMatched: -1 };
  let ti = 0;
  let matched = 0;
  // lastMatched = prompt index of the reader's current word. It freezes after a
  // long run of misses so a stray "the" far ahead can't leap the cursor forward.
  let lastMatched = -1;
  let miss = 0;
  let frozen = false;
  for (let i = 0; i < p.length; i += 1) {
    const w = p[i];
    const end = Math.min(t.length, ti + 6);
    let hit = false;
    for (let j = ti; j < end; j += 1) {
      if (t[j] === w) { matched += 1; ti = j + 1; hit = true; break; }
    }
    if (hit) { if (!frozen) lastMatched = i; miss = 0; } else if (++miss > 8) frozen = true;
  }
  return { coverage: matched / p.length, matched, total: p.length, lastMatched };
}

// Runnable self-check for the coverage alignment.
export function demoCoverage() {
  const prompt = 'the quick brown fox jumps over the lazy dog';
  console.assert(readingCoverage(prompt, prompt).coverage === 1, 'perfect read = 1');
  const partial = readingCoverage(prompt, 'the quick brown fox');
  console.assert(partial.coverage > 0.4 && partial.coverage < 0.5, `partial ~4/9, got ${partial.coverage}`);
  const noisy = readingCoverage(prompt, 'the quick um brown fox jumps over uh the lazy dog');
  console.assert(noisy.coverage === 1, `insertions tolerated, got ${noisy.coverage}`);
  const skipped = readingCoverage(prompt, 'the quick brown fox jumps over the dog');
  console.assert(skipped.coverage > 0.8 && skipped.coverage < 1, `one missed word, got ${skipped.coverage}`);
  console.assert(readingCoverage('', 'anything').coverage === 0, 'empty prompt = 0');
  console.assert(readingCoverage(prompt, 'the quick brown').lastMatched === 2, 'cursor sits on the last recognised word');
  console.assert(readingCoverage(prompt, '').lastMatched === -1, 'nothing read → no cursor');
  const far = 'a b c d e f g h i j k l m n o p q r s t the end';
  console.assert(readingCoverage(far, 'a b c the').lastMatched === 2, 'a stray far-ahead match cannot leap the cursor');
  return true;
}

export { FILLER_WORDS, FILLER_PHRASES };
