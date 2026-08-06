import { useMemo, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { AttrLabel } from '../components/ui.jsx';
import { weakestAttributes } from '../lib/aggregate.js';
import { EXERCISES, BASELINE_SET, CATEGORIES, generateProgram } from '../lib/exercises.js';
import { ATTRIBUTES } from '../lib/analysis/attributes.js';
import { formatDuration, relativeDay } from '../lib/format.js';

function ExerciseCard({ ex, navigate, highlight = [], last = null }) {
  const start = () => navigate('practice', { query: { exercise: ex.id } });
  return (
    <div
      className="card tight"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        borderColor: last ? 'color-mix(in srgb, var(--good) 45%, var(--border))' : undefined,
      }}
    >
      <div className="row spread">
        <span className="tag">{ex.category}</span>
        <span className="tiny muted">{formatDuration(ex.durationSec)}</span>
      </div>
      <h3 style={{ fontSize: '1rem' }}>{ex.title}</h3>
      {last && (
        <div className="tiny" style={{ color: 'var(--good)', fontWeight: 700 }}>
          ✓ Last done {relativeDay(last.at)}{last.count > 1 ? ` · ${last.count}×` : ''}
        </div>
      )}
      {ex.instructions && <p className="tiny muted" style={{ lineHeight: 1.5 }}>{ex.instructions}</p>}
      <div className="pill-group">
        {ex.targetAttributes.map((a) => (
          <span key={a} className="badge" style={highlight.includes(a) ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}>
            <AttrLabel attrKey={a} />
          </span>
        ))}
      </div>
      {last ? (
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm" onClick={() => navigate('session', { param: last.sessionId })}>View last</button>
          <button className="btn primary sm" style={{ flex: 1, justifyContent: 'center' }} onClick={start}>Practice again →</button>
        </div>
      ) : (
        <button className="btn primary block" onClick={start}>Start →</button>
      )}
    </div>
  );
}

const gradientBg = {
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--surface)), var(--surface))',
};

