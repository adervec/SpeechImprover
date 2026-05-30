// Aggregations over sessions for the dashboard and trends views.

import { ATTRIBUTES } from './analysis/attributes.js';

function dayKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

// Consecutive-day practice streak ending today (or yesterday).
export function computeStreak(sessions) {
  if (!sessions.length) return 0;
  const days = new Set(sessions.map((s) => dayKey(s.createdAt)));
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to count from today or yesterday.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  for (;;) {
    if (days.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

export function averageOverall(sessions) {
  const vals = sessions.map((s) => s.overall).filter((v) => v != null);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Average score per attribute over the given sessions (most recent first assumed).
export function attributeAverages(sessions) {
  const result = {};
  for (const attr of ATTRIBUTES) {
    const vals = sessions
      .map((s) => s.scores?.[attr.key])
      .filter((v) => v != null);
    result[attr.key] = vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : null;
  }
  return result;
}

// The k weakest attributes (lowest recent average), with data only.
export function weakestAttributes(sessions, k = 2, recentN = 6) {
  const recent = sessions.slice(0, recentN);
  const avgs = attributeAverages(recent);
  return ATTRIBUTES.filter((a) => avgs[a.key] != null)
    .map((a) => ({ key: a.key, label: a.label, score: avgs[a.key] }))
    .sort((x, y) => x.score - y.score)
    .slice(0, k);
}

// Build a time series (ascending) for an attribute key or 'overall'.
export function trendSeries(sessions, key = 'overall', filterFn = null) {
  return sessions
    .filter((s) => (filterFn ? filterFn(s) : true))
    .map((s) => ({
      date: s.createdAt,
      value: key === 'overall' ? s.overall : s.scores?.[key],
      id: s.id,
    }))
    .filter((p) => p.value != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Linear trend direction over a series: returns slope sign summary.
export function trendDelta(series) {
  if (series.length < 2) return 0;
  return series[series.length - 1].value - series[0].value;
}

// Distinct subset options present in the data, for trend filtering.
export function subsetOptions(sessions) {
  const modes = [...new Set(sessions.map((s) => s.mode).filter(Boolean))];
  const types = [...new Set(sessions.map((s) => s.type).filter(Boolean))];
  const exercises = [
    ...new Map(
      sessions
        .filter((s) => s.exerciseId)
        .map((s) => [s.exerciseId, s.exerciseTitle || s.exerciseId])
    ).entries(),
  ].map(([id, title]) => ({ id, title }));
  return { modes, types, exercises };
}
