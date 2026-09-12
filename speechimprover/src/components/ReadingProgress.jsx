import { useEffect, useMemo, useRef } from 'react';

// Provided text with live reading progress: words already read are dimmed, the
// current word (the last one recognised) is underlined and kept scrolled into
// view. `upTo` is readingCoverage(...).lastMatched — an index into the same
// tokenizer, which turns every non-letter into a space, so a chunk such as
// "well-known" counts as two tokens; the chunk→token map below reverses that.
const tokCount = (chunk) => chunk.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean).length;

export default function ReadingProgress({ text, upTo = -1 }) {
  const chunks = useMemo(() => {
    const out = [];
    let tok = 0;
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { out.push({ ws: part }); continue; }
      const n = tokCount(part);
      out.push({ word: part, from: tok, to: tok + n - 1 }); // pure punctuation: to < from, never "now"
      tok += n;
    }
    return out;
  }, [text]);
  const nowRef = useRef(null);
  useEffect(() => { nowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [upTo]);

  return chunks.map((c, i) => {
    if (c.ws) return c.ws;
    const now = c.from <= upTo && upTo <= c.to;
    const done = !now && c.to < upTo;
    return (
      <span key={i} ref={now ? nowRef : null} className={now ? 'read-now' : done ? 'read-done' : undefined}>{c.word}</span>
    );
  });
}
