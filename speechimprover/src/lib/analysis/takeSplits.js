// Split a finished take into halves / thirds / quarters (ported from TachyRead's
// typing-run splits), each with its own pace, fillers and pace grade, plus a
// "pace held" grade for how far the last part drifted from the first.
//
// Input: the take's paceMarks ([{ t: secs, words, fillers? }], one per final
// recognizer segment). Running totals are interpolated linearly between marks.
// ponytail: segment-level timing only (Web Speech has no word timings).
import { ATTRIBUTE_MAP } from './attributes.js';

// Shortest take each split is offered for (secs) — shorter gives noisy parts.
export const SPLIT_MIN_SECS = { 2: 30, 3: 45, 4: 60 };
export const splitsFor = (secs) => [2, 3, 4].filter((n) => secs >= SPLIT_MIN_SECS[n]);

// Running totals at time t.
function at(marks, t) {
  let prev = { t: 0, words: 0, fillers: 0 };
  let acc = { words: 0, fillers: 0 };
  for (const m of marks) {
    const next = { t: m.t, words: acc.words + m.words, fillers: acc.fillers + (m.fillers || 0) };
    if (next.t >= t) {
      const f = next.t > prev.t ? (t - prev.t) / (next.t - prev.t) : 1;
      return { words: acc.words + m.words * f, fillers: acc.fillers + (m.fillers || 0) * f };
    }
    acc = { words: next.words, fillers: next.fillers };
    prev = next;
  }
  return acc;
}

// Words spoken by time t (interpolated within a segment).
export const wordsAt = (marks, t) => at(marks || [], t).words;

export function scoreGrade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// Speech drifting EITHER way (rushing or flagging) loses grades: within 5% is an A.
export function holdGrade(pct) {
  const d = Math.abs(pct);
  if (d <= 5) return 'A';
  if (d <= 10) return 'B';
  if (d <= 20) return 'C';
  if (d <= 30) return 'D';
  return 'F';
}

export function splitTake(marks, secs, parts) {
  const T = secs || marks?.at(-1)?.t || 0;
  if (!marks?.length || !T || parts < 2) return null;
  const out = [];
  for (let k = 0; k < parts; k += 1) {
    const a = at(marks, (T * k) / parts);
    const b = at(marks, (T * (k + 1)) / parts);
    const mins = T / parts / 60;
    const wpm = Math.round((b.words - a.words) / mins);
    const score = Math.round(ATTRIBUTE_MAP.pace.score({ wpm }));
    out.push({ wpm, fillers: Math.round(b.fillers - a.fillers), score, grade: scoreGrade(score) });
  }
  const first = out[0].wpm;
  const last = out.at(-1).wpm;
  const diffPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  return { parts: out, diffPct, diffGrade: holdGrade(diffPct) };
}
