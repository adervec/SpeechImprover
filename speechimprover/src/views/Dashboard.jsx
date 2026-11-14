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
  groupIntoSessions,
} from '../lib/aggregate.js';
import { formatDuration, relativeDay } from '../lib/format.js';
import { t, locale } from '../lib/i18n.js';

export default function Dashboard({ navigate }) {
  const { sessions, profile, settings, updateSettings } = useStore();
  const goal = settings.weeklyGoal || 3;

  const stats = useMemo(() => {
    const recent = sessions.slice(0, 8);
    const series = trendSeries(sessions, 'overall');
    const overalls = sessions.filter((s) => s.overall != null).map((s) => s.overall);
    const weekStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); })();
    // A "session" = a block of takes close in time (3h+ gap starts a new one).
    const blocks = groupIntoSessions(sessions);
    return {
      streak: computeStreak(sessions),
      avg: averageOverall(recent),
      best: overalls.length ? Math.max(...overalls) : null,
      latest: sessions[0],
      weak: weakestAttributes(sessions, 3),
      series,
      weekPct: weekDelta(sessions),
      sessionCount: blocks.length,
      thisWeek: blocks.filter((b) => b.start >= weekStart).length,
    };
  }, [sessions]);

  if (!sessions.length) {
    return (
      <EmptyState
        title={t("Let's capture your baseline")}
        action={<button className="btn primary lg" onClick={() => navigate('exercises')}>{t('Start baseline assessment')}</button>}
      >
        {t('Record your first samples so every future session has something to compare against. Reading aloud, free speech, and a high-pressure prompt make the best baseline.')}
      </EmptyState>
    );
  }

  const greeting = profile.name ? t('Welcome back, {name}', { name: profile.name }) : t('Welcome back');

  return (
    <div className="stack">
      <div className="row spread wrap">
        <div>
          <div className="tag">{new Date().toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>{greeting}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate('exercises')}>✦ {t("Today's program")}</button>
          <button className="btn" onClick={() => navigate('practice')}>● {t('New session')}</button>
          <button className="btn primary" onClick={() => navigate('practice', { query: { quick: '1' } })} title={t('Skip setup — free speaking starts after a 3-2-1')}>🎙️ {t('Just speak')}</button>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card stat" title={t('A session is a block of recordings — a 3h+ gap starts a new one.')}>
          <span className="big">{stats.sessionCount}</span>
          <span className="lbl">{t('Practice sessions')}</span>
          <span className="tiny muted">{t.n('{n} recording', '{n} recordings', sessions.length)}</span>
        </div>
        <div className="card stat" title={t('Consecutive days with at least one recording.')}><span className="big" style={{ color: 'var(--accent)' }}>{stats.streak}🔥</span><span className="lbl">{t('Day streak')}</span></div>
        <div className="card stat" title={t('Average score across your last 8 scored sessions (0–100).')}>
          <span className="big">{stats.avg}</span>
          <span className="lbl">{t('Avg score (recent)')}</span>
          {stats.best != null && <span className="tiny muted">🏅 {t('best {score}', { score: stats.best })}</span>}
        </div>
        <div className="card stat" title={t("This week's average score vs last week's.")}>
          <span className="big" style={{ color: stats.weekPct == null ? 'var(--text-dim)' : stats.weekPct >= 0 ? 'var(--good)' : 'var(--bad)' }}>
            {stats.weekPct == null ? '—' : `${stats.weekPct >= 0 ? '+' : ''}${stats.weekPct}%`}
          </span>
          <span className="lbl">{t('This week vs last')}</span>
        </div>
      </div>

      <div className="card tight">
        <div className="row spread">
          <div>
            <b>{t('Weekly goal')}</b>
            <div className="tiny muted" title={t('A session is a block of recordings — a 3h+ gap starts a new one.')}>
              {t.n('{done} of {n} practice session this week', '{done} of {n} practice sessions this week', goal, { done: stats.thisWeek })}
              {' · '}{stats.thisWeek >= goal ? `${t('reached')} 🎉` : t('{n} to go', { n: goal - stats.thisWeek })}
            </div>
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <button className="btn ghost sm" aria-label={t('Lower goal')} onClick={() => updateSettings({ weeklyGoal: Math.max(1, goal - 1) })}>−</button>
            <span className="mono" style={{ minWidth: 18, textAlign: 'center' }}>{goal}</span>
            <button className="btn ghost sm" aria-label={t('Raise goal')} onClick={() => updateSettings({ weeklyGoal: goal + 1 })}>＋</button>
          </div>
        </div>
        <div className="attr-bar-track" style={{ marginTop: 10 }}>
          <div className="attr-bar-fill" style={{ width: `${Math.min(100, (stats.thisWeek / goal) * 100)}%`, background: stats.thisWeek >= goal ? 'var(--good)' : 'var(--accent)' }} />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>{t('Practice activity')}</h3>
          <span className="tiny muted">{t.n('{n}🔥 day streak · past year', '{n}🔥 day streak · past year', stats.streak)}</span>
        </div>
        <ActivityGrid sessions={sessions} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head"><h3>{t('Progress over time')}</h3>
            <button className="btn ghost sm" onClick={() => navigate('trends')}>{t('Open trends')} →</button>
          </div>
          {stats.series.length > 1 ? (
            <LineChart
              seriesList={[{ label: t('Overall'), color: 'var(--accent)', points: stats.series }]}
              height={220}
              onPointClick={(p) => navigate('session', { param: p.id })}
            />
          ) : (
            <p className="muted small">{t('Record a few more sessions to see your trend.')}</p>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h3>{t('Focus areas')}</h3>
            <span className="tiny muted">{t('your weakest attributes')}</span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {stats.weak.length ? stats.weak.map((w) => (
              <div className="row spread" key={w.key}>
                <div>
                  <b><AttrLabel attrKey={w.key} /></b>
                  <div className="tiny muted">{t('recent avg')}</div>
                </div>
                <div className="row">
                  <ScoreBadge score={w.score} />
                  <button className="btn sm" onClick={() => navigate('exercises', { query: { focus: w.key } })}>{t('Train')}</button>
                </div>
              </div>
            )) : (
              <p className="muted small">{t('Record a scored reading or free-speaking take and your weakest attributes will surface here.')}</p>
            )}
          </div>
          <div className="divider" />
          <button className="btn block" onClick={() => navigate('exercises', { query: { generate: '1' } })}>
            {t('Generate a targeted program')} →
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>{t('Recent recordings')}</h3>
          <button className="btn ghost sm" onClick={() => navigate('history')}>{t('View all')} →</button>
        </div>
        <table className="data">
          <thead><tr><th>{t('When')}</th><th>{t('Exercise')}</th><th>{t('Type')}</th><th>{t('Overall')}</th><th>{t('Length')}</th><th></th></tr></thead>
          <tbody>
            {sessions.slice(0, 6).map((s) => (
              <tr key={s.id}>
                <td className="nowrap">{relativeDay(s.createdAt)}</td>
                <td>{s.exerciseTitle || s.mode}</td>
                <td><span className="badge">{s.mode}</span></td>
                <td>{s.assessment === 'completion' ? <span className={`badge ${s.completion?.completed ? 'good' : 'fair'}`}>{s.completion?.completed ? `✓ ${t('done')}` : t('partial')}</span> : <ScoreBadge score={s.overall} />}</td>
                <td className="mono">{formatDuration(s.metrics?.durationSec)}</td>
                <td className="nowrap">
                  <button className="btn ghost sm" onClick={() => navigate('session', { param: s.id })}>{t('Open')}</button>
                  {s.exerciseId && <button className="btn ghost sm" onClick={() => navigate('practice', { query: { exercise: s.exerciseId } })}>{t('Repeat')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
