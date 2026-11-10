// Aggregations over sessions for the dashboard and trends views.

import { ATTRIBUTES } from './analysis/attributes.js';
import { localDayKey, parseDayKey } from './format.js';

// The user's LOCAL calendar day of a timestamp.
const dayKey = (iso) => localDayKey(iso);

// Consecutive-day practice streak ending today (or yesterday).
export function computeStreak(sessions, now = new Date()) {
  if (!sessions.length) return 0;
  const days = new Set(sessions.map((s) => dayKey(s.createdAt)));
  let streak = 0;
  const cursor = new Date(now);
  // Allow the streak to count from today or yesterday.
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDayKey(cursor))) return 0;
  }
  for (;;) {
    if (days.has(localDayKey(cursor))) {
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

// Signed % change of this week's average overall score vs last week's.
// null when either week has no scored session (so the UI can show "—" honestly).
export function weekDelta(sessions, now = new Date()) {
  const thisWeek = new Date(now);
  thisWeek.setHours(0, 0, 0, 0);
  thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay()); // back to Sunday
  const thisStart = thisWeek.getTime();
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7); // calendar step, DST-safe
  const lastStart = lastWeek.getTime();
  const avgIn = (from, to) => {
    const vals = sessions
      .filter((s) => s.overall != null)
      .filter((s) => { const t = new Date(s.createdAt).getTime(); return t >= from && t < to; })
      .map((s) => s.overall);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const thisAvg = avgIn(thisStart, Infinity);
  const lastAvg = avgIn(lastStart, thisStart);
  if (thisAvg == null || lastAvg == null || lastAvg === 0) return null;
  return Math.round(((thisAvg - lastAvg) / lastAvg) * 100);
}

// Runnable self-check for the week-over-week math.
export function demoWeekDelta() {
  const now = new Date('2026-08-06T12:00:00'); // Thursday; week starts Sun 2026-08-02
  const mk = (d, overall) => ({ createdAt: d, overall });
  const d = weekDelta([mk('2026-08-04T10:00:00', 80), mk('2026-07-29T10:00:00', 60)], now);
  console.assert(d === 33, `weekDelta expected 33, got ${d}`); // (80-60)/60
  console.assert(weekDelta([mk('2026-08-04T10:00:00', 80)], now) === null, 'null without prior week');
  return d;
}

// A practice SESSION is a block of recordings close together in time (morning
// vs evening = separate sessions). Consecutive takes less than `gapHours` apart
// belong to the same session. Returns blocks newest-first: { start, end, count, ids }.
export function groupIntoSessions(sessions, gapHours = 3) {
  const asc = [...sessions].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const blocks = [];
  let cur = null;
  for (const s of asc) {
    const t = new Date(s.createdAt).getTime();
    if (cur && t - cur.end <= gapHours * 3600e3) {
      cur.end = t;
      cur.count += 1;
      cur.ids.push(s.id);
    } else {
      cur = { start: t, end: t, count: 1, ids: [s.id] };
      blocks.push(cur);
    }
  }
  return blocks.reverse();
}

// Runnable self-check for the session grouping.
export function demoGroupSessions() {
  const mk = (iso, id) => ({ id, createdAt: iso });
  const b = groupIntoSessions([
    mk('2026-08-09T08:00:00Z', 'a'), mk('2026-08-09T08:10:00Z', 'b'), // morning pair
    mk('2026-08-09T19:00:00Z', 'c'), // evening = new session
    mk('2026-08-07T10:00:00Z', 'd'), // earlier day
  ]);
  console.assert(b.length === 3, `3 sessions, got ${b.length}`);
  console.assert(b[0].count === 1 && b[1].count === 2 && b[2].count === 1, 'evening single, morning pair, old single');
  console.assert(b[1].ids.join() === 'a,b', 'morning pair keeps take ids');
  return b;
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
// current week. All bucketing is in the user's LOCAL days, like dayKey()/computeStreak().
// Cells after today are flagged `future` so the grid stays rectangular.
export function buildActivityGrid(sessions, weeks = 53, today = new Date()) {
  const counts = {};
  for (const s of sessions) {
    const k = dayKey(s.createdAt);
    counts[k] = (counts[k] || 0) + 1;
  }
  const todayKey = localDayKey(today);
  const t = parseDayKey(todayKey);
  const end = new Date(t);
  end.setDate(end.getDate() + (6 - t.getDay())); // Saturday of this week
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1)); // a Sunday

  const columns = [];
  let prevMonth = -1;
  let total = 0;
  for (let c = 0; c < weeks; c++) {
    const days = [];
    let month = null;
    for (let r = 0; r < 7; r++) {
      const d = new Date(start);
      d.setDate(start.getDate() + c * 7 + r);
      const key = localDayKey(d);
      const future = key > todayKey;
      const count = future ? 0 : counts[key] || 0;
      if (!future) total += count;
      if (r === 0 && d.getMonth() !== prevMonth) {
        month = MONTHS[d.getMonth()];
        prevMonth = d.getMonth();
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

// Local-day rule check (npm test runs this in the machine's zone AND under
// America/Sao_Paulo via scripts/check-tz.mjs). Throws on failure.
export function demo() {
  const ok = (c, m) => { if (!c) throw new Error(`aggregate: ${m}`); };
  // 22:30 LOCAL tonight — at UTC-3 that's already tomorrow in UTC.
  const now = new Date(2026, 10, 10, 23, 0);
  const late = new Date(2026, 10, 10, 22, 30).toISOString();
  const yesterday = new Date(2026, 10, 9, 8, 0).toISOString();
  ok(localDayKey(late) === '2026-11-10', `22:30 local is today (${localDayKey(late)})`);
  ok(computeStreak([{ createdAt: late }], now) === 1, 'late-evening take counts as today');
  ok(computeStreak([{ createdAt: late }, { createdAt: yesterday }], now) === 2, 'yesterday + tonight = 2-day streak');
  ok(computeStreak([{ createdAt: late }], new Date(2026, 10, 11, 9, 0)) === 1, 'next morning: tonight still counts (as yesterday)');
  const cells = buildActivityGrid([{ createdAt: late }], 2, now).columns.flatMap((c) => c.days);
  ok(cells.find((d) => d.isToday)?.count === 1 && cells.find((d) => d.isToday).key === '2026-11-10', 'grid puts it on today');
  ok(parseDayKey('2026-03-01').getDate() === 1, 'stored day reads back as local midnight');
  // Existing self-checks use console.assert — make them throw here.
  const orig = console.assert;
  console.assert = (c, m) => { if (!c) throw new Error(`aggregate: ${m}`); };
  try { demoWeekDelta(); demoGroupSessions(); demoActivityGrid(); } finally { console.assert = orig; }
  return 'aggregate.demo: ok';
}
