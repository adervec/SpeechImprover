// Compact progress digest for external "daily report" / AI-coach tasks.
// Pure function → { generatedAt, json, text }. No network: the caller decides
// where it goes (copy, download, or a synced file). This is the single place the
// progress summary is shaped, so an integration only has to read one format.

import {
  computeStreak,
  averageOverall,
  weakestAttributes,
  trendSeries,
  trendDelta,
} from './aggregate.js';

export function buildProgressSummary(sessions, profile, now = new Date()) {
  const scored = sessions.filter((s) => s.overall != null);
  const recent = scored.slice(0, 10);
  const series = trendSeries(scored, 'overall');
  const weak = weakestAttributes(scored, 3);
  const last = sessions[0];

  const json = {
    generatedAt: now.toISOString(),
    app: 'SpeechImprover',
    speaker: profile?.name || 'anonymous',
    totals: {
      sessions: sessions.length,
      scored: scored.length,
      dayStreak: computeStreak(sessions),
    },
    recentAvgOverall: averageOverall(recent),
    overallTrendDelta: trendDelta(series),
    lastSession: last
      ? {
          at: last.createdAt,
          exercise: last.exerciseTitle || last.mode || '—',
          overall: last.overall ?? null,
          alignment: last.distances?.alignment ?? null,
        }
      : null,
    focusAreas: weak.map((w) => ({ attribute: w.label, recentAvg: w.score })),
  };

  const text = [
    `# SpeechImprover progress — ${json.generatedAt.slice(0, 10)}`,
    `Speaker: ${json.speaker}`,
    `Sessions: ${json.totals.sessions} (${json.totals.scored} scored) · streak ${json.totals.dayStreak}d`,
    `Recent avg overall: ${json.recentAvgOverall} · trend ${json.overallTrendDelta >= 0 ? '+' : ''}${json.overallTrendDelta}`,
    last
      ? `Last: ${json.lastSession.exercise} — overall ${json.lastSession.overall ?? 'n/a'}, alignment ${json.lastSession.alignment ?? 'n/a'}%`
      : 'No sessions yet.',
    weak.length ? `Focus areas: ${weak.map((w) => `${w.label} (${w.score})`).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { generatedAt: json.generatedAt, json, text };
}

// Runnable self-check: `import { demo } from './progressSummary.js'; demo()`.
export function demo() {
  const now = new Date('2026-07-12T00:00:00Z');
  const sessions = [
    { id: '1', createdAt: '2026-07-12T10:00:00Z', overall: 70, exerciseTitle: 'Free · Calm', mode: 'free', distances: { alignment: 62 }, scores: { pace: 80, expressiveness: 40 } },
    { id: '2', createdAt: '2026-07-11T10:00:00Z', overall: 60, mode: 'read', scores: { pace: 75, expressiveness: 30 } },
  ];
  const r = buildProgressSummary(sessions, { name: 'Ada' }, now);
  console.assert(r.json.totals.sessions === 2, 'sessions count');
  console.assert(r.json.recentAvgOverall === 65, 'recent avg overall');
  console.assert(r.json.lastSession.overall === 70, 'last session overall');
  console.assert(r.json.focusAreas[0].attribute === 'Expressiveness', 'weakest attr first');
  console.assert(r.text.startsWith('# SpeechImprover progress'), 'text header');
  return r;
}
