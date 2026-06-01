import { useMemo } from 'react';
import { useStore } from '../lib/store.jsx';
import { LineChart } from '../components/charts.jsx';
import { ScoreBadge, EmptyState, AttrLabel } from '../components/ui.jsx';
import {
  computeStreak,
  averageOverall,
  weakestAttributes,
  trendSeries,
  trendDelta,
} from '../lib/aggregate.js';
import { formatDuration, relativeDay } from '../lib/format.js';

export default function Dashboard({ navigate }) {
  const { sessions, profile } = useStore();

  const stats = useMemo(() => {
    const recent = sessions.slice(0, 8);
    const series = trendSeries(sessions, 'overall');
    return {
      streak: computeStreak(sessions),
      avg: averageOverall(recent),
      latest: sessions[0],
      weak: weakestAttributes(sessions, 3),
      series,
      delta: trendDelta(series),
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
        <div className="card stat"><span className="big" style={{ color: 'var(--accent)' }}>{stats.streak}🔥</span><span className="lbl">Day streak</span></div>
        <div className="card stat"><span className="big">{stats.avg}</span><span className="lbl">Avg score (recent)</span></div>
        <div className="card stat">
          <span className="big" style={{ color: stats.delta >= 0 ? 'var(--good)' : 'var(--bad)' }}>
            {stats.delta >= 0 ? '+' : ''}{stats.delta}
          </span>
          <span className="lbl">Overall trend</span>
        </div>
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
            {stats.weak.map((w) => (
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
            ))}
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
