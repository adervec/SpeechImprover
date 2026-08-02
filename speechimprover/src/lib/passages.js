// Split a long work (a book, an essay) into bite-size reading passages so a
// project can be recorded a piece at a time, tracking a position through it.
// Greedy pack: respect paragraph breaks, then fill up to ~maxWords on sentence
// boundaries. ponytail: heuristic sentence split — good enough for prose; swap
// in an NLP segmenter only if abbreviations/quotes cause bad breaks in practice.

export function splitIntoPassages(text, maxWords = 90) {
  const clean = (text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const passages = [];
  for (const para of paragraphs) {
    const sentences = para.match(/[^.!?]+[.!?]*\s*/g) || [para];
    let buf = '';
    let words = 0;
    for (const s of sentences) {
      const w = s.trim().split(/\s+/).filter(Boolean).length;
      if (words && words + w > maxWords) {
        passages.push(buf.trim());
        buf = '';
        words = 0;
      }
      buf += s;
      words += w;
      if (words >= maxWords) {
        passages.push(buf.trim());
        buf = '';
        words = 0;
      }
    }
    if (buf.trim()) passages.push(buf.trim());
  }
  return passages;
}

// Runnable self-check: `import { demo } from './passages.js'; demo()`.
export function demo() {
  const text = 'One two three four five. Six seven eight nine ten.\n\nSecond paragraph here with several more words than fit.';
  const p = splitIntoPassages(text, 6);
  console.assert(p.length >= 3, 'splits by word cap and paragraph break');
  console.assert(p.join(' ').includes('Second paragraph'), 'keeps all content');
  console.assert(splitIntoPassages('').length === 0, 'empty → []');
  console.assert(splitIntoPassages('Short line.').length === 1, 'short → one passage');
  return p;
}
