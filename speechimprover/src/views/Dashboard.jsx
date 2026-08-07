import { useMemo } from 'react';
import { useStore } from '../lib/store.jsx';
import { LineChart } from '../components/charts.jsx';
import ActivityGrid from '../components/ActivityGrid.jsx';
import { ScoreBadge, EmptyState, AttrLabel } from '../components/ui.jsx';
import {
  computeStreak,
  averageOverall,
  weakestAttributes,
  trendSeries,
  weekDelta,
} from '../lib/aggregate.js';
import { formatDuration, relativeDay } from '../lib/format.js';

export default function Dashboard({ navigate }) {
  const { sessions, profile, settings, updateSettings } = useStore();
  const goal = settings.weeklyGoal || 3;

  const stats = useMemo(() => {
    const recent = sessions.slice(0, 8);
    const series = trendSeries(sessions, 'overall');
    const overalls = sessions.filter((s) => s.overall != null).map((s) => s.overall);
    const weekStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); })();
    return {
      streak: computeStreak(sessions),
      avg: averageOverall(recent),
      best: overalls.length ? Math.max(...overalls) : null,
      latest: sessions[0],
      weak: weakestAttributes(sessions, 3),
      series,
      weekPct: weekDelta(sessions),
      thisWeek: sessions.filter((s) => new Date(s.createdAt).getTime() >= weekStart).length,
    };
  }, [sessions]);

  if (!sessions.length) {
    return (
      <EmptyState
        title="Let's capture your baseline"
        action={<button className="btn primary lg" onClick={() => navigate('exercises')}>Start baseline assessment</button>}
      >
        Record your first samples so every future session has something to compare against.
        Reading aloud, free speech, and a high-pressure prompt make the best baseline.
      </EmptyState>
    );
  }

  const greeting = profile.name ? `Welcome back, ${profile.name}` : 'Welcome back';

  return (
    <div className="stack">
      <div className="row spread wrap">
        <div>
          <div className="tag">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>{greeting}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate('exercises')}>✦ Today's program</button>
          <button className="btn primary" onClick={() => navigate('practice')}>● New session</button>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card stat"><span className="big">{sessions.length}</span><span className="lbl">Sessions logged</span></div>
        <div className="card stat" title="Consecutive days with at least one recording."><span className="big" style={{ color: 'var(--accent)' }}>{stats.streak}🔥</span><span className="lbl">Day streak</span></div>
        <div className="card stat" title="Average score across your last 8 scored sessions (0–100).">
          <span className="big">{stats.avg}</span>
          <span className="lbl">Avg score (recent)</span>
          {stats.best != null && <span className="tiny muted">🏅 best {stats.best}</span>}
        </div>
        <div className="card stat" title="This week's average score vs last week's.">
          <span className="big" style={{ color: stats.weekPct == null ? 'var(--text-dim)' : stats.weekPct >= 0 ? 'var(--good)' : 'var(--bad)' }}>
            {stats.weekPct == null ? '—' : `${stats.weekPct >= 0 ? '+' : ''}${stats.weekPct}%`}
          </span>
          <span className="lbl">This week vs last</span>
        </div>
      </div>

      <div className="card tight">
        <div className="row spread">
          <div>
            <b>Weekly goal</b>
            <div className="tiny muted">
              {stats.thisWeek} of {goal} session{goal === 1 ? '' : 's'} this week{stats.thisWeek >= goal ? ' · reached 🎉' : ` · ${goal - stats.thisWeek} to go`}
            </div>
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <button className="btn ghost sm" aria-label="Lower goal" onClick={() => updateSettings({ weeklyGoal: Math.max(1, goal - 1) })}>−</button>
            <span className="mono" style={{ minWidth: 18, textAlign: 'center' }}>{goal}</span>
            <button className="btn ghost sm" aria-label="Raise goal" onClick={() => updateSettings({ weeklyGoal: goal + 1 })}>＋</button>
          </div>
        </div>
        <div className="attr-bar-track" style={{ marginTop: 10 }}>
          <div className="attr-bar-fill" style={{ width: `${Math.min(100, (stats.thisWeek / goal) * 100)}%`, background: stats.thisWeek >= goal ? 'var(--good)' : 'var(--accent)' }} />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Practice activity</h3>
          <span className="tiny muted">{stats.streak}🔥 day streak · past year</span>
        </div>
        <ActivityGrid sessions={sessions} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head"><h3>Progress over time</h3>
            <button className="btn ghost sm" onClick={() => navigate('trends')}>Open trends →</button>
          </div>
          {stats.series.length > 1 ? (
            <LineChart
              seriesList={[{ label: 'Overall', color: 'var(--accent)', points: stats.series }]}
              height={220}
              onPointClick={(p) => navigate('session', { param: p.id })}
            />
          ) : (
            <p className="muted small">Record a few more sessions to see your trend.</p>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h3>Focus areas</h3>
            <span className="tiny muted">your weakest attributes</span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {stats.weak.length ? stats.weak.map((w) => (
              <div className="row spread" key={w.key}>
                <div>
                  <b><AttrLabel attrKey={w.key} /></b>
                  <div className="tiny muted">recent avg</div>
                </div>
                <div className="row">
                  <ScoreBadge score={w.score} />
                  <button className="btn sm" onClick={() => navigate('exercises', { query: { focus: w.key } })}>Train</button>
                </div>
              </div>
            )) : (
              <p className="muted small">Record a scored reading or free-speaking take and your weakest attributes will surface here.</p>
            )}
          </div>
          <div className="divider" />
          <button className="btn block" onClick={() => navigate('exercises', { query: { generate: '1' } })}>
            Generate a targeted program →
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Recent sessions</h3>
          <button className="btn ghost sm" onClick={() => navigate('history')}>View all →</button>
        </div>
        <table className="data">
          <thead><tr><th>When</th><th>Exercise</th><th>Type</th><th>Overall</th><th>Length</th><th></th></tr></thead>
          <tbody>
            {sessions.slice(0, 6).map((s) => (
              <tr key={s.id}>
                <td className="nowrap">{relativeDay(s.createdAt)}</td>
                <td>{s.exerciseTitle || s.mode}</td>
                <td><span className="badge">{s.mode}</span></td>
                <td>{s.assessment === 'completion' ? <span className={`badge ${s.completion?.completed ? 'good' : 'fair'}`}>{s.completion?.completed ? '✓ done' : 'partial'}</span> : <ScoreBadge score={s.overall} />}</td>
                <td className="mono">{formatDuration(s.metrics?.durationSec)}</td>
                <td className="nowrap">
                  <button className="btn ghost sm" onClick={() => navigate('session', { param: s.id })}>Open</button>
                  {s.exerciseId && <button className="btn ghost sm" onClick={() => navigate('practice', { query: { exercise: s.exerciseId } })}>Repeat</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