export default function Exercises({ route, navigate }) {
  const { sessions, program, startProgram } = useStore();
  const focusFromQuery = route.query.focus;
  const [filter, setFilter] = useState(focusFromQuery || 'all');

  const weak = useMemo(() => weakestAttributes(sessions, 2), [sessions]);
  const weakKeys = weak.map((w) => w.key);

  // Last-done lookup per exercise id, so cards can show "✓ done" + when (and link to it).
  const doneByExercise = useMemo(() => {
    const m = new Map();
    for (const s of sessions) {
      if (!s.exerciseId) continue;
      const cur = m.get(s.exerciseId);
      if (!cur) m.set(s.exerciseId, { at: s.createdAt, sessionId: s.id, count: 1 });
      else {
        cur.count += 1;
        if (s.createdAt > cur.at) { cur.at = s.createdAt; cur.sessionId = s.id; }
      }
    }
    return m;
  }, [sessions]);
  const [preview, setPreview] = useState(() => generateProgram(weak.map((w) => w.key)));

  const highlight = focusFromQuery ? [focusFromQuery] : weakKeys;
  const filtered = filter === 'all' ? EXERCISES : EXERCISES.filter((e) => e.targetAttributes.includes(filter));

  function goStep(step, i) {
    navigate('practice', { query: { exercise: step.exercise.id, program: '1', step: String(i) } });
  }
  function beginPreviewAt(i) {
    const prog = startProgram(preview, weakKeys);
    const step = prog.steps[i];
    navigate('practice', { query: { exercise: step.exercise.id, program: '1', step: String(i) } });
  }
  function newProgram() {
    const next = generateProgram(weakKeys);
    setPreview(next);
    startProgram(next, weakKeys);
  }

  // ----- active program (persisted) -----
  const steps = program?.steps || [];
  const total = steps.length;
  const done = steps.filter((s) => s.status === 'done').length;
  const nextIdx = steps.findIndex((s) => s.status === 'pending');
  const complete = total > 0 && nextIdx < 0;

  const targetLabels = (program?.targets || weakKeys);

  return (
    <div className="stack">
      {program ? (
        <div className="card" style={gradientBg}>
          <div className="card-head">
            <div>
              <div className="tag">Daily program · started {relativeDay(program.createdAt)}</div>
              <h2>Your targeted program</h2>
            </div>
            <div className="row">
              <button className="btn ghost sm" onClick={newProgram}>↻ New program</button>
              {complete ? (
                <button className="btn primary" onClick={newProgram}>Start a new program →</button>
              ) : (
                <button className="btn primary" onClick={() => goStep(steps[nextIdx], nextIdx)}>
                  {done === 0 ? 'Begin program →' : 'Resume →'}
                </button>
              )}
            </div>
          </div>

          <p className="muted small" style={{ marginBottom: 12 }}>
            Targets:{' '}
            {targetLabels.length
              ? targetLabels.map((k, i) => <b key={k}>{i ? ', ' : ''}<AttrLabel attrKey={k} /></b>)
              : <b>pace &amp; fillers</b>}.
          </p>

          <div className="row spread" style={{ marginBottom: 6 }}>
            <span className="small muted">{done} of {total} steps complete{complete ? ' 🎉' : ''}</span>
            <span className="small mono">{total ? Math.round((done / total) * 100) : 0}%</span>
          </div>
          <div className="attr-bar-track" style={{ marginBottom: 16 }}>
            <div className="attr-bar-fill" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: complete ? 'var(--good)' : 'var(--accent)' }} />
          </div>

          <div className="grid cols-3">
            {steps.map((st, i) => {
              const ex = st.exercise;
              const isNext = i === nextIdx;
              const isDone = st.status === 'done';
              return (
                <div
                  className="card tight"
                  key={`${ex.id}-${i}`}
                  style={{
                    background: 'var(--bg-2)',
                    borderStyle: 'solid',
                    borderWidth: isNext ? 2 : 1,
                    borderColor: isNext ? 'var(--accent)' : isDone ? 'color-mix(in srgb, var(--good) 45%, var(--border))' : 'var(--border)',
                  }}
                >
                  <div className="row spread">
                    <span className="tag">Step {i + 1} · {ex.category}</span>
                    <span className="tiny" style={{ color: isDone ? 'var(--good)' : 'var(--text-dim)' }}>
                      {isDone ? '✓ done' : formatDuration(ex.durationSec)}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '0.95rem', margin: '6px 0' }}>{ex.title}</h3>
                  {isDone ? (
                    <div className="row" style={{ gap: 6 }}>
                      {st.sessionId && <button className="btn sm" onClick={() => navigate('session', { param: st.sessionId })}>View</button>}
                      <button className="btn ghost sm" onClick={() => goStep(st, i)}>Redo</button>
                    </div>
                  ) : (
                    <button className={`btn sm block ${isNext ? 'primary' : ''}`} onClick={() => goStep(st, i)}>
                      {isNext ? 'Start step →' : 'Start'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={gradientBg}>
          <div className="card-head">
            <div>
              <div className="tag">Daily routine · ~12 min</div>
              <h2>Your targeted program</h2>
            </div>
            <div className="row">
              <button className="btn ghost sm" onClick={() => setPreview(generateProgram(weakKeys))}>🎲 Shuffle</button>
              <button className="btn primary" onClick={() => beginPreviewAt(0)}>Begin program →</button>
            </div>
          </div>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Built from the Baseline guide's daily system (warm-up → articulation → core drill → capture),
            targeting your weakest attributes: {weak.length ? weak.map((w, i) => <b key={w.key}>{i ? ', ' : ''}<AttrLabel attrKey={w.key} /></b>) : <b>pace &amp; fillers</b>}.
          </p>
          <div className="grid cols-3">
            {preview.map((ex, i) => (
              <div className="card tight" key={`${ex.id}-${i}`} style={{ background: 'var(--bg-2)' }}>
                <div className="row spread">
                  <span className="tag">Step {i + 1} · {ex.category}</span>
                  <span className="tiny muted">{formatDuration(ex.durationSec)}</span>
                </div>
                <h3 style={{ fontSize: '0.95rem', margin: '6px 0' }}>{ex.title}</h3>
                <button className="btn sm block" onClick={() => beginPreviewAt(i)}>Start step →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Baseline assessment</h3><span className="tiny muted">re-record monthly to compare</span></div>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Three samples that form your reference point. Re-record the same set each month and compare them back to back.
        </p>
        <div className="grid cols-3">
          {BASELINE_SET.map((ex) => <ExerciseCard key={ex.id} ex={ex} navigate={navigate} highlight={highlight} last={doneByExercise.get(ex.id) || null} />)}
        </div>
      </div>

      <div className="card-head" style={{ marginBottom: 0 }}>
        <h3>Exercise library</h3>
      </div>
      <div className="pill-group">
        <button className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {ATTRIBUTES.map((a) => (
          <button key={a.key} className={`pill ${filter === a.key ? 'active' : ''}`} onClick={() => setFilter(a.key)}>
            {a.label}
          </button>
        ))}
      </div>

      {CATEGORIES.filter((c) => c !== 'Baseline').map((cat) => {
        const items = filtered.filter((e) => e.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <h3 style={{ margin: '8px 0 12px' }}>{cat}</h3>
            <div className="grid cols-3">
              {items.map((ex) => <ExerciseCard key={ex.id} ex={ex} navigate={navigate} highlight={highlight} last={doneByExercise.get(ex.id) || null} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
