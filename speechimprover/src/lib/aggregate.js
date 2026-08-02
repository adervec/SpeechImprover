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

// ---- GitHub-style contribution grid (practice activity heatmap) ----
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function activityLevel(n) {
  if (!n) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  if (n <= 5) return 3;
  return 4;
}

// Build `weeks` columns × 7 rows (Sun→Sat) of daily session counts, ending in the
// current week. All bucketing is in UTC days to match dayKey()/computeStreak().
// Cells after today are flagged `future` so the grid stays rectangular.
export function buildActivityGrid(sessions, weeks = 53, today = new Date()) {
  const counts = {};
  for (const s of sessions) {
    const k = dayKey(s.createdAt);
    counts[k] = (counts[k] || 0) + 1;
  }
  const todayKey = new Date(today).toISOString().slice(0, 10);
  const t = new Date(`${todayKey}T00:00:00Z`);
  const end = new Date(t);
  end.setUTCDate(end.getUTCDate() + (6 - t.getUTCDay())); // Saturday of this week
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (weeks * 7 - 1)); // a Sunday

  const columns = [];
  let prevMonth = -1;
  let total = 0;
  for (let c = 0; c < weeks; c++) {
    const days = [];
    let month = null;
    for (let r = 0; r < 7; r++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + c * 7 + r);
      const key = d.toISOString().slice(0, 10);
      const future = key > todayKey;
      const count = future ? 0 : counts[key] || 0;
      if (!future) total += count;
      if (r === 0 && d.getUTCMonth() !== prevMonth) {
        month = MONTHS[d.getUTCMonth()];
        prevMonth = d.getUTCMonth();
      }
      days.push({ key, count, level: activityLevel(count), future, isToday: key === todayKey });
    }
    columns.push({ month, days });
  }
  return { columns, total };
}

// Runnable self-check: `import { demoActivityGrid } from './aggregate.js'; demoActivityGrid()`.
export function demoActivityGrid() {
  const sessions = [
    { createdAt: '2026-07-12T10:00:00Z' },
    { createdAt: '2026-07-12T12:00:00Z' },
    { createdAt: '2026-07-10T09:00:00Z' },
  ];
  const g = buildActivityGrid(sessions, 4, new Date('2026-07-12T15:00:00Z'));
  console.assert(g.columns.length === 4, 'weeks');
  console.assert(g.columns.every((c) => c.days.length === 7), '7 rows each');
  console.assert(g.total === 3, 'total counts');
  const todayCell = g.columns.flatMap((c) => c.days).find((d) => d.isToday);
  console.assert(todayCell && todayCell.count === 2, 'today has 2 sessions');
  console.assert(todayCell.level === 2, 'today level 2 (2-3 band)');
  console.assert(g.columns.flatMap((c) => c.days).every((d) => !d.future || d.count === 0), 'future cells empty');
  return g;
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
